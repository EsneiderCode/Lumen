/**
 * Mock Supabase client for demo mode. Backed by `store.ts` (localStorage).
 *
 * Implements just enough of the Supabase v2 client surface to power the
 * existing app: chainable query builder for tables, basic auth, storage
 * stubs that return placeholder URLs, and the `generate_order_number` RPC.
 *
 * Not a full Supabase replica. If a query fails because the mock doesn't
 * support a method, it logs to console and returns `{ data: [], error: null }`
 * so the UI stays responsive.
 */

import { getStore, saveStore, demoUuid } from './store'
import { DEMO_PASSWORD, DEMO_TECH_PIN, type DemoStore } from './fixtures'
import {
  buildContractorDocumentFailureReasons,
  reasonsToMessage,
} from '@/services/workOrderBusinessRules'
import type { ContractorDocument } from '@/types/contractor-documents'

type Row = Record<string, unknown>
type FilterOp = 'eq' | 'gte' | 'lte' | 'is' | 'in'

interface Filter {
  op: FilterOp
  col: string
  val: unknown
}

interface OrFilter {
  raw: string
}

interface NotFilter {
  col: string
  op: string
  val: string
}

interface OrderBy {
  col: string
  ascending: boolean
  nullsFirst?: boolean
}

const PLACEHOLDER_URL = 'https://placehold.co/640x400/161920/E8E8E8?text=Demo+Photo'

// ── Helpers ─────────────────────────────────────────────────────────────────

function applyFilter(rows: Row[], f: Filter): Row[] {
  switch (f.op) {
    case 'eq':
      return rows.filter((r) => r[f.col] === f.val)
    case 'is':
      return rows.filter((r) => r[f.col] === f.val) // works for null
    case 'gte':
      return rows.filter((r) => (r[f.col] as number | string) >= (f.val as number | string))
    case 'lte':
      return rows.filter((r) => (r[f.col] as number | string) <= (f.val as number | string))
    case 'in': {
      const set = new Set(f.val as unknown[])
      return rows.filter((r) => set.has(r[f.col]))
    }
    default:
      return rows
  }
}

function applyOr(rows: Row[], or: OrFilter): Row[] {
  // Format examples: "order_number.ilike.%term%,address.ilike.%term%"
  // or: "assigned_technician.eq.uuid,assigned_team.eq.rot"
  const clauses = or.raw.split(',').map((c) => c.trim())
  return rows.filter((r) =>
    clauses.some((clause) => {
      const m = clause.match(/^(\w+)\.(\w+)\.(.+)$/)
      if (!m) return false
      const [, col, op, valRaw] = m
      switch (op) {
        case 'eq':
          return r[col] === valRaw
        case 'ilike': {
          const pattern = valRaw.replace(/%/g, '').toLowerCase()
          return String(r[col] ?? '')
            .toLowerCase()
            .includes(pattern)
        }
        default:
          return false
      }
    }),
  )
}

function applyNot(rows: Row[], n: NotFilter): Row[] {
  // Format: column, "in", "(\"cancelled\",\"paid\")"
  if (n.op === 'in') {
    const items = n.val
      .replace(/^\(/, '')
      .replace(/\)$/, '')
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
    const set = new Set(items)
    return rows.filter((r) => !set.has(String(r[n.col])))
  }
  return rows
}

function applyOrder(rows: Row[], ord: OrderBy | null): Row[] {
  if (!ord) return rows
  const sorted = [...rows].sort((a, b) => {
    const av = a[ord.col]
    const bv = b[ord.col]
    if (av == null && bv == null) return 0
    if (av == null) return ord.nullsFirst ? -1 : 1
    if (bv == null) return ord.nullsFirst ? 1 : -1
    if (av < bv) return ord.ascending ? -1 : 1
    if (av > bv) return ord.ascending ? 1 : -1
    return 0
  })
  return sorted
}

// ── Select-string with relations ────────────────────────────────────────────

interface ParsedSelect {
  columns: string[] | '*'
  relations: Array<{ name: string; columns: string[] | '*'; fkCol?: string }>
}

