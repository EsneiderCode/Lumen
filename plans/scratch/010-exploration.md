# Exploration 010 — Client-first work-order creation

## Scope and baseline

- Read-only map for planning only; no implementation is proposed here.
- `plans/README.md:12-20` records Plans 001–003 as done. Plan 002 deliberately made the form **project-first**, deriving client/operator/line while retaining overrides (`plans/002-order-form-project-derivation.md:22-30,175-202`).
- The requested flow inverts that: **client first**, then client-filtered projects and services, with operator and NE3/NE4 line removed from the visible order form.
- Important terminology: `work_orders.line` is the NE3/NE4 network level; `work_orders.segment_kind` is the RA/RD work stretch (“tramo”). They are separate concepts. The RA/RD + POP/DP work reference must not disappear with the NE3/NE4 selector (`src/pages/admin/WorkOrderFormPage.tsx:705-735`; `supabase/migrations/064_work_order_site_reference.sql:19-35`).

## 1. Current form and field flow

### Entry points

- `/admin/orders/new` and `/admin/orders/:id/edit` both render `src/pages/admin/WorkOrderFormPage.tsx`; `/admin/orders/:id/assign` renders `src/pages/admin/WorkOrderAssignPage.tsx` (`src/config/routes.ts:9-11`; `src/App.tsx:88-90`).
- Creation and assignment are intentionally separate: a successful create navigates to the assignment route (`src/pages/admin/WorkOrderFormPage.tsx:336-383`).

### Current project-first sequence

1. Lookups load all active clients, operators, and projects on mount (`src/pages/admin/WorkOrderFormPage.tsx:192-200`; queries in `src/services/workOrderService.ts:208-245`).
2. The direct-order toggle is first. Direct orders persist `client_id = NULL`, but still require a project and operator (`src/pages/admin/WorkOrderFormPage.tsx:453-467,273-280,311-319`).
3. Project is the first visible selector and currently shows **all** projects (`src/pages/admin/WorkOrderFormPage.tsx:469-486`).
4. Selecting a project calls `deriveOrderDefaultsFromProject()`, merging `client_id`, `default_operator_id`, and `default_line` (`src/pages/admin/WorkOrderFormPage.tsx:262-270`; `src/lib/orderFormDefaults.ts:1-23`).
5. Client, operator, and NE3/NE4 line remain editable inside a “derived data” disclosure (`src/pages/admin/WorkOrderFormPage.tsx:488-545`).
6. Service rows are fetched whenever operator changes; the DB request includes matching-operator plus global rows (`src/pages/admin/WorkOrderFormPage.tsx:210-220`; `src/services/serviceItemService.ts:18-32,63-85`).
7. The form then filters that result locally by both client and operator, preserving global rows and an already-selected legacy item (`src/pages/admin/WorkOrderFormPage.tsx:417-428`; `src/services/serviceItemService.ts:200-220`).
8. Selecting a service item sets canonical `service_item_id` and derives legacy `work_type` from `detail_form`; categories render as `<optgroup>` (`src/pages/admin/WorkOrderFormPage.tsx:547-605`).
9. Capture-plan variant, priority, address or infra reference follow. For infra work, RA/RD `segment_kind`, POP, and DP remain separately editable (`src/pages/admin/WorkOrderFormPage.tsx:622-703,705-773`).
10. Save persists client, project, operator, line, service item, derived work type, optional capture plan, and site-reference fields (`src/pages/admin/WorkOrderFormPage.tsx:309-344`).

### Assignment flow

- The assignment page loads the created order plus active technician/contractor profiles (`src/pages/admin/WorkOrderAssignPage.tsx:71-100`; `src/services/workOrderService.ts:248-262`).
- Team and person are both optional individually, but at least one is required. A chosen team filters the person list; direct person assignment without a team is supported (`src/pages/admin/WorkOrderAssignPage.tsx:95-174,303-357`).
- Contractor selection performs project-aware compliance checking and can require an audited admin override (`src/pages/admin/WorkOrderAssignPage.tsx:107-169,388-437`).
- `assignWorkOrder()` persists `assigned_team`, `assigned_technician`, date, override evidence, status, and state history (`src/services/workOrderService.ts:389-461`).

## 2. Supabase schema map

### Client/project/operator/line

- `clients`: `id`, unique `name`, unique `code`, `is_active`, `created_at` (`supabase/migrations/001_initial_schema.sql:50-56`; generated type `src/types/database.types.ts:175-197`).
- `operators`: the same lookup shape (`supabase/migrations/001_initial_schema.sql:67-73`; generated type `src/types/database.types.ts:1063-1085`).
- `projects`: `id`, unique `code`, `name`, nullable `client_id`, activity/timestamps; later adds nullable `default_operator_id` and nullable `default_line` (`supabase/migrations/001_initial_schema.sql:58-65`; `supabase/migrations/023_project_defaults.sql:9-16`; generated type `src/types/database.types.ts:1285-1340`).
- There is **no line table**. NE3/NE4 is denormalized as required `work_orders.line`, nullable `projects.default_line`, and separate scheduler fields. RA/RD is `work_orders.segment_kind`.
- Project administration is the only current place to maintain operator/line defaults (`src/services/projectService.ts:9-35,85-97`; `src/components/admin/ProjectFormModal.tsx:16-24,170-197`).

