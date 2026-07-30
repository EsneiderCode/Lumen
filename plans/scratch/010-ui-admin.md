# 010 — UI / Admin plan (client-first order form)

Plan only. Depends on `plans/scratch/010-exploration.md`. Do not implement here.

## 1. Goal

Invert the admin new-order form from **project-first** (Plan 002) to **client-first**:

1. Select **client** from catalog (or Direktauftrag).
2. Choose **executor category**: own team vs external contractor (surfaces cert path).
3. Select **project** filtered by client.
4. Select **service/price** filtered by client catalog.
5. Keep RA/RD + POP/DP site reference; **remove** visible operator and NE3/NE4 line controls (still persist via project defaults).

Admins need first-class CRUD for clients, per-client projects, per-client price catalogs, and personnel category management.

## 2. New form step model

Primary surface: `src/pages/admin/WorkOrderFormPage.tsx` (`/admin/orders/new`, `/admin/orders/:id/edit`).

Assignment remains a separate route (`WorkOrderAssignPage.tsx` at `/admin/orders/:id/assign`) but gains category UX + cert-path copy. Create still navigates to assign after save.

### Visible step order (create)

| Step | Control | Source | Gating |
|------|---------|--------|--------|
| 0 | Direktauftrag toggle (keep) | `form.is_direct_order` | When on: hide client; catalog = global rows only |
| 1 | **Client** (required if not direct) | `fetchClients()` | First selector; empty disables project + service |
| 2 | **Executor category** (required UI intent) | New form field `executor_category: 'own_team' \| 'external_contractor' \| ''` | Banner shows cert path; assignment page pre-filters by category |
| 3 | **Project** | `fetchProjects(clientId)` | Disabled until client (or direct); options = that client’s projects |
| 4 | **Service item** | client-scoped catalog | Disabled until client resolved; filter by client (+ globals); no operator filter in UI |
| 5 | Capture plan / priority / address or RA-RD+POP/DP / notes | unchanged | Unchanged rules |

**Removed from UI:** operator `<select>`, NE3/NE4 line `<select>`, and the “derived data” `<details>` disclosure that holds them today (`WorkOrderFormPage.tsx` ~488–545).

**Hidden but still persisted:** `operator_id`, `line` — filled by `deriveOrderDefaultsFromProject(project)` (`src/lib/orderFormDefaults.ts`). If project lacks `default_operator_id` or `default_line`, block save with field-level / form-level error (admin must complete project config). Do not invent fallbacks in the form.

**Keep:** RA/RD `segment_kind`, POP, DP (not the NE3/NE4 “line”); site-ref is work identity, not network level.

## 3. Component-level changes (exact paths)

### 3.1 Order form — `src/pages/admin/WorkOrderFormPage.tsx`

- **Reorder grid:** client (full width or col-1) → executor category (col-2) → project → service item; drop operator/line block.
- **Client change cascade** (extend `withCatalogScope` / `setField`):
  - Reset `project_id`, `service_item_id`, `work_type`, `capture_plan_key`.
  - Clear derived `operator_id` / `line` (or re-derive only after new project pick).
  - Reload projects via `fetchProjects(clientId)` (`workOrderService.ts:217-237` already supports filter; today form ignores it).
  - Reload service items for client scope (stop operator-driven fetch at ~210–220; pass client, not operator).
- **Project change:** call `deriveOrderDefaultsFromProject`; set hidden `operator_id` + `line` only; do **not** re-write client (client already selected).
- **Disabled / empty states:**
  - No client (and not direct): project + service `<select disabled>`; helper text under each.
  - Client with zero projects: enabled project select, single empty option + warning.
  - Client with zero catalog rows: service empty + warning (link/admin hint to catalog).
  - Project missing defaults: after project select, show non-toast inline error banner; save blocked.
- **Executor category UI:** segmented control or two radio cards (own team / external). Below it, **cert-path callout** (border `border-line`, surface `bg-bg-0`, text tokens only):
  - `external_contractor` → internal cert **then** client cert.
  - `own_team` → direct client cert (no intermediate internal step) — copy only in this UI plan; status-machine changes belong to domain/backend plan.
- **Edit mode:** load existing client first; pre-fill executor from assignee role if already assigned (`profiles.role === 'contractor'` → external; team/technician → own); preserve legacy service item even if out of current filter (existing pattern ~417–428).
- **Direktauftrag:** keep checkbox; client null; projects still required — decide product rule in implementation: either all projects or only projects with `client_id IS NULL`. Catalog = global rows. Cert path for direct stays “internal → invoice” (existing copy under `workOrder.directOrderDesc`).

### 3.2 Cascading helpers — `src/lib/orderFormDefaults.ts`

- Keep `deriveOrderDefaultsFromProject` for operator/line only.
- Add pure helpers (same file or `src/lib/orderFormScope.ts`):
  - `projectsForClient(projects, clientId, isDirect)`
  - `isProjectDefaultsComplete(project)` → operator + line present
  - Optionally stop deriving client from project (client is source of truth).