function parseSelect(input: string): ParsedSelect {
  // Strip newlines/whitespace
  const s = input.replace(/\s+/g, ' ').trim()
  if (s === '*') return { columns: '*', relations: [] }

  const relations: ParsedSelect['relations'] = []
  // Capture "name ( fields )" and "alias:fk_column ( fields )" blocks.
  const relationRe = /(?:(\w+):)?(\w+)\s*\(\s*([^()]+)\s*\)/g
  let stripped = s
  let m: RegExpExecArray | null
  while ((m = relationRe.exec(s)) !== null) {
    const [full, alias, nameOrFk, inner] = m
    const name = alias || nameOrFk
    const fkCol = alias ? nameOrFk : undefined
    const cols = inner
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    relations.push({ name, fkCol, columns: cols.length ? cols : '*' })
    stripped = stripped.replace(full, '')
  }

  const colList = stripped
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && c !== '*')

  return {
    columns: colList.length ? colList : '*',
    relations,
  }
}

function attachRelations(
  rows: Row[],
  parent: keyof DemoStore,
  parsed: ParsedSelect,
  store: DemoStore,
): Row[] {
  if (parsed.relations.length === 0) return rows

  return rows.map((row) => {
    const enriched: Row = { ...row }
    for (const rel of parsed.relations) {
      const relTable = rel.name as keyof DemoStore
      if (!(relTable in store)) continue
      const fkCol =
        rel.fkCol ??
        (parent === 'materials' && rel.name === 'clients'
          ? 'catalog_client_id'
          : `${rel.name.replace(/s$/, '')}_id`) // clients → client_id
      const relRows = store[relTable] as unknown as Row[]

      if (parent === 'work_order_state_history' && rel.name === 'profiles') {
        const match = relRows.find((p) => p.id === row.changed_by)
        enriched[rel.name] = match ?? null
        continue
      }
      if (parent === 'certification_audits' && rel.name === 'profiles') {
        const match = relRows.find((p) => p.id === row.certified_by)
        enriched[rel.name] = match ?? null
        continue
      }

      const match = relRows.find((r) => r.id === row[fkCol])
      enriched[rel.name] = match ?? null
    }
    return enriched
  })
}

// ── Query builder ───────────────────────────────────────────────────────────

interface BuilderState {
  table: keyof DemoStore
  mode: 'select' | 'insert' | 'update' | 'delete'
  selectStr: string
  countMode: 'exact' | null
  filters: Filter[]
  orFilters: OrFilter[]
  notFilters: NotFilter[]
  orderBy: OrderBy | null
  rangeFrom: number | null
  rangeTo: number | null
  limit: number | null
  payload: Row | Row[] | null
}

function makeBuilder(table: keyof DemoStore): MockBuilder {
  const state: BuilderState = {
    table,
    mode: 'select',
    selectStr: '*',
    countMode: null,
    filters: [],
    orFilters: [],
    notFilters: [],
    orderBy: null,
    rangeFrom: null,
    rangeTo: null,
    limit: null,
    payload: null,
  }

  const builder: MockBuilder = {
    select(cols?: string, opts?: { count?: 'exact' }) {
      state.selectStr = cols ?? '*'
      if (opts?.count) state.countMode = opts.count
      return builder
    },
    insert(rows: Row | Row[]) {
      state.mode = 'insert'
      state.payload = rows
      return builder
    },
    update(payload: Row) {
      state.mode = 'update'
      state.payload = payload
      return builder
    },
    delete() {
      state.mode = 'delete'
      return builder
    },
    eq(col: string, val: unknown) {
      state.filters.push({ op: 'eq', col, val })
      return builder
    },
    is(col: string, val: unknown) {
      state.filters.push({ op: 'is', col, val })
      return builder
    },
    gte(col: string, val: unknown) {
      state.filters.push({ op: 'gte', col, val })
      return builder
    },
    lte(col: string, val: unknown) {
      state.filters.push({ op: 'lte', col, val })
      return builder
    },
    in(col: string, vals: unknown[]) {
      state.filters.push({ op: 'in', col, val: vals })
      return builder
    },
    or(raw: string) {
      state.orFilters.push({ raw })
      return builder
    },
    not(col: string, op: string, val: string) {
      state.notFilters.push({ col, op, val })
      return builder
    },
    order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
      state.orderBy = {
        col,
        ascending: opts?.ascending ?? true,
        nullsFirst: opts?.nullsFirst,
      }
      return builder
    },
    range(from: number, to: number) {
      state.rangeFrom = from
      state.rangeTo = to
      return builder
    },
    limit(n: number) {
      state.limit = n
      return builder
    },
    single() {
      return execute(state, 'single') as Promise<{
        data: Row | null
        error: { message: string } | null
      }>
    },
    maybeSingle() {
      return execute(state, 'maybe') as Promise<{ data: Row | null; error: null }>
    },
    then(onFulfilled, onRejected) {
      return (
        execute(state, 'list') as Promise<{ data: Row[] | null; error: null; count?: number }>
      ).then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      return execute(state, 'list').catch(onRejected)
    },
  }

  return builder
}

