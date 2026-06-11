# Plan 004: NE4 bridge — typed provenance, structured metadata, and sync observability

> **Executor instructions**: This plan spans TWO repos on the same machine:
> LUMEN (`/Users/jarl/Dev/Lumen-esneider`) and NE4 Work Manager
> (`/Users/jarl/Dev/ne4-work-manager`). Follow it step by step, run every
> verification, honor the STOP conditions. When done, update the status row in
> `Lumen-esneider/plans/README.md`.
>
> **Drift check (run first)**:
> `git -C /Users/jarl/Dev/Lumen-esneider diff --stat 759eb55..HEAD -- src/pages/admin/WorkOrderDetailPage.tsx src/lib/demo/fixtures.ts supabase/migrations/`
> and confirm `/Users/jarl/Dev/ne4-work-manager/supabase/functions/lumen-bridge/index.ts`
> still matches the excerpts below (esp. the payload at lines ~225-241).
> On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (cross-repo deploy-order dependency — read "Sequencing" below)
- **Depends on**: none in code; LUMEN migration numbering follows Plan 003 (expected `025`)
- **Category**: direction / tech-debt
- **Planned at**: LUMEN commit `759eb55`, 2026-06-10 (record the ne4 HEAD with `git -C /Users/jarl/Dev/ne4-work-manager rev-parse --short HEAD` before starting and note it in your report) — **refreshed 2026-06-11** at LUMEN HEAD `f92ca0a`, ne4 HEAD `651f1e4`

## Preconditions (refreshed 2026-06-11 — read before the drift check)

All items below were re-verified on 2026-06-11 with plans 001/002/003/005
landed on the LUMEN side:

1. **Run the drift check against `f92ca0a`, not `759eb55`.** The diff vs
   `759eb55` is expected drift from plans 001-003: `src/lib/demo/fixtures.ts`
   (+92 lines — project defaults + employee fixtures) and new migrations
   `022_service_item_categories.sql`, `023_project_defaults.sql`,
   `024_employee_teams.sql`. `WorkOrderDetailPage.tsx` is untouched — the
   internal-notes block is still at line 1045. The ne4 bridge payload excerpt
   (lines ~224-241) was re-verified verbatim.
2. **Branch `feat/ne4-bridge-provenance` from `f92ca0a`** (tip of
   `feat/personnel-teams-person-assignment`) so the fixtures file and the
   migration sequence you see match this plan's excerpts.
3. **Migration numbers confirmed free**: LUMEN `025` is free locally AND on
   `upstream/develop` (its latest migration is `021_team_pins.sql`; 022-024
   exist only on local pending-PR branches — the sequence holds as long as
   those PRs merge in order). ne4 `022` is free (latest numbered file is
   `021_westconnect_internal_client_type.sql`; ignore the three
   `20260503*`-timestamped variants).
4. **ne4 working tree is DIRTY with unrelated uncommitted work** (Vancom
   parser effort): `AGENTS.md`, `CLAUDE.md`, `package.json`,
   `package-lock.json`, `scripts/smoke-vancom-parser.ts`,
   `src/features/import/VancomImportPage.tsx`,
   `src/features/import/parseVancomExcel.ts`,
   `src/features/reports/ReportForm.tsx`. None overlap this plan's scope.
   Do NOT touch, stage, stash, or commit them; commit ONLY the two files in
   this plan's ne4 scope and expect `git status` to keep showing those eight.
5. **Step 3's trigger STOP-check is pre-cleared**:
   `020_lumen_bridge_webhook.sql` defines
   `after insert or update of work_status, synced_at` — the no-op
   `work_status = work_status` retry mechanism is valid. Still re-read the
   file when you copy the function body.
6. **deno IS installed** (`/opt/homebrew/bin/deno`) — `deno check` is
   mandatory for this run, not skippable.
7. **STOP condition pre-cleared**: no `source` / `external_metadata`-like
   column exists in any LUMEN migration up to `024`.

## Why this matters

**The LUMEN↔NE4 bridge already exists and runs in production**: a pg_net
trigger in ne4's Supabase fires the `lumen-bridge` edge function whenever a
report reaches `work_status = 'completa'`, which upserts a LUMEN work order
(`order_number = 'NE4-<report.id>'`, status `rueckmeldung_sent`) and stamps
`reports.synced_at` back. Three gaps undermine the goal of "centralized
certification in LUMEN":

