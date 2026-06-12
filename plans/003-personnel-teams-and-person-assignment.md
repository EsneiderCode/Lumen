# Plan 003: Team assignment for personnel and person-level work-order assignment

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 759eb55..HEAD -- src/services/employeeService.ts src/services/workOrderService.ts src/services/workOrderBusinessRules.ts src/pages/admin/PersonnelPage.tsx src/pages/admin/WorkOrderAssignPage.tsx src/lib/demo/fixtures.ts supabase/migrations/`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (touches assignment write path and a business rule)
- **Depends on**: plan 002 COMMITTED first (see Preconditions below); plan 005 recommended first (restores the `preflight` gate this plan's done criteria rely on). Migration: `024`, `Depends on: 023_project_defaults.sql` (023 confirmed to exist).
- **Category**: direction
- **Planned at**: commit `759eb55`, 2026-06-10 — **refreshed 2026-06-11** after plans 001/002 landed in the tree

## Preconditions (refreshed 2026-06-11 — read before the drift check)

1. **Plan 002's work must be committed before you start.** At refresh time it
   sat UNCOMMITTED on branch `feat/order-form-project-derivation` (9 modified +
   3 new files). It touches three files this plan also touches —
   `src/lib/demo/fixtures.ts`, `src/i18n/locales/*.json`,
   `src/services/workOrderService.ts` — so an uncommitted base makes your drift
   check and your diffs meaningless. If `git status` shows those files modified,
   STOP and ask the operator to commit first.
2. **Line numbers below have shifted** relative to the original excerpts:
   plan 002 added a `ProjectLookup` interface and expanded `fetchProjects` in
   `workOrderService.ts` (≈ +15 lines above `assignWorkOrder`, now ≈ lines
   414-456), and the `projects` fixture block in `fixtures.ts` grew. **Locate
   every target by symbol name, not by line number**; the code excerpts
   themselves are still accurate.
3. Run the drift check against the commit that contains plan 002's work (the
   current `HEAD` once precondition 1 holds), not against `759eb55`.
4. `npm run preflight` only exits 0 once plan 005 (LoginPage conditional-hook
   fix) has landed; until then run the three gates separately and treat the
   pre-existing LoginPage lint ERROR as out of scope.

## Why this matters

Today LUMEN has two disconnected personnel populations: internal payroll
employees (`employees` table, PersonnelPage — no team concept at all) and
operational app users (`profiles` table, UsersPage — technicians = internal,
contractors = external, with a `team` column). Work orders are assigned only
to a team color; `assigned_technician` is explicitly cleared at assignment, so
the contractor document-blocking business rule can only fire later, at
certification. After this plan: employees can be assigned to teams and linked
to their app user; the assign step optionally picks the concrete person
(internal or external, visually distinguished); assigning a non-compliant
external contractor is blocked at assignment time — which is what the
business rule ("expired docs → assignment blocked") actually demands.

## Current state

Repo: `/Users/jarl/Dev/Lumen-esneider` — React 19 + TS + Vite + Supabase.

- `supabase/migrations/019_employees_and_vacations.sql` — `employees` table: `id, full_name, email, phone, sv_nummer, steuer_id, steuerklasse, iban, gross_salary, start_date, end_date, notes, is_active, created_at, updated_at`. **No `team`, no link to `profiles`.**
- `profiles` (migration 001): has `team team_color` (Postgres enum, values rot/gruen/blau/gelb — verify with `rg -n "CREATE TYPE team_color" supabase/migrations/001_initial_schema.sql`), `role` (`admin|technician|contractor`), `is_active`. Indexed `idx_profiles_team`.
- `src/services/employeeService.ts` lines 5-36 — `Employee` and `EmployeePayload` interfaces (hand-written; no team/profile fields). CRUD: `fetchEmployees`, `createEmployee`, `updateEmployee`, `deactivateEmployee` + vacation CRUD.
- `src/pages/admin/PersonnelPage.tsx` — full employee CRUD UI. `EMPTY_FORM: EmployeePayload` at line 18; modal sets fields via `set(key, value)` (line 64); payload assembled ~line 79.
- `src/pages/admin/UsersPage.tsx` — operational users CRUD. Team select pattern at lines 197-209:
  ```tsx
  <select value={form.team} onChange={(e) => updateForm('team', e.target.value as TeamColor | '')}>
    ...
    <option value="rot">{t('teamColor.rot')}</option>
    <option value="gruen">{t('teamColor.gruen')}</option>
    <option value="blau">{t('teamColor.blau')}</option>
    <option value="gelb">{t('teamColor.gelb')}</option>
  </select>
  ```
  (i18n keys `teamColor.*` already exist in both locales.)
- `src/pages/admin/WorkOrderAssignPage.tsx` — team-only assignment. Submit at lines 42-69 calls `assignWorkOrder(id, selectedTeam, assignedDate || null, user.id)`. Team buttons from `TEAMS` (`@/constants/styles`).
- `src/services/workOrderService.ts`:
  - `fetchTechnicians()` lines 280-288: profiles `select('id, full_name, team, role')` where `role IN ('technician','contractor')` and `is_active` — exactly the person list needed; currently only used by CertificationPage.
  - `assignWorkOrder(id, team, assignedDate, changedBy)` lines 399-441: updates `work_orders` with `assigned_team: team, assigned_technician: null, assigned_date, status: 'assigned'`, then inserts a `work_order_state_history` row with note `` `Zugewiesen an Team ${team ?? '-'}` ``.
- Contractor doc blocking (already wired, keys off `work_orders.assigned_technician`):
  - Pure logic: `src/services/workOrderBusinessRules.ts:68-115` `buildContractorDocumentFailureReasons(documents, assignmentDate)` → `WorkOrderActionReason[]` with codes `contractor_documents_missing | contractor_documents_unapproved | contractor_documents_expired`.
  - Enforcement today: at certification (`workOrderService.ts:~977` + DB trigger in migration `011_contractor_documents.sql:158-193`).
  - Documents are fetched per contractor via `src/services/contractorDocumentService.ts` (check exact export with `rg -n "^export" src/services/contractorDocumentService.ts` before using).
- Demo: `src/lib/demo/fixtures.ts` has NO `employees` / `vacation_requests` keys in `DemoStore` (line ~518) — PersonnelPage is dead in demo mode. The mock (`supabase-mock.ts:830-832`) resolves `from(table)` generically over `DemoStore` keys, so adding the keys + arrays makes the page work. Fixture profiles: 1 admin, 1 technician (`team: 'rot'`), 1 contractor (`team: null`) at lines 56-108; contractor has 5/6 doc types (intentionally non-compliant — good for testing the block).
- Tests: `src/__tests__/workOrderService.test.ts` covers `assignWorkOrder`; `workOrderBusinessRules.test.ts` covers the doc-failure pure logic. `npm run preflight` = typecheck + lint + test.
- Conventions: migrations as in Plans 001/002 (numbered, `Depends on:` header, never executed locally); no edits to `database.types.ts` (use `as never` casts); i18n keys in BOTH de.json and es.json; NEXUS design tokens.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Lint      | `npm run lint`       | exit 0              |
| Tests     | `npm test`           | all pass            |
| All gates | `npm run preflight`  | exit 0              |

## Scope

**In scope**:
- `supabase/migrations/024_employee_teams.sql` (create — confirm number)
- `src/services/employeeService.ts`
- `src/services/workOrderService.ts` (ONLY `assignWorkOrder`)
- `src/services/workOrderBusinessRules.ts` (add one pure helper)
- `src/pages/admin/PersonnelPage.tsx`
- `src/pages/admin/WorkOrderAssignPage.tsx`
- `src/lib/demo/fixtures.ts`
- `src/i18n/locales/de.json`, `src/i18n/locales/es.json`
- `src/__tests__/workOrderBusinessRules.test.ts`, `src/__tests__/workOrderService.test.ts`, `src/__tests__/schemaMigrations.test.ts` (extend)

**Out of scope** (do NOT touch):
- `UsersPage.tsx` and the `admin-users` edge function — external contractors keep being managed there; this plan links and surfaces, it does not merge the two CRUDs.
- The certification-time doc enforcement (service + DB trigger from migration 011) — it stays as the second enforcement layer.
- Payroll/vacation logic in PersonnelPage.
- PIN/team login (`teamPinService.ts`, `pinSession.ts`).
- `src/types/database.types.ts`.

## Git workflow

- Branch: `feat/personnel-teams-person-assignment`. Conventional commits, NO `Co-Authored-By`. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Migration `024_employee_teams.sql`

Confirm the number against the EsneiderCode develop branch (procedure in Plan 001 Step 1; expected `024`, `Depends on: 023_project_defaults.sql` — adjust to actual predecessor). Contents:

```sql
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS team team_color,
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_employees_team ON public.employees (team);

COMMENT ON COLUMN public.employees.team IS
  'Field team this internal employee works in (rot/gruen/blau/gelb). Nullable: office staff have no team.';
COMMENT ON COLUMN public.employees.profile_id IS
  'Optional link to the employee''s app login (profiles). Lets the roster show app access and team consistency.';
```

(Confirm the enum type is named `team_color` first — see Current state. If it has another name, use that name and note it.)

**Verify**: file exists; `rg -c "ADD COLUMN IF NOT EXISTS team" supabase/migrations/024_employee_teams.sql` = 1. Never execute it.

### Step 2: Employee service types

`src/services/employeeService.ts`: add to `Employee`: `team: 'rot' | 'gruen' | 'blau' | 'gelb' | null` and `profile_id: string | null` (or import `TeamColor` from `@/types/enums` — check it exists with `rg -n "TeamColor" src/types/enums.ts` and prefer the import). Add both to `EmployeePayload` as optional. If insert/update payloads now fail typecheck against generated types, cast `as never` at the supabase call (pattern: `serviceItemService.ts:119`).

**Verify**: `npm run typecheck` → exit 0 (PersonnelPage may need its EMPTY_FORM updated in the same commit — Step 3).

### Step 3: PersonnelPage — team + roster distinction

1. `EMPTY_FORM` (line 18): add `team: null, profile_id: null`.
2. EmployeeModal: add a team `<select>` (copy the UsersPage pattern, lines 197-209 — reuse the existing `teamColor.*` i18n keys, include an empty "no team" option) and an optional "App user" `<select>` populated from `fetchTechnicians()` (import from `@/services/workOrderService`), empty option "— kein App-Zugang —". Initialize both in edit mode like the other fields.
3. List: add a team chip column (render `t('teamColor.' + employee.team)` or '—').
4. Internal/external distinction: above the list add two tabs (buttons): "Interne" (current employee list, default) and "Externe". The Externe tab renders contractors read-only: rows from `fetchTechnicians()` filtered to `role === 'contractor'`, columns name / team / active, plus a link (`<Link to="/admin/users">`) labeled with a new i18n key `personnel.manageInUsers`. No CRUD on this tab.

**Verify**: `npm run typecheck && npm run lint` → exit 0.

### Step 4: Assignment-time compliance helper (pure)

In `src/services/workOrderBusinessRules.ts`, add ONE exported pure function next to `buildContractorDocumentFailureReasons` (line 68), reusing it:

```ts
export interface AssignablePerson { id: string; role: string }

/**
 * Assignment-time gate: external contractors with failing documentation
 * must not be assigned (CLAUDE.md: "expired docs → assignment blocked").
 * Internal technicians always pass. Reuses the certification-time reason
 * builder so both layers agree.
 */