interface MockBuilder {
  select: (cols?: string, opts?: { count?: 'exact' }) => MockBuilder
  insert: (rows: Row | Row[]) => MockBuilder
  update: (payload: Row) => MockBuilder
  delete: () => MockBuilder
  eq: (col: string, val: unknown) => MockBuilder
  is: (col: string, val: unknown) => MockBuilder
  gte: (col: string, val: unknown) => MockBuilder
  lte: (col: string, val: unknown) => MockBuilder
  in: (col: string, vals: unknown[]) => MockBuilder
  or: (raw: string) => MockBuilder
  not: (col: string, op: string, val: string) => MockBuilder
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => MockBuilder
  range: (from: number, to: number) => MockBuilder
  limit: (n: number) => MockBuilder
  single: () => Promise<{ data: Row | null; error: { message: string } | null }>
  maybeSingle: () => Promise<{ data: Row | null; error: null }>
  then: <T>(
    onFulfilled?: (v: { data: Row[] | null; error: null; count?: number }) => T,
    onRejected?: (reason: unknown) => T,
  ) => Promise<T>
  catch: (onRejected: (reason: unknown) => unknown) => Promise<unknown>
}

async function execute(
  state: BuilderState,
  kind: 'list' | 'single' | 'maybe' = 'list',
): Promise<{
  data: Row | Row[] | null
  count?: number
  error: { message: string } | null
}> {
  const store = getStore()
  const table = state.table

  if (state.mode === 'insert') {
    const rows = Array.isArray(state.payload) ? state.payload : [state.payload!]
    const now = new Date().toISOString()
    const inserted = rows.map((r) => ({
      ...r,
      id: r.id ?? demoUuid(),
      created_at: r.created_at ?? now,
      updated_at: r.updated_at ?? now,
      ...(table === 'contractor_documents' ? { uploaded_at: r.uploaded_at ?? now } : {}),
    }))
    ;(store[table] as unknown as Row[]).push(...inserted)
    saveStore(store)
    if (kind === 'single') return { data: inserted[0] ?? null, error: null }
    return { data: inserted, error: null }
  }

  if (state.mode === 'update') {
    const list = store[table] as unknown as Row[]
    const updated: Row[] = []
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      let match = state.filters.every((f) => applyFilter([row], f).length > 0)
      if (state.notFilters.length) match = match && applyNot([row], state.notFilters[0]).length > 0
      if (match) {
        list[i] = { ...row, ...(state.payload as Row), updated_at: new Date().toISOString() }
        updated.push(list[i])
      }
    }
    saveStore(store)
    if (kind === 'single') return { data: updated[0] ?? null, error: null }
    return { data: updated, error: null }
  }

  if (state.mode === 'delete') {
    const list = store[table] as unknown as Row[]
    const survivors: Row[] = []
    for (const row of list) {
      const match = state.filters.every((f) => applyFilter([row], f).length > 0)
      if (match) {
        continue
      } else {
        survivors.push(row)
      }
    }
    ;(store[table] as unknown) = survivors
    saveStore(store)
    return { data: null, error: null }
  }

  // SELECT
  let rows = [...((store[table] as unknown as Row[]) ?? [])]
  for (const f of state.filters) rows = applyFilter(rows, f)
  for (const o of state.orFilters) rows = applyOr(rows, o)
  for (const n of state.notFilters) rows = applyNot(rows, n)
  rows = applyOrder(rows, state.orderBy)
  const totalCount = rows.length

  if (state.rangeFrom !== null && state.rangeTo !== null) {
    rows = rows.slice(state.rangeFrom, state.rangeTo + 1)
  }
  if (state.limit !== null) rows = rows.slice(0, state.limit)

  const parsed = parseSelect(state.selectStr)
  rows = attachRelations(rows, table, parsed, store)

  if (kind === 'single') {
    if (rows.length === 0) return { data: null, error: { message: 'No rows found' } }
    return { data: rows[0], error: null }
  }
  if (kind === 'maybe') {
    return { data: rows[0] ?? null, error: null }
  }
  return state.countMode
    ? { data: rows, count: totalCount, error: null }
    : { data: rows, error: null }
}

// ── Auth ────────────────────────────────────────────────────────────────────