### Catalog and prices

- `service_items` carries code/descriptions/unit, nullable client and operator FKs, nullable `detail_form`, category, active/display metadata, client price `unit_price`, collaborator price `unit_price_external`, and `is_pass_through` (`supabase/migrations/004_service_catalog_seed.sql:12-34`; `supabase/migrations/006_collaborator_pricing.sql:13-34`; `supabase/migrations/022_service_item_categories.sql:12-35`; `supabase/migrations/063_fns_service_catalog_seed.sql:75-105`).
- Generated types confirm both price columns and both scoping FKs (`src/types/database.types.ts:1408-1481`).
- `service_items_public` exposes the non-priced field catalog; priced admin flows query `service_items` directly (`src/services/serviceItemService.ts:11-20,63-85`).
- `work_order_billing_lines` snapshots client and collaborator prices per order/service/quantity so later catalog edits do not rewrite certified billing (`supabase/migrations/005_direct_orders_and_billing.sql:94-115`; `src/types/database.types.ts:2135-2194`).

### Work orders

- Core required routing fields are `project_id`, `operator_id`, `line`, and `work_type`; `client_id` became nullable for direct orders. Assignment, location, status, priority, and audit references live on the same row (`supabase/migrations/001_initial_schema.sql:79-104`; `supabase/migrations/005_direct_orders_and_billing.sql:21-47`).
- `service_item_id` links the canonical catalog position (`supabase/migrations/008_wo_service_item_id.sql:10-20`).
- Current generated row shape also includes source/NE4 metadata, compliance override, capture plan, and site-reference fields (`src/types/database.types.ts:2575-2680`); FKs to client/operator/project/service/profile are at `src/types/database.types.ts:2681-2745`.

### Teams, personnel, contractors

- There is **no normalized teams table**. Team identity is the `team_color` enum used by `profiles.team`, `employees.team`, and `work_orders.assigned_team`; it now has 12 colors (`supabase/migrations/001_initial_schema.sql:12-20,32-44`; `supabase/migrations/040_expand_team_colors.sql:16-23`; generated enum `src/types/database.types.ts:3313-3326`).
- `team_pins` is authentication configuration, not a team roster (`supabase/migrations/021_team_pins.sql:10-21`).
- Operational people are `profiles` (`role`, `team`, activity, PIN/scheduler fields); contractors are profiles with role `contractor`, not a separate contractor table (`src/types/database.types.ts:1152-1209`).
- Payroll personnel are `employees`; optional `profile_id` links an employee to the operational profile and `team` joins the roster domain (`supabase/migrations/019_employees_and_vacations.sql:13-35`; `supabase/migrations/024_employee_teams.sql:9-18`; generated type `src/types/database.types.ts:749-815`).
- Legacy contractor documents reference `profiles.id` (`supabase/migrations/011_contractor_documents.sql:12-44`); the current compliance engine adds entity/project-aware records beyond that legacy table.

### Certifications

- One `certification_audits` table stores immutable audit rows keyed by `work_order_id`, `cert_type`, certifier, timestamp, hash, and notes (`supabase/migrations/002_cert_audit.sql:14-30`; generated type `src/types/database.types.ts:127-173`).
- `cert_type` began as `internal|client`; `external` was added for subcontractor settlement and is parallel to the client-facing dual flow (`supabase/migrations/006_collaborator_pricing.sql:85-97`).

## 3. Blast radius of hiding operator and NE3/NE4 line