export function buildPersonAssignmentFailureReasons(
  person: AssignablePerson,
  documents: ContractorDocument[],
  assignmentDate: string | null,
): WorkOrderActionReason[] {
  if (person.role !== 'contractor') return []
  return buildContractorDocumentFailureReasons(documents, assignmentDate)
}
```

(Match the actual `ContractorDocument` / `WorkOrderActionReason` type names already used in this file — read the file first.)

**Verify**: `npm run typecheck` → exit 0.

### Step 5: `assignWorkOrder` accepts an optional person

`src/services/workOrderService.ts` lines 399-441 — extend the signature with a 5th optional param `technicianId: string | null = null`, and change the update to `assigned_technician: technicianId`. History note becomes: `` `Zugewiesen an Team ${team ?? '-'}` `` plus `` ` · Techniker: ${technicianName}` `` ONLY if you also thread a display name — simpler and acceptable: append `` ` · Techniker zugewiesen` `` when `technicianId` is set. Existing callers (only `WorkOrderAssignPage.tsx`) keep working because the param defaults to `null` (preserving today's clearing behavior).

**Verify**: `rg -n "assignWorkOrder\(" src/ --type ts --type tsx` → only WorkOrderAssignPage + tests; `npm run typecheck` → exit 0.

### Step 6: WorkOrderAssignPage — optional person picker with doc gate

1. On mount, also load `fetchTechnicians()` into state.
2. After the team grid, when a team is selected, render a `<select>` "Techniker (optional)" listing technicians whose `team === selectedTeam`, each option labeled `full_name` plus a suffix for contractors: `· Extern`. Include an empty option (team-only assignment stays the default path).
3. When a selected person has `role === 'contractor'`: fetch their documents via `contractorDocumentService` (use the export you confirmed in Current state) and run `buildPersonAssignmentFailureReasons(person, docs, assignedDate)`. If reasons are non-empty: disable the submit button and render the reasons in an error card (reuse the existing error markup at lines 167-171; translate reason codes — check how CertificationPage renders these same codes with `rg -n "contractor_documents" src/pages/admin/CertificationPage.tsx src/i18n/locales/de.json` and reuse those keys if present; otherwise add `assignment.reason.<code>` keys to both locales).
4. Submit passes the person: `assignWorkOrder(id, selectedTeam, assignedDate || null, user.id, selectedTechnicianId || null)`.
5. Keep `notifyTaskAssigned` as is (team-level message).

**Verify**: `npm run typecheck && npm run lint` → exit 0. Demo walkthrough: `npm run dev:demo`, create/assign an order; picking team Rot shows the demo technician; picking the demo contractor (set their team in Step 7) shows the doc-block reasons and disables submit.

### Step 7: Demo fixtures

`src/lib/demo/fixtures.ts`:
1. Add `team` and `profile_id` to nothing existing (profiles already have `team`); set the contractor profile's `team` to `'blau'` so they appear in the picker (line ~56-108 — find the contractor profile object).
2. Add `employees` and `vacation_requests` keys to `DemoStore` and seed: 2 employees (one `team: 'rot'`, `profile_id` = the demo technician profile id constant; one office employee `team: null, profile_id: null`); `vacation_requests: []`. Follow the existing fixture style (id constants on top, `LAST_WEEK` timestamps).

**Verify**: `npm run dev:demo` → PersonnelPage lists 2 employees (it was empty/broken in demo before); `npm test` → all pass.

### Step 8: i18n + tests

1. New keys in BOTH locales: `personnel.tabs.internal` (de "Interne" / es "Internos"), `personnel.tabs.external` (de "Externe" / es "Externos"), `personnel.manageInUsers` (de "In Benutzerverwaltung verwalten" / es "Gestionar en Usuarios"), `personnel.appUser` (de "App-Benutzer" / es "Usuario de la app"), `assignment.technicianOptional` (de "Techniker (optional)" / es "Técnico (opcional)"), `assignment.externalSuffix` (de "Extern" / es "Externo"), plus `assignment.reason.*` only if CertificationPage keys can't be reused.
2. `workOrderBusinessRules.test.ts`: add cases for `buildPersonAssignmentFailureReasons` — technician role → `[]` regardless of docs; contractor with valid docs → `[]`; contractor with expired/missing docs → non-empty (reuse the doc fixtures already built in that test file).
3. `workOrderService.test.ts`: locate the existing `assignWorkOrder` tests and add: called WITHOUT technicianId → update payload has `assigned_technician: null`; called WITH an id → payload carries it.
4. `schemaMigrations.test.ts`: assert migration 024 exists with its `Depends on:` header.

**Verify**: `npm run preflight` → exit 0.

## Test plan

- Pure-logic tests for the new assignment gate (3 cases) — the business rule lives here, so these are the load-bearing tests.
- Service tests for both `assignWorkOrder` shapes.
- Demo-mode manual walkthrough (Step 6 verify) is REQUIRED: person picker, contractor block, employee roster.

## Done criteria

- [ ] `npm run preflight` exits 0
- [ ] Migration `024_employee_teams.sql` exists, conventional header, never executed locally
- [ ] `rg -n "assigned_technician: technicianId" src/services/workOrderService.ts` → match
- [ ] `rg -n "buildPersonAssignmentFailureReasons" src/services/workOrderBusinessRules.ts src/pages/admin/WorkOrderAssignPage.tsx` → both match
- [ ] Demo mode: PersonnelPage shows seeded employees with team chips; assign page blocks the non-compliant demo contractor
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The `team_color` enum type doesn't exist under that name in migration 001.
- `employees` already has a `team` or `profile_id` column.
- `assignWorkOrder` no longer matches the excerpt (lines 399-441) — the write path changed since planning.
- `contractorDocumentService.ts` exposes no function to fetch documents for one contractor id (then the assign-time gate has no data source — report; do NOT call Supabase directly from the page).
- The reason-code i18n approach in CertificationPage is structured in a way you cannot reuse and replicating it would mean touching out-of-scope files.

## Maintenance notes

- Two enforcement layers now exist for contractor docs (assign-time in UI/service, cert-time in service + DB trigger). They share `buildContractorDocumentFailureReasons` — keep it that way; never fork the logic.
- The `employees.profile_id` link is informational in this plan (roster display). A future plan can use it to drive payroll-from-fieldwork; nothing depends on it yet.
- ADVISOR ASSUMPTION: person assignment is optional (team remains the unit of dispatch, matching the PIN-login flow where the technician self-identifies). If the business later wants mandatory person assignment, flip the validation in WorkOrderAssignPage.
- Reviewer should scrutinize: that team-only assignment (no person) still writes `assigned_technician: null` (PIN-login self-identification flow depends on orders not being pre-pinned to a person).