function makeAuth() {
  type AuthChangeListener = (event: string, session: { user: Row } | null) => void
  const listeners: AuthChangeListener[] = []

  function notifyAll(event: string, session: { user: Row } | null) {
    listeners.forEach((fn) => fn(event, session))
  }

  return {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      if (password !== DEMO_PASSWORD) {
        return {
          data: { user: null, session: null },
          error: { message: 'Invalid login (use demo123)' },
        }
      }
      const store = getStore()
      const user = store.profiles.find((p) => p.email === email)
      if (!user) {
        return {
          data: { user: null, session: null },
          error: { message: `No demo account for ${email}` },
        }
      }
      store._session = {
        user: { id: user.id, email: user.email ?? '' },
        access_token: 'demo-token',
      }
      saveStore(store)
      notifyAll('SIGNED_IN', { user })
      return { data: { user, session: { user, access_token: 'demo-token' } }, error: null }
    },
    async signInWithOtp() {
      return {
        data: { user: null, session: null },
        error: { message: 'OTP not supported in demo mode' },
      }
    },
    async signOut() {
      const store = getStore()
      store._session = { user: null, access_token: null }
      saveStore(store)
      notifyAll('SIGNED_OUT', null)
      return { error: null }
    },
    async getSession() {
      const store = getStore()
      if (!store._session.user) return { data: { session: null }, error: null }
      const profile = store.profiles.find((p) => p.id === store._session.user!.id)
      return {
        data: { session: { user: profile, access_token: store._session.access_token } },
        error: null,
      }
    },
    async getUser() {
      const store = getStore()
      if (!store._session.user) return { data: { user: null }, error: null }
      const profile = store.profiles.find((p) => p.id === store._session.user!.id)
      return { data: { user: profile }, error: null }
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null }
    },
    async updateUser() {
      return { data: { user: null }, error: null }
    },
    onAuthStateChange(callback: AuthChangeListener) {
      listeners.push(callback)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = listeners.indexOf(callback)
              if (idx >= 0) listeners.splice(idx, 1)
            },
          },
        },
      }
    },
  }
}

// ── Storage ─────────────────────────────────────────────────────────────────

function makeStorage() {
  return {
    from(_bucket: string) {
      return {
        async upload(_path: string, _file: File | Blob, _opts?: unknown) {
          return { data: { path: _path }, error: null }
        },
        async createSignedUrl(_path: string, _expiresIn = 3600) {
          return { data: { signedUrl: PLACEHOLDER_URL }, error: null }
        },
        async createSignedUrls(paths: string[], _expiresIn = 3600) {
          return {
            data: paths.map((p) => ({ path: p, signedUrl: PLACEHOLDER_URL, error: null })),
            error: null,
          }
        },
        async remove(_paths: string[]) {
          return { data: [], error: null }
        },
      }
    },
  }
}

// ── RPC ─────────────────────────────────────────────────────────────────────

function addStateHistory(
  store: DemoStore,
  workOrderId: string,
  fromStatus: unknown,
  toStatus: string,
  changedBy: string,
  notes: string | null,
) {
  ;(store.work_order_state_history as Row[]).push({
    id: demoUuid(),
    work_order_id: workOrderId,
    from_status: fromStatus as string | null,
    to_status: toStatus,
    changed_by: changedBy,
    notes,
    created_at: new Date().toISOString(),
  })
}

function addCertificationAudit(
  store: DemoStore,
  workOrderId: string,
  certType: string,
  changedBy: string,
  dataHash: string,
  notes: string | null,
) {
  ;(store.certification_audits as Row[]).push({
    id: demoUuid(),
    work_order_id: workOrderId,
    cert_type: certType,
    certified_by: changedBy,
    certified_at: new Date().toISOString(),
    data_hash: dataHash,
    notes,
    created_at: new Date().toISOString(),
  })
}