- **Do not remove the stored columns.** `work_orders.operator_id` and `line` are required by schema and generated inserts (`src/types/database.types.ts:2575-2645`). The redesign can remove controls only if it deterministically supplies both values.
- Project defaults are nullable and migration 023 did not backfill them (`supabase/migrations/023_project_defaults.sql:9-16`). A no-override form therefore needs a project-configuration completeness gate/backfill or a defined fallback; otherwise existing projects can no longer create valid orders.
- `fetchProjects(clientId?)` already supports DB filtering, but the form calls it without the client argument and keeps all projects (`src/services/workOrderService.ts:217-237`; `src/pages/admin/WorkOrderFormPage.tsx:192-200,481-483`).
- Client changes currently clear an incompatible service selection through `withCatalogScope`, but do **not** reset a mismatched project. Client-first work must reset/reselect project and its derived routing atomically (`src/pages/admin/WorkOrderFormPage.tsx:112-121,262-270`).
- Catalog applicability is jointly client+operator scoped and is reused by the field Rückmeldung. Removing operator from state/filtering—not merely the UI—would expose or hide wrong rate-card rows (`src/services/serviceItemService.ts:200-220`; `src/services/rueckmeldungLoader.ts:54-68,95-100`).
- Query joins still hydrate operator labels for admin, technician, and contractor order reads (`src/services/workOrderService.ts:267-337,561-598,888-912`).
- UI consumers include admin list/detail (`src/pages/admin/WorkOrdersPage.tsx:396-410`; `src/pages/admin/WorkOrderDetailPage.tsx:664-669,1077-1096`), technician list/detail (`src/pages/technician/TechOrdersPage.tsx:85-97`; `src/pages/technician/TechOrderDetailPage.tsx:120-125,212-227`), and contractor list (`src/pages/contractor/ContractorOrdersPage.tsx:187-203`).
- Certification PDF prints line and operator (`src/services/pdfService.ts:11-25,116-124`); DATEV booking text includes operator code (`src/services/datevExportService.ts:76-104`).
- The NE4 bridge independently resolves client/project/operator IDs, hardcodes `line: 'NE4'`, and upserts those required fields; form changes must not alter that API contract (`/Users/jarl/Dev/ne4-work-manager/supabase/functions/lumen-bridge/index.ts:242-299`). Its routing config maps NE4 operator to LUMEN client/operator codes (`/Users/jarl/Dev/ne4-work-manager/supabase/migrations/015_lumen_routing.sql:4-11,29-44`).
- Appointment line/operator fields belong to the separate scheduler workflow and should not be removed as collateral (`src/services/appointmentsService.ts:11-34,99-106`; `src/pages/scheduler/AppointmentNewPage.tsx:23-62`).
- RA/RD `segment_kind` and POP/DP are operational work identity used across lists, Telegram, and exports; they are not the NE3/NE4 field being hidden (`src/lib/orderSiteRef.ts:1-18,45-88`).

## 4. Dual certification today

1. Statuses encode `rueckmeldung_sent → internally_certified → sent_to_client → client_accepted|client_rejected → invoiced → paid` (`supabase/migrations/001_initial_schema.sql:14-20`; transition rules `supabase/migrations/005_direct_orders_and_billing.sql:156-184`).
2. Internal certification validates capture-plan completeness, hashes order/detail/photo evidence, snapshots Alta billing lines, then calls atomic RPC `certify_work_order_internal` (`src/pages/admin/WorkOrderDetailPage.tsx:433-521`; `src/services/workOrderService.ts:85-137,722-742`).
3. The RPC inserts `cert_type='internal'`, advances status, and appends state history in one transaction (`supabase/migrations/016_mvp_business_logic_hardening.sql:318-354`).
4. Sending to client is a normal status transition; acceptance creates a second hash and calls `accept_work_order_client` (`src/pages/admin/WorkOrderDetailPage.tsx:381-407,540-555,768-838`; `src/services/workOrderService.ts:744-756`).
5. The client RPC requires a non-direct order in `sent_to_client`, inserts `cert_type='client'`, advances to `client_accepted`, and records history (`supabase/migrations/016_mvp_business_logic_hardening.sql:356-396`).
6. Client-backed invoicing requires `client_accepted` plus a client audit; direct orders skip client certification and invoice from `internally_certified` plus an internal audit (`supabase/migrations/016_mvp_business_logic_hardening.sql:398-439`; UI branches `src/pages/admin/WorkOrderDetailPage.tsx:870-913`).
7. External-collaborator certification is a third, parallel audit; it does not replace internal/client certification or change the order status (`src/pages/admin/WorkOrderDetailPage.tsx:916-923`; `src/services/workOrderService.ts:1013-1066`).

## 5. Migration and demo implications

- Required command result: `git ls-tree -r --name-only origin/develop supabase/migrations/` ends at `062_compliance_review_assignee.sql`, not 063.
- The checked-out `develop` tracks `upstream/develop`; both HEAD/upstream contain committed `063_fns_service_catalog_seed.sql` and `064_work_order_site_reference.sql`. On the active source line, the next migration is therefore **065**, but the remote-name discrepancy must be resolved before reserving it.
- Demo fixtures already model clients/projects/defaults/operators/catalog rows, eight work orders (including direct and NE4), employees, certification audits, and billing lines (`src/lib/demo/fixtures.ts:207-395,476-575,902-914`).
- The demo mock aliases `service_items_public` to `service_items` and generically serves `DemoStore` tables (`src/lib/demo/supabase-mock.ts:1137-1148`); it separately emulates create number, internal certification, client acceptance, and checked invoicing RPCs (`src/lib/demo/supabase-mock.ts:771-779,811-889`).
- Client-first coverage must extend fixtures/tests for: client→project filtering, client→service filtering including global rows, client change clearing project/service, project defaults supplying hidden operator/line, nullable-default failure behavior, direct-order behavior, edit-mode legacy preservation, and NE4 rows remaining valid.
- Demo persistence hydrates only top-level missing tables, not newly added fields inside existing rows (`src/lib/demo/store.ts:17-44`). If the redesign adds row fields, either migrate stored demo rows or explicitly require clearing `lumen-demo-store-v1`; fixture edits alone will not update existing localStorage objects.
