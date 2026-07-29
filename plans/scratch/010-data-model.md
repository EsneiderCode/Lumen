# Plan 010 — Client-first data model
## Outcome
New work orders use `client → project + client catalog → executor` as their
authoritative routing. Operator and NE3/NE4 line disappear from the new-order
contract, while historical rows and the existing NE4 bridge remain readable.
The executor category is persisted on the order so certification rules never
depend on a mutable profile role.
## Decisions
| Topic | Decision |
|---|---|
| Client | Promote `clients` to admin-managed master data. Every active project and every selectable service/rate belongs to exactly one client. |
| Project | Require `projects.client_id`; uniqueness becomes `(client_id, code)`, allowing different clients to reuse a project code. |
| Catalog | Keep `service_items` as the client-owned SKU/rate row. Existing global/operator-scoped rows become legacy-only; do not add a second catalog table. |
| Operator | **Keep for history, de-scope for new flow.** Make `work_orders.operator_id` nullable, stop new UI/service writes, and retain `operators`, the FK, and old values because PDFs, DATEV and the NE4 bridge consume them (`plans/scratch/010-exploration.md:79-84`). |
| NE3/NE4 line | Apply the same compatibility policy to `work_orders.line`: nullable and omitted for new orders, preserved on legacy/NE4 rows. Do not touch RA/RD `segment_kind` or POP/DP (`plans/scratch/010-exploration.md:8,85`). |
| Executor | Persist `executor_type = own_team | external_contractor`; never derive the certification path from `profiles.role` as today (`src/services/workOrderService.ts:139-157`). |
| Personnel | Normalize own teams, reuse `employees` for own personnel, and reuse top-level `compliance_entities` (`company`/`freelancer`) for contractors. Do **not** create a duplicate contractors table. |
| Certification | Own work goes directly from submitted Rückmeldung to client certification. Contractor work requires Nexus internal certification first, then client certification. |
| Compatibility | Add `flow_version`: existing rows stay v1; only the new form creates v2. This preserves direct orders and unresolved historical assignments without inventing data. |
## Target schema
### `clients` (changed)
Existing columns remain: `id`, `name`, `code`, `is_active`, `created_at`
(`supabase/migrations/001_initial_schema.sql:50-56`).

- Add `updated_at timestamptz NOT NULL DEFAULT now()` and `notes text NULL`;
  attach `handle_updated_at()`.
- Keep `code` and `name` unique. Referenced clients are deactivated, never hard
  deleted.
- Admin CRUD owns create/edit/activate/deactivate. Existing authenticated
  read/admin-write RLS is the baseline (`supabase/migrations/001_initial_schema.sql:354-360`).
### `projects` (changed)
- Make `client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT`.
- Replace global unique `code` with `UNIQUE (client_id, code)` and add
  `(client_id, is_active, name)` index.
- Deprecate `default_operator_id` and `default_line`; the new flow never reads
  them. Drop them only in the post-cutover cleanup migration.
- Client change in admin CRUD must be rejected once orders reference the
  project; create a new project instead. Current CRUD is in
  `src/services/projectService.ts:60-136`.
### `service_items` (changed, no replacement table)
The table already contains client/operator FKs, both price columns and
catalog metadata (`supabase/migrations/004_service_catalog_seed.sql:12-34`;
`supabase/migrations/006_collaborator_pricing.sql:13-34`).

- Add `legacy_only boolean NOT NULL DEFAULT false`.
- Add `CHECK (legacy_only OR client_id IS NOT NULL)`.
- Add partial `UNIQUE (client_id, code) WHERE NOT legacy_only`.
- New/admin-edited selectable rows require `client_id`, may not change client
  after use, and write `operator_id = NULL`.
- `operator_id` remains nullable legacy metadata but is removed from
  applicability. New queries are exactly
  `client_id = :client AND active AND NOT legacy_only`.
- Preserve the price snapshot boundary: do not rewrite historical
  `work_orders.service_item_id` or `work_order_billing_lines`
  (`supabase/migrations/005_direct_orders_and_billing.sql:94-115`).
- Recreate `service_items_public` without prices and include `client_id` so
  field flows can enforce client scope.
### `teams` (new) and personnel links
`team_color` is currently an enum, not master data
(`supabase/migrations/001_initial_schema.sql:12-20`;
`supabase/migrations/040_expand_team_colors.sql:16-23`).

Create `teams`:

| Column | Definition |
|---|---|
| `id` | UUID PK |
| `code` | TEXT, unique, stable |
| `display_name` | TEXT, required |
| `color_key` | existing `team_color`; unique only among active teams |
| `is_active` | BOOLEAN default true |
| timestamps | `created_at`, `updated_at` |