function makeRpc() {
  return async (fn: string, params: Record<string, unknown> = {}) => {
    if (fn === 'generate_order_number') {
      const store = getStore()
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const todayPrefix = `LUM-${today}-`
      const todayCount = store.work_orders.filter((w) =>
        String(w.order_number).startsWith(todayPrefix),
      ).length
      const seq = String(todayCount + 1).padStart(4, '0')
      return { data: `${todayPrefix}${seq}`, error: null }
    }

    if (fn === 'assign_work_order_checked') {
      const store = getStore()
      const workOrderId = String(params.p_work_order_id ?? '')
      const assigneeId = String(params.p_assignee_id ?? '')
      const changedBy = String(params.p_changed_by ?? '')
      const assignedDate = String(params.p_assigned_date ?? new Date().toISOString().slice(0, 10))
      const notes = (params.p_notes as string | null | undefined) ?? null
      const order = store.work_orders.find((item) => item.id === workOrderId)
      if (!order) return { data: null, error: { message: 'Work order not found' } }

      const assignee = store.profiles.find((profile) => profile.id === assigneeId)
      if (assignee?.role === 'contractor') {
        const docs = store.contractor_documents.filter((doc) => doc.contractor_id === assigneeId)
        const reasons = buildContractorDocumentFailureReasons(
          docs as ContractorDocument[],
          assignedDate,
        )
        if (reasons.length > 0) {
          const message = reasons
            .map(
              (reason) =>
                `${reason.requirementId ?? reason.documentType ?? reason.code}: ${reason.message}`,
            )
            .join('; ')
          return { data: null, error: { message: message || reasonsToMessage(reasons) } }
        }
      }

      const fromStatus = order.status
      Object.assign(order as Row, {
        assigned_team: (params.p_team as string | null | undefined) ?? null,
        assigned_technician: assigneeId || null,
        assigned_date: assignedDate,
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      addStateHistory(store, workOrderId, fromStatus, 'assigned', changedBy, notes)
      saveStore(store)
      return { data: order, error: null }
    }

    if (fn === 'certify_work_order_internal') {
      const store = getStore()
      const workOrderId = String(params.p_work_order_id ?? '')
      const changedBy = String(params.p_changed_by ?? '')
      const dataHash = String(params.p_data_hash ?? '')
      const notes = (params.p_notes as string | null | undefined) ?? null
      const order = store.work_orders.find((item) => item.id === workOrderId)
      if (!order) return { data: null, error: { message: 'Work order not found' } }
      if (!dataHash)
        return { data: null, error: { message: 'Internal audit data hash is required' } }
      if (order.status !== 'rueckmeldung_sent') {
        return {
          data: null,
          error: { message: 'Internal certification requires rueckmeldung_sent status' },
        }
      }

      const fromStatus = order.status
      Object.assign(order as Row, {
        status: 'internally_certified',
        updated_at: new Date().toISOString(),
      })
      addCertificationAudit(store, workOrderId, 'internal', changedBy, dataHash, notes)
      addStateHistory(store, workOrderId, fromStatus, 'internally_certified', changedBy, notes)
      saveStore(store)
      return { data: order, error: null }
    }

    if (fn === 'accept_work_order_client') {
      const store = getStore()
      const workOrderId = String(params.p_work_order_id ?? '')
      const changedBy = String(params.p_changed_by ?? '')
      const dataHash = String(params.p_data_hash ?? '')
      const notes = (params.p_notes as string | null | undefined) ?? null
      const order = store.work_orders.find((item) => item.id === workOrderId)
      if (!order) return { data: null, error: { message: 'Work order not found' } }
      if (!dataHash) return { data: null, error: { message: 'Client audit data hash is required' } }
      if (order.client_id === null) {
        return { data: null, error: { message: 'Direct orders cannot be client accepted' } }
      }
      if (order.status !== 'sent_to_client') {
        return {
          data: null,
          error: { message: 'Client acceptance requires sent_to_client status' },
        }
      }

      const fromStatus = order.status
      Object.assign(order as Row, {
        status: 'client_accepted',
        updated_at: new Date().toISOString(),
      })
      addCertificationAudit(store, workOrderId, 'client', changedBy, dataHash, notes)
      addStateHistory(store, workOrderId, fromStatus, 'client_accepted', changedBy, notes)
      saveStore(store)
      return { data: order, error: null }
    }

    if (fn === 'invoice_work_order_checked') {
      const store = getStore()
      const workOrderId = String(params.p_work_order_id ?? '')
      const changedBy = String(params.p_changed_by ?? '')
      const billingReference = (params.p_billing_reference as string | null | undefined) ?? null
      const notes = (params.p_notes as string | null | undefined) ?? null
      const order = store.work_orders.find((item) => item.id === workOrderId)
      if (!order) return { data: null, error: { message: 'Work order not found' } }
      const isDirect = order.client_id === null
      const requiredCert = isDirect ? 'internal' : 'client'
      const requiredStatus = isDirect ? 'internally_certified' : 'client_accepted'
      const hasAudit = store.certification_audits.some(
        (audit) => audit.work_order_id === workOrderId && audit.cert_type === requiredCert,
      )
      if (order.status !== requiredStatus) {
        return { data: null, error: { message: `Invoice requires ${requiredStatus} status` } }
      }
      if (!hasAudit) {
        return { data: null, error: { message: `Invoice requires ${requiredCert} audit` } }
      }

      const fromStatus = order.status
      Object.assign(order as Row, {
        status: 'invoiced',
        billing_reference: billingReference,
        updated_at: new Date().toISOString(),
      })
      addStateHistory(store, workOrderId, fromStatus, 'invoiced', changedBy, notes)
      saveStore(store)
      return { data: order, error: null }
    }

    return { data: null, error: { message: `RPC ${fn} not supported in demo mode` } }
  }
}

// ── Functions ────────────────────────────────────────────────────────────────

function makeFunctions() {
  return {
    async invoke(functionName: string, options: { method?: string; body?: Row } = {}) {
      const store = getStore()

      if (functionName === 'pin-login') {
        const loginCode = String(options.body?.loginCode ?? '').toLowerCase()
        const pin = String(options.body?.pin ?? '')
        const user = store.profiles.find(
          (p) =>
            p.pin_login_code === loginCode &&
            p.is_active &&
            ['technician', 'contractor'].includes(String(p.role)),
        )
        if (!user || pin !== DEMO_TECH_PIN) {
          return { data: null, error: { message: 'Invalid demo PIN (use 1234)' } }
        }
        user.last_pin_login_at = new Date().toISOString()
        store._session = {
          user: { id: user.id, email: user.email ?? '' },
          access_token: 'demo-pin-token',
        }
        saveStore(store)
        return {
          data: {
            accessToken: 'demo-pin-token',
            expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
            user: {
              id: user.id,
              email: user.email,
              fullName: user.full_name,
              role: user.role,
              team: user.team,
              loginCode: user.pin_login_code,
            },
          },
          error: null,
        }
      }

      if (functionName === 'admin-users') {
        if (options.method === 'GET') {
          return { data: { users: store.profiles }, error: null }
        }

        const body = options.body ?? {}

        if (options.method === 'POST' && body.action === 'delete') {
          const id = String(body.id ?? '')
          const idx = store.profiles.findIndex((p) => p.id === id)
          if (idx === -1) return { data: null, error: { message: 'Demo user not found' } }
          store.profiles.splice(idx, 1)
          saveStore(store)
          return { data: { users: store.profiles }, error: null }
        }

        if (options.method === 'POST') {
          const id = demoUuid()
          const role = String(body.role ?? 'technician')
          const user = {
            id,
            email: typeof body.email === 'string' && body.email ? body.email : null,
            full_name: String(body.fullName ?? 'Neuer Benutzer'),
            role,
            team: (body.team as string | null) ?? null,
            pin_login_code: role === 'admin' ? null : String(body.loginCode ?? '').toLowerCase(),
            pin_set_at: body.pin ? new Date().toISOString() : null,
            last_pin_login_at: null,
            is_active: body.isActive !== false,
            scheduler_line: (body.schedulerLine as string | null) ?? null,
            scheduler_operator: (body.schedulerOperator as string | null) ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          store.profiles.push(user)
          saveStore(store)
          return { data: { users: store.profiles }, error: null }
        }

        if (options.method === 'PATCH') {
          const id = String(body.id ?? '')
          const user = store.profiles.find((p) => p.id === id)
          if (!user) return { data: null, error: { message: 'Demo user not found' } }
          if (body.email !== undefined) user.email = body.email as string | null
          if (body.fullName !== undefined) user.full_name = String(body.fullName)
          if (body.role !== undefined) user.role = String(body.role)
          if (body.team !== undefined) user.team = body.team as string | null
          if (body.loginCode !== undefined) user.pin_login_code = body.loginCode as string | null
          if (body.isActive !== undefined) user.is_active = Boolean(body.isActive)
          if (body.pin) user.pin_set_at = new Date().toISOString()
          user.updated_at = new Date().toISOString()
          saveStore(store)
          return { data: { users: store.profiles }, error: null }
        }

      }

      return {
        data: null,
        error: { message: `Function ${functionName} not supported in demo mode` },
      }
    },
  }
}

// ── Public client ───────────────────────────────────────────────────────────

export function createDemoSupabaseClient() {
  return {
    from(table: string) {
      const physicalTable = table === 'service_items_public' ? 'service_items' : table
      return makeBuilder(physicalTable as keyof DemoStore)
    },
    auth: makeAuth(),
    storage: makeStorage(),
    rpc: makeRpc(),
    functions: makeFunctions(),
  }
}

export type DemoSupabaseClient = ReturnType<typeof createDemoSupabaseClient>