### 3.3 Catalog filtering — `src/services/serviceItemService.ts`

- UI path: fetch by client (and globals), **not** operator-first.
- `filterServiceItemsForScope` (~200–220): client-primary; keep global (`client_id` null) rows; keep selected legacy id on edit; operator filter optional/backend-only until catalog is purely per-client.
- Field Rückmeldung loader (`rueckmeldungLoader.ts`) must stay consistent with the same scope rules (coordinate with domain plan).

### 3.4 Assignment — `src/pages/admin/WorkOrderAssignPage.tsx`

- Accept intent from create: query param or order metadata for `executor_category` (if only UI-local, pass `?executor=own|external` after create navigate ~336–383).
- Split roster into two lists/tabs:
  - **Own team:** `profiles` with role `technician` (and team chips from `TEAMS` / `team_color`).
  - **External:** role `contractor` (keep compliance gate ~107–169, 388–437).
- If category fixed on form, hide the other category or show disabled with explanation.
- Repeat cert-path callout at top of assign page (same copy keys).
- Keep: optional team + person; at least one required; compliance override for blocked contractors.

### 3.5 Detail / list (read-only surfacing)

- `WorkOrderDetailPage.tsx`: when assignee is contractor vs own, show cert-path badge in header; action buttons already branch on status — align labels with new own-team skip-internal rule when backend supports it.
- No operator/line **edit** on form; detail may still **display** derived operator/line (PDF/DATEV still need them — display-only chips OK).

## 4. Form state + validation

### `FormValues` changes (`WorkOrderFormPage.tsx:80-101`)

| Field | Change |
|-------|--------|
| `client_id` | Primary required (unless direct) |
| `project_id` | Required; options client-filtered |
| `operator_id` | Hidden; required on save via project defaults |
| `line` | Hidden; required on save via project defaults |
| `service_item_id` | Required; client-scoped |
| `executor_category` | **New** UI field: `'' \| 'own_team' \| 'external_contractor'` |
| `is_direct_order`, site ref, priority, notes | Unchanged |

### `validate()` (`~273–285`)

1. If not direct → `client_id` required.
2. `executor_category` required on create (edit: required if re-assign intent shown).
3. `project_id` required; must belong to selected client (or direct rule).
4. Project must have `default_operator_id` + `default_line` → else `errors.project_id` or dedicated `errors.line` / form banner keys.
5. `service_item_id` required; must be in client-applicable set (or legacy edit exception).
6. Drop user-facing operator/line required messages for empty selects (no selects); keep server-side completeness via project defaults.
7. Infra/address rules unchanged.

### Submit payload

Still send `client_id`, `project_id`, `operator_id`, `line`, `service_item_id`, … (`~309–344`). Executor category does **not** need a DB column if assignment immediately captures person/team; if create must remember intent before assign, use navigate state / query only (prefer no schema in UI-only slice).

## 5. Admin CRUD structure

There is **no** `ClientsPage` today. Clients are only lookup rows via `fetchClients()` in `workOrderService.ts`. Projects and service items exist but are global lists with optional client FK.

### Routes — `src/config/routes.ts` + `src/App.tsx` + `src/components/layout/Sidebar.tsx`

| Route | Page (new or extend) | Nav |
|-------|----------------------|-----|
| `/admin/clients` | **New** `src/pages/admin/ClientsPage.tsx` | `nav.clients` under catalog |
| `/admin/clients/:id` | **New** `ClientsDetailPage.tsx` (tabs: projects, price catalog) optional v1 | — |
| `/admin/projects` | Extend `ProjectsPage.tsx` + `ProjectFormModal.tsx` | Keep; add client filter default |
| `/admin/service-items` | Extend `ServiceItemsPage.tsx` | Keep; default filter by client |
| `/admin/personnel` | Extend `UsersPage.tsx` (route `PERSONNEL`) | Category tabs: own vs external |
| `/admin/employees` | `PersonnelPage.tsx` payroll — out of order-form scope | Unchanged |

Lazy imports in `App.tsx` mirror existing `adminRoute(...)` pattern.

### Clients CRUD (new)

- List: code, name, active, project count, catalog count.
- Modal or drawer create/edit: `code`, `name`, `is_active` (match `clients` table).
- Soft-deactivate preferred (align with projects/service items).
- New service module: `src/services/clientService.ts` (`list/create/update/deactivate`) — UI plan assumes thin CRUD; types from `database.types.ts`.
- Detail (recommended): nested tables reusing project modal + service item modal with `client_id` locked.

### Per-client projects

- `ProjectFormModal.tsx`: `client_id` **required** for non-orphan projects; emphasize `default_operator_id` + `default_line` as **required for order creation** (validation in modal).
- `ProjectsPage.tsx`: client filter chips/select; group or badge by client; empty state “no projects for client”.
- `ProjectDetailPage.tsx`: show completeness gate (defaults missing → warn).