- Seed one row for every current color; admin CRUD may rename/deactivate teams.
  Hard delete is restricted once referenced.
- Add nullable `team_id REFERENCES teams(id) ON DELETE RESTRICT` to `employees`
  and `profiles`; backfill from their legacy `team` enum.
- Keep the enum columns during compatibility. Services dual-write until all
  consumers use `team_id`; remove them only in a later dedicated migration.
- Own employee CRUD stays on `employees` (`src/services/employeeService.ts:68-126`).
- External collaborator CRUD stays on `compliance_entities`; it already models
  companies, freelancers, workers and internal employees and links profiles/
  employees (`supabase/migrations/042_compliance_core.sql:98-144,508-543`;
  `src/services/complianceService.ts:253-334`).

### `work_orders` (changed)

Add:

| Column | Definition |
|---|---|
| `flow_version` | SMALLINT NOT NULL DEFAULT 1, check in `(1,2)` |
| `executor_type` | new enum `work_order_executor_type` (`own_team`, `external_contractor`), nullable only for v1 |
| `executor_team_id` | UUID NULL FK `teams(id)` ON DELETE RESTRICT |
| `executor_entity_id` | UUID NULL FK `compliance_entities(id)` ON DELETE RESTRICT |

Rules enforced by one `BEFORE INSERT/UPDATE` validator:

- v2 requires active `client_id`, a project owned by that client, and a
  non-legacy service item owned by that client.
- v2 `own_team` requires `executor_team_id` and/or `executor_entity_id`; any
  entity must be an active `internal_employee` and match the team when both exist.
- v2 `external_contractor` requires no team and an active top-level
  `executor_entity_id` of kind `company` or `freelancer`.
- Freeze client/project/service/executor routing at `in_progress`; a later
  change requires an audited rollback/reassignment flow, not a direct update.
- Make `operator_id` and `line` nullable. v1 keeps both required via the
  validator; v2 omits both.
- Retain `assigned_team`, `assigned_technician` and
  `assigned_collaborator_id` as compatibility/access fields. They are not the
  canonical executor and must agree with it when populated. The last field is
  currently schema-only outside generated types
  (`src/types/database.types.ts:2575-2745`).
- The external entity is the contractual executor; `assigned_technician`
  remains the portal/field-access profile. `company_worker` may be a worker,
  but not the contractual executor.

## State machine and certification guards

### v2 own-team path

```text
created → assigned → in_progress → executed → rueckmeldung_pending
→ rueckmeldung_sent → sent_to_client → client_accepted → invoiced → paid
```

- `rueckmeldung_sent → internally_certified` is forbidden.
- `send_work_order_to_client_checked()` accepts `rueckmeldung_sent`, validates
  Rückmeldung completeness, and atomically writes status/history.

### v2 external-contractor path

```text
created → assigned → in_progress → executed → rueckmeldung_pending
→ rueckmeldung_sent → internally_certified → sent_to_client
→ client_accepted → invoiced → paid
```

- `certify_work_order_internal()` additionally requires
  `executor_type = external_contractor`, a compliant project assignment/
  permitted override, complete evidence, and an internal audit.
- `send_work_order_to_client_checked()` requires
  `internally_certified` plus an internal audit created after the latest
  submitted Rückmeldung.

### Shared rules

- `accept_work_order_client()` remains the atomic client-audit transition;
  invoicing requires `client_accepted` and a client audit
  (`supabase/migrations/016_mvp_business_logic_hardening.sql:356-439`).
- For v2, `client_rejected → rueckmeldung_pending`. Corrected evidence must
  traverse the applicable branch again; immutable old audits remain history.
- `cert_type='external'` remains the separate contractor settlement audit; it
  does not satisfy the Nexus internal-certification guard
  (`src/services/workOrderService.ts:1010-1066`).
- v1 retains the current transition function, including the direct-order
  invoicing shortcut (`supabase/migrations/005_direct_orders_and_billing.sql:156-184`).
- Revoke direct status updates for certification-sensitive transitions and
  grant only the checked RPCs. Every RPC must lock the order, validate, update,
  and append history in one transaction.

## Migration sequence

Current verification is asymmetric: `origin/develop` ends at 062, but checked
out `develop`/`upstream/develop` contain 063 and 064
(`plans/scratch/010-exploration.md:99-100`). Resolve the remote alias before
implementation; assuming the active source-of-truth line is through 064:

1. `065_client_master_data.sql` — `-- Depends on: 064_work_order_site_reference.sql`.
   Extend clients; backfill/enforce project ownership and client-scoped code
   uniqueness.
