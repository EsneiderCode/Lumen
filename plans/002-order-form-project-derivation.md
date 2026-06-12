# Plan 002: Derive client, operator and line from the selected project in the new-order form

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 759eb55..HEAD -- src/pages/admin/WorkOrderFormPage.tsx src/services/projectService.ts src/services/workOrderService.ts src/components/admin/ProjectFormModal.tsx src/lib/demo/fixtures.ts supabase/migrations/`
> Plan 001 legitimately touches WorkOrderFormPage's service-item `<select>` —
> that diff is expected. Any OTHER mismatch with the excerpts below is a STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the order-creation critical path)
- **Depends on**: plans/001-service-catalog-categories.md (same file: `WorkOrderFormPage.tsx` — execute after it to avoid conflicts)
- **Category**: direction
- **Planned at**: commit `759eb55`, 2026-06-10

## Why this matters

The "Nueva orden" form asks the admin for Cliente, Proyecto, Operador and Línea
separately, even though in this business a project implies its client (already
in the DB) and almost always implies its operator and line. The admin re-enters
derivable data on every order. After this plan: the admin picks the **project
first**, and Cliente/Operador/Línea auto-fill from it (still overridable for
edge cases, since historical data shows one project occasionally serving two
operators).

## Current state

Repo: `/Users/jarl/Dev/Lumen-esneider` — React 19 + TypeScript + Vite + Supabase.

- `projects` table (migration `001_initial_schema.sql`): `id, code, name, client_id UUID NULL FK, is_active, created_at`. **No operator or line columns.** `work_orders` stores `client_id` (nullable = direct order), `operator_id` (NOT NULL), `line` (TEXT NOT NULL CHECK IN ('NE3','NE4')) denormalized on every row — that stays unchanged; this plan only changes how the form fills them.
- `src/services/projectService.ts`:
  - lines 9-17 `Project` interface: `{ id, code, name, client_id, is_active, created_at, clients }` (hand-written, safe to edit).
  - lines 19-23 `ProjectInput`: `{ code, name, client_id }`.
  - lines 73-79 `normalizeInput` — builds the insert/update payload; new fields must pass through here or they are silently dropped.
  - Queries use `select('*, clients(id, code, name)')` — `*` picks up new columns automatically.
- `src/services/workOrderService.ts` lines 264-269 `fetchProjects`: `select('id, name, code, client_id')` — **explicit column list; must gain the new columns**.
- `src/components/admin/ProjectFormModal.tsx`: `EMPTY_FORM = { code: '', name: '', client_id: null }` (line 11); fields: code, client select, name. Receives `clients` via props from `ProjectsPage.tsx`. No operator/line fields.
- `src/pages/admin/WorkOrderFormPage.tsx` (all line numbers at commit 759eb55):
  - lines 114-116: lookup state `clients` / `projects` (with `client_id`) / `operators`.
  - lines 183-185: `filteredProjects` — projects filtered by selected client (client-first flow).
  - lines 187-191 `setField`:
    ```ts
    function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
      setForm((f) => ({ ...f, [key]: value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
      if (key === 'client_id') setForm((f) => ({ ...f, client_id: value as string, project_id: '' }))
    }
    ```
  - lines 197-211 `validate()`: `client_id` required unless `is_direct_order`; `project_id`, `operator_id`, `service_item_id` required.
  - lines 143-149: service items re-fetch when `form.operator_id` changes — auto-derivation triggers this exactly once per project pick; no change needed.
  - lines 152-180: edit mode loads an existing order into the form — derivation must NOT clobber values when editing.
  - Field markup: Client select lines 364-382 (hidden when `is_direct_order`), Project select lines 384-400, Operator select lines 402-418, Line select lines 420-431.
- Demo fixtures `src/lib/demo/fixtures.ts` lines 115-119: 3 projects with only `client_id`. Operators fixture (lines 121-125): `OP_DGF` (code DGF), `OP_GFPLUS` (GFPLUS), `OP_UGG` (UGG).
- Conventions: migrations numbered against EsneiderCode/Lumen develop, header with `Depends on:`; never apply SQL locally; never edit `src/types/database.types.ts` — use the existing cast pattern (`.insert(payload as never)`) if typecheck complains about new columns. i18n keys must exist in BOTH `src/i18n/locales/de.json` and `es.json` (`i18nLocaleKeys.test.ts` enforces parity). UI follows NEXUS tokens (no hardcoded hex).

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Lint      | `npm run lint`       | exit 0              |
| Tests     | `npm test`           | all pass            |
| All gates | `npm run preflight`  | exit 0              |

## Scope

**In scope**:
- `supabase/migrations/023_project_defaults.sql` (create — confirm numbering, Step 1)
- `src/services/projectService.ts`
- `src/services/workOrderService.ts` (ONLY `fetchProjects`, lines 264-269)
- `src/components/admin/ProjectFormModal.tsx`
- `src/pages/admin/ProjectsPage.tsx` (ONLY to fetch/pass operators to the modal)
- `src/pages/admin/WorkOrderFormPage.tsx`
- `src/lib/orderFormDefaults.ts` (create — pure derivation helper)
- `src/lib/demo/fixtures.ts`
- `src/i18n/locales/de.json`, `src/i18n/locales/es.json`
- `src/__tests__/orderFormDefaults.test.ts` (create), `src/__tests__/schemaMigrations.test.ts` (extend)

**Out of scope** (do NOT touch):
- `work_orders` schema, `createWorkOrder`, the submit payload shape — `client_id`/`operator_id`/`line` keep being written denormalized; downstream filters, DATEV export, RLS and the status-transition trigger depend on that.
- The direct-order mechanism (`is_direct_order` → `client_id: null`) — keep exactly as is.
- The service-item `<select>` block (owned by Plan 001).
- `src/types/database.types.ts`.

## Git workflow

- Branch: `feat/order-form-project-derivation`. Conventional commits, NO `Co-Authored-By`. Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm migration number

Same procedure as Plan 001 Step 1. Expected: `023`, `Depends on: 022_service_item_categories.sql` (Plan 001's migration). If Plan 001 was renumbered or not yet merged, depend on whatever the highest migration on the EsneiderCode develop branch + local branch is, and report the final numbering in plans/README.md.

### Step 2: Migration `023_project_defaults.sql`

Conventional header, then:

```sql
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_operator_id UUID REFERENCES public.operators(id),
  ADD COLUMN IF NOT EXISTS default_line TEXT CHECK (default_line IN ('NE3', 'NE4'));

COMMENT ON COLUMN public.projects.default_operator_id IS
  'Pre-fills work_orders.operator_id in the new-order form. Overridable per order.';
COMMENT ON COLUMN public.projects.default_line IS
  'Pre-fills work_orders.line in the new-order form. Overridable per order.';
```

Both columns nullable on purpose: existing projects keep working; the form falls back to manual selection when a default is missing. No RLS change needed (projects policies are simple authenticated-read / admin-write; verify nothing references column lists: `rg -n "projects" supabase/migrations/001_initial_schema.sql | rg -i policy`).

**Verify**: file exists; `rg -c "default_operator_id" supabase/migrations/023_project_defaults.sql` ≥ 1. Never execute it.

### Step 3: Service layer

1. `src/services/projectService.ts`:
   - `Project`: add `default_operator_id: string | null` and `default_line: 'NE3' | 'NE4' | null`.
   - `ProjectInput`: add the same two fields (optional or nullable, matching the existing style).
   - `normalizeInput`: pass them through (`default_operator_id: input.default_operator_id || null`, `default_line: input.default_line || null`).
   - If typecheck rejects insert/update payloads because `database.types.ts` lacks the columns, cast at the call site (`.insert(payload as never)` — pattern from `serviceItemService.ts:119`).
2. `src/services/workOrderService.ts` `fetchProjects` (line 265): change select to `'id, name, code, client_id, default_operator_id, default_line'`.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Project form modal

1. `src/pages/admin/ProjectsPage.tsx`: fetch operators (`fetchOperators` from `@/services/workOrderService` — same import pattern as `ServiceItemsPage.tsx:13`) alongside the existing clients fetch, and pass `operators` to `<ProjectFormModal>`.
2. `src/components/admin/ProjectFormModal.tsx`:
   - Extend `Props` with `operators: { id: string; code: string; name: string }[]`.
   - `EMPTY_FORM`: add `default_operator_id: null, default_line: null`.
   - Initialize from `project` in edit mode (like `client_id` at line 30).
   - Add two selects after the Name field, following the existing client-select markup (lines 108-120): "Standard-Operator" (empty option `— kein Standard —`) and "Standard-Linie" (empty / NE3 / NE4). Labels via the modal's existing `<T de="..." />` pattern.

**Verify**: `npm run typecheck && npm run lint` → exit 0.

### Step 5: Pure derivation helper

Create `src/lib/orderFormDefaults.ts`:

```ts
export interface ProjectDefaultsSource {
  id: string
  client_id: string | null
  default_operator_id?: string | null
  default_line?: 'NE3' | 'NE4' | null
}

/**
 * Values to merge into the order form when the admin picks a project.
 * Only returns keys that the project can actually determine, so callers
 * never clobber a manually chosen value with undefined.
 */
export function deriveOrderDefaultsFromProject(project: ProjectDefaultsSource | undefined): {
  client_id?: string
  operator_id?: string
  line?: 'NE3' | 'NE4'
} {
  if (!project) return {}
  const out: { client_id?: string; operator_id?: string; line?: 'NE3' | 'NE4' } = {}
  if (project.client_id) out.client_id = project.client_id
  if (project.default_operator_id) out.operator_id = project.default_operator_id
  if (project.default_line) out.line = project.default_line
  return out
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 6: Rework `WorkOrderFormPage.tsx` to project-first

All edits inside this file:

1. **Project options**: render ALL active projects (remove the `filteredProjects` computation at lines 183-185 and use `projects` directly in the project select). Option label: `{p.code} – {p.name}`.
2. **Derivation**: in `setField`, replace the `client_id` reset branch with a `project_id` branch:
   ```ts
   if (key === 'project_id') {
     const project = projects.find((p) => p.id === value)
     const defaults = deriveOrderDefaultsFromProject(project)
     setForm((f) => ({ ...f, project_id: value as string, ...defaults }))
   }
   ```
   Notes: spread AFTER `project_id` so derived values land; do NOT reset `client_id` when it is absent from `defaults` (project without client = likely direct-order project; leave the field for manual choice). The existing service-items effect on `form.operator_id` (lines 143-149) re-fetches automatically.
3. **Layout / visual simplification**: move the Project select to the FIRST position in the grid (before the client select). Wrap the Cliente, Operador and Línea fields in a native `<details>` block placed after the project field:
   ```tsx
   <details className="sm:col-span-2 rounded-s border border-line bg-bg-0 p-3" open={!form.project_id}>
     <summary className="cursor-pointer text-xs font-medium text-fg-2">
       {t('workOrder.derivedData')}{derivedSummary && <span className="ml-2 font-mono text-fg-3">{derivedSummary}</span>}
     </summary>
     <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{/* existing three fields, unchanged markup */}</div>
   </details>
   ```
   where `derivedSummary` is a string like `INSYTE · DGF · NE3` computed from the current form values and the loaded lookup lists (client code, operator code, line). Keep the three `<select>`s fully functional inside — they are the override path. The `is_direct_order` checkbox stays where it is (outside the details block) and keeps hiding the client select.
4. **Edit mode**: derivation only runs through `setField('project_id', ...)` (user interaction), so loading an existing order via `setForm` in the edit effect (lines 156-169) is untouched. Confirm you did not add derivation anywhere in that effect.
5. **Validation**: unchanged. With derivation, `operator_id` may still be empty when the project has no default — the existing required-field error guides the user to open the details block. Improve the operator error message only if a key exists; do not invent new validation.

**Verify**: `npm run typecheck && npm run lint` → exit 0. Then `npm run dev:demo`, log in as `admin@demo.lumen` / `demo123`, open Nueva orden: picking project HXT must auto-fill client INSYTE; the details block shows the summary; creating an order still works end-to-end (it lands on the assign page).

### Step 7: Demo fixtures

`src/lib/demo/fixtures.ts` lines 115-119 — extend the 3 projects:
- HXT: `default_operator_id: OP_DGF, default_line: 'NE3'`
- RSD: `default_operator_id: OP_DGF, default_line: 'NE3'`
- WCB: `default_operator_id: OP_GFPLUS, default_line: 'NE4'`

**Verify**: `npm test` → all pass (demo business-logic suite consumes fixtures).

### Step 8: i18n + tests

1. Add to BOTH locale files: `workOrder.derivedData` → de "Abgeleitet vom Projekt (bei Bedarf anpassen)" / es "Derivado del proyecto (ajustar si hace falta)".
2. Create `src/__tests__/orderFormDefaults.test.ts` (model after `workOrderBusinessRules.test.ts` — pure functions): undefined project → `{}`; project with all three → all three returned; project with `client_id` only → only `client_id`; `default_line` null → key absent.
3. Extend `src/__tests__/schemaMigrations.test.ts`: migration 023 exists, declares its `Depends on:`, contains `default_operator_id`.

**Verify**: `npm run preflight` → exit 0.

## Test plan

- New: `orderFormDefaults.test.ts` (4 cases above) + schema assertion for 023.
- Regression watch: `workOrderService.test.ts` and `datevExportService.test.ts` must stay green — they pin the denormalized `client_id`/`operator_id` on work_orders, which this plan must not change.
- Manual demo-mode walkthrough (Step 6 verify) is REQUIRED — this is the order-creation critical path.

## Done criteria

- [ ] `npm run preflight` exits 0
- [ ] `supabase/migrations/023_project_defaults.sql` exists, conventional header, never executed locally
- [ ] `rg -n "deriveOrderDefaultsFromProject" src/pages/admin/WorkOrderFormPage.tsx` → match
- [ ] `rg -n "filteredProjects" src/pages/admin/WorkOrderFormPage.tsx` → NO match
- [ ] Demo-mode walkthrough done: project pick auto-fills client/operator/line; order creation reaches the assign page
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- `projects` already has operator/line columns under any name.
- `setField` at WorkOrderFormPage lines 187-191 doesn't match the excerpt (drift).
- Removing `filteredProjects` breaks a consumer you can find via `rg -n "filteredProjects" src/` outside this file.
- The demo walkthrough cannot create an order after your changes and one fix attempt fails.
- You find a real data dependency that contradicts the "project implies operator" assumption in PRODUCTION data semantics (e.g. a constraint or service that requires choosing operator per order independent of project) — the override path should cover it, but report rather than redesign.

## Maintenance notes

- ADVISOR ASSUMPTION, confirm with the owner when convenient: demo data contains one project (HXT) with orders under two different operators, so the columns are named `default_*` and remain overridable rather than enforced. If the business later guarantees one operator per project, tighten with NOT NULL + remove the override UI.
- Backfilling `default_operator_id`/`default_line` for EXISTING production projects is deliberately out of scope (requires business knowledge); admins set them via the project modal. Until then those projects just keep the manual flow.
- Reviewer should scrutinize: edit-mode behavior (no clobbering), and direct orders (client select hidden, `client_id: null` on submit) still working.