### Per-client service/price catalog

- `ServiceItemsPage.tsx` + modal: require `client_id` for client rate cards; keep optional global rows (`client_id` null) for Direktauftrag/shared positions.
- Filters: client (primary), category, active; de-emphasize operator filter in UI (operator may remain on row for legacy/bridge).
- Prices: `unit_price` (client) + `unit_price_external` (collaborator) already in modal — label as client vs external rate card.

### Personnel category management

- `UsersPage.tsx`: top-level category tabs **Own teams** (`technician` + team color) vs **External collaborators** (`contractor`); keep admin/scheduler under “System” or existing role filters.
- Creating user: role picker constrained by active tab; team required for own-team technicians; contractor docs/compliance entry points unchanged (`CompliancePage`).
- No new “teams table” in UI — teams remain `team_color` enum + chips (exploration §2).
- Optional label map in i18n: `personnel.categories.ownTeam` / `external`.

## 6. i18n plan (`src/i18n/locales/de.json`, `es.json`)

All user-facing strings via `t(...)` / existing `T` component. No hardcoded DE/ES in new UI (fix already has some hardcoded risks in service items DETAIL_FORM labels — do not add more).

### New / updated keys (mirror both locales)

```
workOrder.chooseClient          // already exists
workOrder.selectClientFirst     // "Select a client to load projects and prices"
workOrder.noProjectsForClient
workOrder.noServicesForClient
workOrder.projectDefaultsMissing // operator/line not configured on project
workOrder.executorCategory
workOrder.executorOwnTeam
workOrder.executorExternal
workOrder.certPathOwnTeam       // direct client certification explanation
workOrder.certPathExternal      // internal then client certification
workOrder.certPathDirectOrder   // keep/align directOrderDesc
// remove reliance on chooseOperator in form; keep key if detail/PDF still use operator label

nav.clients
clients.title / subtitle / new / edit / code / name / active / empty / deleteConfirm ...
projects.filterByClient / defaultsRequired
serviceItems.filterByClient / clientRequired / globalRowHint
assignment.executorOwnTeam / executorExternal / certPath* (reuse workOrder or nest)
users.categories.ownTeam / external / system
```

Update `workOrder.derivedData` usage (disclosure removed). Adjust `directOrderDesc` if own-team cert path changes product language.

## 7. Demo mode

| File | Change |
|------|--------|
| `src/lib/demo/fixtures.ts` | Ensure ≥2 clients with distinct projects (e.g. Insyte → Rossdorf) and client-scoped `service_items`; mix of own technicians + contractors; projects with complete `default_operator_id` + `default_line`; one incomplete project for empty/error demo |
| `src/lib/demo/supabase-mock.ts` | `fetchProjects(clientId)` filter; client-scoped service list; clients CRUD tables if new service writes; no change to cert RPCs unless domain plan changes own-team path |
| `src/lib/demo/store.ts` | If new fields on existing rows, document `localStorage.removeItem('lumen-demo-store-v1')` (hydration skips field-level merges) |
| Tests under `src/__tests__/` | Client→project filter, client→service filter, client change clears project/service, missing project defaults blocks save, executor category validation, edit preserves legacy service |

## 8. NEXUS Brand System (normative)

Follow `Agents.md` / `src/index.css @theme`:

- Surfaces: `bg-bg-0`…`bg-bg-4`, text `text-fg-1`…`fg-4`, borders `border-line` / `border-line-s`.
- Accent / ok / warn / info / err via semantic tokens only — **no hex**, no Tailwind palette colors.
- **Forbidden:** gradients, `box-shadow`, blur/backdrop-filter, toasts, skeleton loaders (use `[LOADING]` / `t('common.loading')`), filled icons (outline 1.5px), zebra tables.
- Radius: `rounded-s` / `rounded-m` / `rounded-l`; micro motion 150–250ms existing easing; page `page-fade-in` where applicable.
- Cert-path callout: bordered card, not toast; warn state via `text-warn` / `border-warn` tokens if emphasis needed.
- Max 2 font families / 3 sizes per screen; mono only for codes (`font-mono` / existing `mono` utility).

## 9. Explicit non-goals (this plan)

- No SQL migrations, RPC, or status-machine implementation (own-team skip-internal needs domain/backend plan).
- No NE4 bridge or scheduler appointment form changes.
- No removal of `operator_id` / `line` columns or PDF/DATEV fields.
- No implementation in this deliverable.

## 10. Implementation order (for apply phase)

1. i18n keys (de/es).
2. `clientService` + Clients admin page + nav/route.
3. Project modal defaults required + client filter on Projects/ServiceItems.
4. Form cascade + hidden operator/line + executor category + cert callout.
5. Assign page category split + query intent.
6. Demo fixtures/mock + unit tests.
7. Visual pass against NEXUS rules.