2. `066_client_owned_service_catalog.sql` — `-- Depends on: 065_client_master_data.sql`.
   Add `legacy_only`, catalog constraints/indexes, public view and RLS.
3. `067_executor_master_data.sql` — `-- Depends on: 066_client_owned_service_catalog.sql`.
   Create/seed teams, add personnel team FKs and RLS.
4. `068_client_first_work_order_routing.sql` — `-- Depends on: 067_executor_master_data.sql`.
   Add flow/executor columns, FKs/validator/indexes, backfill known executors,
   and relax operator/line nullability.
5. `069_executor_certification_paths.sql` — `-- Depends on: 068_client_first_work_order_routing.sql`.
   Replace transition guards/RPCs/grants and preserve the v1 branch.
6. `070_remove_project_routing_defaults.sql` — `-- Depends on: 069_executor_certification_paths.sql`.
   **Post-deploy only:** after the old app no longer reads them, drop
   `projects.default_operator_id/default_line`; keep work-order history fields.

Each migration must be idempotent where practical, transactional, and include
preflight assertions. Ship only `.sql`; the repository owner applies it.
Re-run `git ls-tree` immediately before reserving numbers.

## Backfill and rollout

1. Derive a project client only when all non-null historical order/client
   evidence agrees. Export unresolved or conflicting projects for explicit
   admin mapping; abort 065 rather than guess or create a pseudo-client.
2. Mark existing global/operator-only service rows `legacy_only = true`.
   Preserve them for old orders. Ship an explicit, owner-reviewed mapping CTE
   that clones required rows into each client catalog; do not infer client from
   operator alone.
3. Seed teams and backfill `team_id` from enum colors.
4. Keep every existing order `flow_version = 1`. For reporting only, backfill
   canonical executors when deterministic: contractor profile →
   `compliance_entities.profile_id`; internal profile →
   `employees.profile_id` → internal compliance entity; team color → team ID.
   Leave unresolved v1 orders null—never classify them as own work by default.
5. Deploy backward-compatible migrations 065–069, then services/UI that write
   `flow_version = 2`; apply 070 only after old-client telemetry is clear.
6. Do not rewrite historical statuses, certification audits, billing lines,
   operator/line, or NE4 rows. The bridge continues inserting v1 with its
   existing operator and hardcoded NE4 contract
   (`plans/scratch/010-exploration.md:82-84`).

## Service and RLS changes

- Add client CRUD service/page; update project CRUD to require client.
- Change `fetchProjects(clientId)` from optional to required in the new form;
  change catalog fetches to client-only. Remove operator from
  `src/services/serviceItemService.ts` applicability and mirror this in
  `src/services/rueckmeldungLoader.ts`.
- Add executor option queries: active teams/internal employees versus active
  top-level external entities. Never expose employee payroll columns; return a
  minimal ID/name/team view or RPC.
- Assignment writes canonical executor plus compatibility access fields and
  runs the existing project-aware compliance check for external entities
  (`src/pages/admin/WorkOrderAssignPage.tsx:107-169`).
- Use permission-based admin policies for client/project/catalog/team CRUD.
  Authenticated users read active master data only; prices remain admin-only.
- Extend work-order RLS so an external portal profile sees orders whose
  `executor_entity_id` it owns via `owns_compliance_entity()`
  (`supabase/migrations/042_compliance_core.sql:273-289,339-361`).
- Update PDF/DATEV/UI joins to render operator/line only when historical
  values exist; remove them from v2 required types. Keep scheduler
  appointment operator/line untouched.

## Generated types, demo mode and tests

- After the owner applies all migrations, regenerate
  `src/types/database.types.ts`; never edit it manually.
- Extend `src/lib/demo/fixtures.ts` with client-owned projects/catalog rows,
  teams/team links, both executor types, both v2 certification paths, a
  rejected/resubmitted example, and unchanged v1 direct/NE4 examples.
- Extend `src/lib/demo/supabase-mock.ts` for the new teams table, executor
  filters/joins and checked certification/send/rejection RPCs. Keep
  `service_items_public` price-free even though it aliases fixture data today
  (`plans/scratch/010-exploration.md:101-102`).
- Add demo-store row migration/versioning in `src/lib/demo/store.ts`; fixture
  changes alone do not hydrate new fields in existing localStorage
  (`plans/scratch/010-exploration.md:104`).
- Test DB guards, RLS, backfill conflicts, client/project/service mismatch,
  executor-kind mismatch, executor immutability, both state branches, legacy
  v1 compatibility, billing snapshots, and NE4 bridge compatibility.
