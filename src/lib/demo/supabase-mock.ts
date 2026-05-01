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
import { DEMO_PASSWORD, type DemoStore } from './fixtures'

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
          return String(r[col] ?? '').toLowerCase().includes(pattern)
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
  relations: Array<{ name: string; columns: string[] | '*' }>
}

function parseSelect(input: string): ParsedSelect {
  // Strip newlines/whitespace
  const s = input.replace(/\s+/g, ' ').trim()
  if (s === '*') return { columns: '*', relations: [] }

  const relations: ParsedSelect['relations'] = []
  // Capture "name ( fields )" blocks.
  const relationRe = /(\w+)\s*\(\s*([^()]+)\s*\)/g
  let stripped = s
  let m: RegExpExecArray | null
  while ((m = relationRe.exec(s)) !== null) {
    const [full, name, inner] = m
    const cols = inner
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    relations.push({ name, columns: cols.length ? cols : '*' })
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

function attachRelations(rows: Row[], parent: keyof DemoStore, parsed: ParsedSelect, store: DemoStore): Row[] {
  if (parsed.relations.length === 0) return rows

  return rows.map((row) => {
    const enriched: Row = { ...row }
    for (const rel of parsed.relations) {
      const relTable = rel.name as keyof DemoStore
      if (!(relTable in store)) continue
      const fkCol = `${rel.name.replace(/s$/, '')}_id` // clients → client_id
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
      return execute(state) as never
    },
    limit(n: number) {
      state.limit = n
      return builder
    },
    single() {
      return execute(state, 'single')
    },
    maybeSingle() {
      return execute(state, 'maybe')
    },
    then(onFulfilled, onRejected) {
      return execute(state, 'list').then(onFulfilled, onRejected)
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
  range: (from: number, to: number) => Promise<{ data: Row[]; count: number; error: null }>
  limit: (n: number) => MockBuilder
  single: () => Promise<{ data: Row | null; error: { message: string } | null }>
  maybeSingle: () => Promise<{ data: Row | null; error: null }>
  then: <T>(
    onFulfilled?: (v: { data: Row[] | null; error: null; count?: number }) => T,
    onRejected?: (reason: unknown) => T,
  ) => Promise<T>
  catch: (onRejected: (reason: unknown) => unknown) => Promise<unknown>
}

async function execute(state: BuilderState, kind: 'list' | 'single' | 'maybe' = 'list'): Promise<{
  data: Row | Row[] | null
  count?: number
  error: { message: string } | null
}> {
  const store = getStore()
  const table = state.table

  if (state.mode === 'insert') {
    const rows = Array.isArray(state.payload) ? state.payload : [state.payload!]
    const inserted = rows.map((r) => ({ ...r, id: r.id ?? demoUuid(), created_at: r.created_at ?? new Date().toISOString() }))
    ;(store[table] as unknown as Row[]).push(...inserted)
    saveStore(store)
    if (kind === 'single') return { data: inserted[0] ?? null, error: null }
    return { data: inserted, error: null }
  }

  if (state.mode === 'update') {
    const list = store[table] as unknown as Row[]
    let updated: Row[] = []
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
    let deleted = 0
    for (const row of list) {
      const match = state.filters.every((f) => applyFilter([row], f).length > 0)
      if (match) {
        deleted++
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
  return state.countMode ? { data: rows, count: totalCount, error: null } : { data: rows, error: null }
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
        return { data: { user: null, session: null }, error: { message: 'Invalid login (use demo123)' } }
      }
      const store = getStore()
      const user = store.profiles.find((p) => p.email === email)
      if (!user) {
        return { data: { user: null, session: null }, error: { message: `No demo account for ${email}` } }
      }
      store._session = { user: { id: user.id, email: user.email ?? '' }, access_token: 'demo-token' }
      saveStore(store)
      notifyAll('SIGNED_IN', { user })
      return { data: { user, session: { user, access_token: 'demo-token' } }, error: null }
    },
    async signInWithOtp() {
      return { data: { user: null, session: null }, error: { message: 'OTP not supported in demo mode' } }
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

function makeRpc() {
  return async (fn: string, _params?: Record<string, unknown>) => {
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
    return { data: null, error: { message: `RPC ${fn} not supported in demo mode` } }
  }
}

// ── Public client ───────────────────────────────────────────────────────────

export function createDemoSupabaseClient() {
  return {
    from(table: string) {
      return makeBuilder(table as keyof DemoStore)
    },
    auth: makeAuth(),
    storage: makeStorage(),
    rpc: makeRpc(),
  }
}

export type DemoSupabaseClient = ReturnType<typeof createDemoSupabaseClient>