1. **No typed provenance** — LUMEN cannot query "orders that came from NE4";
   the only trace is the order-number prefix and a free-text notes blob.
2. **Structural data loss** — HA code, WE count, score, work zones, workflow
   etc. are flattened into `internal_notes`; a certifier reviewing a bridged
   order has no structured execution data (`assigned_detail_snapshot` is NULL
   for bridged orders).
3. **Fire-and-forget sync** — the pg_net call has a 5s timeout, no log, no
   retry; a failed sync is invisible until someone misses an order.

After this plan: LUMEN work orders carry `source` + `external_metadata`,
bridged orders render an "NE4 data" panel on the detail page, every bridge
enqueue is logged in ne4, and unsynced completed reports can be re-enqueued.

## Current state

### ne4-work-manager (`/Users/jarl/Dev/ne4-work-manager`)

- Separate Supabase project from LUMEN. The bridge edge function authenticates to BOTH projects with service-role keys via env vars (`NE4_SUPABASE_URL`, `NE4_SERVICE_ROLE_KEY`, `LUMEN_SUPABASE_URL`, `LUMEN_SERVICE_ROLE_KEY` — names only; never print values).
- `supabase/functions/lumen-bridge/index.ts` (296 lines):
  - `buildInternalNotes(report, cita)` lines 147-166 — already collects report id, cita id, HA, WE, workflow, installation type, work zones, score, contacts, comments… as a TEXT blob.
  - Upsert payload lines 224-241:
    ```ts
    const orderNumber = `NE4-${report.id}`
    const payload = {
      order_number: orderNumber,
      client_id: clientId, project_id: projectId, operator_id: operatorId,
      line: 'NE4', work_type: 'alta', status: 'rueckmeldung_sent', priority: 'normal',
      assigned_date: cita.fecha, address: cita.calle, postal_code: cita.cp, city: cita.ciudad,
      internal_notes: buildInternalNotes(report, cita),
      created_by: createdBy, updated_at: new Date().toISOString(),
    }
    ```
  - POST to `work_orders?on_conflict=order_number` with `resolution=merge-duplicates` (lines 243-252) — idempotent.
  - On success PATCHes `reports.synced_at` (lines 257-266).
- `supabase/migrations/020_lumen_bridge_webhook.sql` — `enqueue_lumen_bridge_for_report()` trigger function: returns early unless `work_status = 'completa'` and `synced_at IS NULL`; reads `lumen_bridge_function_url` + `lumen_bridge_webhook_secret` from Vault; `SELECT net.http_post(url := ..., body := jsonb_build_object('type', tg_op, 'table', tg_table_name, 'schema', tg_table_schema, 'record', to_jsonb(new), ...))` into a `request_id bigint` variable that is currently **discarded**.
- Migrations: numbered `001`–`021` (plus a few timestamped variants of the same content). Next number: `022`.
- **Known defect (verified 2026-06-11)**: ne4 migration `015_lumen_routing.sql:34` sets `config_json.lumen.operator = "WESTCONNECT"` for the WC operator, but LUMEN seeds its Westconnect operator with code `WESTC` (LUMEN migration `004_service_catalog_seed.sql:71`: `('Westconnect', 'WESTC')`). The bridge's `requireLookupId('operators', 'WESTCONNECT')` therefore throws and every WC-cita sync fails silently — unless LUMEN production contains a manually created `WESTCONNECT` operator row. Step 3 item 4 fixes this; its guard handles the manual-row possibility.
- Read `/Users/jarl/Dev/ne4-work-manager/AGENTS.md` before editing — it is that repo's contribution contract. Check `package.json` scripts for available verification commands there.

### LUMEN (`/Users/jarl/Dev/Lumen-esneider`)

- `work_orders` has **no `source`/origin column and no metadata JSONB** (only `assigned_detail_snapshot JSONB` from migration `002_cert_audit.sql:11-13`, whose documented semantics are "what the admin originally assigned — set once on creation, never overwritten"; do NOT repurpose it for NE4 execution data).
- `src/pages/admin/WorkOrderDetailPage.tsx` — card-based layout; the internal-notes block renders around line 1045 (`{order.internal_notes && (...)}`) inside a card with classes `rounded-l border border-line bg-bg-1 p-5` (pattern at line 997). New columns are absent from generated DB types — read them via a narrowing cast, the same pattern the codebase already uses for `service_item_id` (`WorkOrderFormPage.tsx:163`: `(data as { service_item_id?: string | null }).service_item_id`).
- Demo fixtures `src/lib/demo/fixtures.ts`: 6 work orders; mock passes objects through as-is, so absent fields read as `undefined` (treat `undefined`/missing `source` as `'lumen'` in UI logic).
- Migration conventions: as in Plans 001-003. **Never execute SQL locally; never edit `database.types.ts`.** i18n keys in BOTH `src/i18n/locales/de.json` and `es.json`.

### Sequencing (the one hard constraint)

The updated bridge payload writes columns that must exist in LUMEN first.
**Deploy order is: (1) LUMEN migration applied by the repo owner → (2) ne4
edge function redeployed (`supabase functions deploy lumen-bridge`) → (3) ne4
migration applied.** The executor only writes code and SQL; deployment is the
operator's job. State this order prominently in your completion report and in
the PR descriptions.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| LUMEN gates | `cd /Users/jarl/Dev/Lumen-esneider && npm run preflight` | exit 0 |
| ne4 checks | read `ne4-work-manager/package.json` scripts; run its lint/typecheck/test equivalents | exit 0 |
| Bridge typecheck | `deno check /Users/jarl/Dev/ne4-work-manager/supabase/functions/lumen-bridge/index.ts` (skip gracefully if `deno` is not installed — note it in the report) | exit 0 |

## Scope

**In scope — LUMEN**:
- `supabase/migrations/025_work_order_source.sql` (create; confirm number per Plan 001 Step 1)
- `src/pages/admin/WorkOrderDetailPage.tsx` (ONLY adding the NE4 panel)
- `src/lib/demo/fixtures.ts` (one new bridged demo order)
- `src/i18n/locales/de.json`, `es.json`
- `src/__tests__/schemaMigrations.test.ts` (extend)

**In scope — ne4-work-manager**:
- `supabase/functions/lumen-bridge/index.ts`
- `supabase/migrations/022_lumen_sync_log.sql` (create)

**Out of scope** (do NOT touch):
- `work_type` mapping (bridge hardcodes `'alta'`) — known data-quality limitation, deliberately deferred; fixing it needs a business mapping from ne4 `workflow_code` that doesn't exist yet.
- `assigned_detail_snapshot` semantics, certification RPCs, billing.
- ne4's coordinator UI (`LumenProjectInline.tsx`, `useLumenProjects.ts`) and `lumen-projects-list` function.
- Replacing pg_net with pgmq — bigger refactor, separate decision.

## Git workflow

- LUMEN branch: `feat/ne4-bridge-provenance`; ne4 branch: `feat/lumen-sync-observability` (check ne4's AGENTS.md for its branch/commit conventions; ne4 deploys from main but you still branch). Conventional commits, NO `Co-Authored-By`. Do NOT push or deploy unless instructed.

## Steps

### Step 1: LUMEN migration `025_work_order_source.sql`

Confirm the number (Plan 001 Step 1 procedure; `Depends on:` the actual predecessor). Contents:

```sql
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'lumen'
    CHECK (source IN ('lumen', 'ne4')),
  ADD COLUMN IF NOT EXISTS external_metadata JSONB;

-- Backfill provenance for orders the bridge already created
-- (order_number convention NE4-<report uuid> since the bridge launched):
UPDATE public.work_orders SET source = 'ne4'
WHERE order_number LIKE 'NE4-%' AND source = 'lumen';

CREATE INDEX IF NOT EXISTS idx_work_orders_source
  ON public.work_orders (source) WHERE source <> 'lumen';

COMMENT ON COLUMN public.work_orders.source IS
  'Origin system: lumen (created in-app) or ne4 (synced by the NE4 Work Manager bridge).';
COMMENT ON COLUMN public.work_orders.external_metadata IS
  'Structured payload from the origin system (NE4: report/cita ids, HA, WE count, workflow, score, work zones).';
```

No RLS change: existing work_orders policies are row-scoped (role/assignee), not column-scoped.

**Verify**: file exists; `rg -c "external_metadata" supabase/migrations/025_work_order_source.sql` ≥ 2. Never execute it.

### Step 2: Bridge payload (ne4 repo)

In `supabase/functions/lumen-bridge/index.ts`:

1. Add a builder next to `buildInternalNotes` (line 147):
   ```ts
   function buildExternalMetadata(report: ReportRecord, cita: CitaRecord): JsonRecord {
     return {
       system: 'ne4-work-manager',
       report_id: report.id,
       cita_id: cita.id,
       ha: cita.ha,
       we_count: cita.we_count,
       workflow_code: report.workflow_code ?? null,
       installation_type: report.installation_type ?? null,
       work_zones: report.work_zones ?? null,
       score: report.score ?? null,
       submitted_at: report.submitted_at ?? null,
       contact_name: cita.contact_name,
       contact_phone: cita.contact_phone,
     }
   }
   ```
2. Extend the upsert payload (lines 225-241) with `source: 'ne4'` and `external_metadata: buildExternalMetadata(report, cita)`. Keep `internal_notes` as-is (human-readable redundancy is fine).

**Verify**: `deno check supabase/functions/lumen-bridge/index.ts` → exit 0 (or note deno unavailable). `rg -n "source: 'ne4'" supabase/functions/lumen-bridge/index.ts` → match.

### Step 3: ne4 migration `022_lumen_sync_log.sql`

Confirm `022` is free in ne4 (`eza /Users/jarl/Dev/ne4-work-manager/supabase/migrations/`). Follow ne4's migration comment style (see its `015`/`020` headers — banner comment + `Depends on:` line). Contents:

1. Log table:
   ```sql
   create table if not exists public.lumen_sync_log (
     id          uuid primary key default gen_random_uuid(),
     report_id   uuid not null references public.reports(id) on delete cascade,
     request_id  bigint,
     enqueued_at timestamptz not null default now(),
     note        text
   );
   create index if not exists idx_lumen_sync_log_report on public.lumen_sync_log (report_id);
   alter table public.lumen_sync_log enable row level security;
   -- service-role/definer writes only; no anon/auth policies on purpose.
   ```
2. `CREATE OR REPLACE FUNCTION public.enqueue_lumen_bridge_for_report()` — reproduce the EXISTING function body from `020_lumen_bridge_webhook.sql` verbatim (read it; the excerpt in "Current state" is partial) with ONE addition after the `select net.http_post(...) into request_id;` statement:
   ```sql
   insert into public.lumen_sync_log (report_id, request_id, note)
   values (new.id, request_id, 'enqueued by trigger');
   ```
3. Re-enqueue helper for stuck reports (manual or cron use):
   ```sql
   create or replace function public.retry_unsynced_lumen_reports(min_age interval default interval '10 minutes')
   returns integer language plpgsql security definer set search_path = '' as $$
   declare r record; n integer := 0;
   begin
     for r in
       select rep.id from public.reports rep
       where rep.work_status = 'completa' and rep.synced_at is null
         and rep.submitted_at < now() - min_age
     loop
       update public.reports set work_status = work_status where id = r.id; -- no-op update re-fires the trigger
       n := n + 1;
     end loop;
     return n;
   end $$;
   ```
   STOP-check first: open `020_lumen_bridge_webhook.sql` and confirm the trigger fires on `UPDATE OF work_status, synced_at`. A no-op `work_status = work_status` update qualifies as `UPDATE OF work_status` in Postgres (column listed in SET). If the trigger definition differs from that, adapt or STOP.
   Do NOT schedule pg_cron in this migration; mention in the report that the operator can `select cron.schedule(...)` if pg_cron is enabled.
4. Routing-code fix (verified defect — see Current state): correct the WC operator's LUMEN mapping in the same migration:
   ```sql
   update public.operators
     set config_json = jsonb_set(config_json, '{lumen,operator}', '"WESTC"')
   where code = 'WC'
     and config_json->'lumen'->>'operator' = 'WESTCONNECT';
   ```
   The `where` guard makes it a no-op if someone already fixed the config. IMPORTANT for the completion report: before the operator applies this, they must check LUMEN production for a manually created `WESTCONNECT` operator row (`select id, code, name from operators where code ilike 'westc%'`). If such a row exists AND has work_orders attached, the right fix is a business decision (merge the duplicate operators) — flag it instead of assuming.

**Verify**: file exists; `rg -c "lumen_sync_log" supabase/migrations/022_lumen_sync_log.sql` ≥ 3; `rg -c '"WESTC"' supabase/migrations/022_lumen_sync_log.sql` ≥ 1. Never execute it.

### Step 4: LUMEN detail-page NE4 panel

In `src/pages/admin/WorkOrderDetailPage.tsx`, directly ABOVE the internal-notes block (~line 1045), add a card rendered only for bridged orders:

```tsx
{(() => {
  const ext = order as { source?: string; external_metadata?: Record<string, unknown> | null }
  if (ext.source !== 'ne4' || !ext.external_metadata) return null
  const meta = ext.external_metadata
  return (
    <div className="rounded-l border border-info/40 bg-bg-1 p-5">
      <h3 className="mb-3 font-display text-sm font-semibold text-fg-1">{t('workOrder.ne4Panel.title')}</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(meta).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-fg-3 font-mono">{k}</dt>
            <dd className="text-fg-1">{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
})()}
```

Match the surrounding card idiom exactly (the component may use different helpers — adapt the markup to the neighboring cards; the structure above is the shape, not sacred text). Use the `--color-info` token family, never raw hex.

**Verify**: `npm run typecheck && npm run lint` → exit 0.

### Step 5: LUMEN demo fixture + i18n + tests

1. `src/lib/demo/fixtures.ts`: add ONE new work order fixture in status `rueckmeldung_sent` with `order_number: 'NE4-demo-0001'`, `line: 'NE4'`, `work_type: 'alta'`, `source: 'ne4'`, and an `external_metadata` object exercising the panel (ha, we_count, workflow_code, score, work_zones array). Follow the existing work-order fixture shape (ids/constants/state history pattern — copy an existing `rueckmeldung_sent`-state fixture if one exists, else the closest state and adjust). Existing fixtures need NO `source` field (UI treats missing as `'lumen'`).
2. i18n both locales: `workOrder.ne4Panel.title` → de "NE4 Außendienst-Daten" / es "Datos de campo NE4".
3. `schemaMigrations.test.ts`: assert migration 025 exists, `Depends on:` header, contains `source TEXT NOT NULL DEFAULT 'lumen'`.

**Verify**: `npm run preflight` → exit 0. `npm run dev:demo` → open the NE4 demo order's detail page → panel renders.

## Test plan

- LUMEN: schema assertion (migration 025); demo-mode visual check of the panel; full existing suite green (`npm run preflight`).
- ne4: run whatever check scripts its `package.json` exposes + `deno check` on the function if available. The edge function has no test harness — the idempotent upsert (`on_conflict=order_number`) is the safety net; do not invent one in this plan.

## Done criteria

ALL must hold:

- [ ] LUMEN `npm run preflight` exits 0
- [ ] `supabase/migrations/025_work_order_source.sql` (LUMEN) and `supabase/migrations/022_lumen_sync_log.sql` (ne4) exist with conventional headers; neither executed locally
- [ ] `rg -n "source: 'ne4'" /Users/jarl/Dev/ne4-work-manager/supabase/functions/lumen-bridge/index.ts` → match
- [ ] `rg -n "ne4Panel" src/pages/admin/WorkOrderDetailPage.tsx src/i18n/locales/de.json src/i18n/locales/es.json` → 3 matches
- [ ] Demo mode shows the NE4 panel on the seeded bridged order
- [ ] Completion report states the deploy order: LUMEN migration → redeploy `lumen-bridge` → ne4 migration
- [ ] No files outside the in-scope lists modified in either repo (`git status` in both)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- `work_orders` already has a `source`, `origin`, or `external_metadata`-like column.
- The bridge payload block (lines ~225-241) doesn't match the excerpt.
- The trigger in ne4's `020_lumen_bridge_webhook.sql` does NOT fire on `UPDATE OF work_status` (breaks the retry helper's no-op-update mechanism).
- ne4 migration `022` collides with an existing file under either numbering scheme in that repo.
- Anyone asks you to deploy the edge function or apply SQL — deployment is the operator's task; the sequencing constraint makes ad-hoc deploys dangerous.

## Maintenance notes

- **Deploy order is load-bearing** (LUMEN migration → function deploy → ne4 migration). If the function deploys first, every sync fails with an unknown-column error until the LUMEN migration lands — visible in `lumen_sync_log` only AFTER the ne4 migration, so don't reorder.
- Deferred on purpose: `work_type` is still hardcoded `'alta'` (needs a business mapping from ne4 `workflow_code`/`installation_type`); pre-completion NE4 states remain invisible to LUMEN; NE4 photos stay in ne4's storage. Each is a candidate follow-up plan.
- Future bidirectional sync (LUMEN certification status → ne4) now has its hook: `external_metadata.report_id` is the typed back-reference.
- Reviewer should scrutinize: the backfill UPDATE (it keys on the `NE4-%` order-number convention — confirm no manually created LUMEN orders use that prefix) and that `lumen_sync_log` has no anon-readable policy.
