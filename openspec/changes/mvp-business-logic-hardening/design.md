# Design: MVP Business Logic Hardening

## Context

The current MVP already centralizes part of the workflow in `src/services/workOrderService.ts`: a TypeScript state machine, transition prerequisite checks for internal certification and invoicing, direct-order shortcut logic, assignment helpers, and certification audit helpers. The audit/specs require hardening the same rules at service, UI, demo, and Supabase boundaries so critical business invariants cannot be bypassed by stale clients or direct table writes.

Key findings from the existing code/artifacts:

- `transitionWorkOrderStatus()` performs status update and state-history insert as two client-side writes; this is not atomic.
- `client_accepted` is currently a normal status transition; no service or DB path guarantees a `certification_audits.cert_type = 'client'` row is created with it.
- `assignWorkOrder()` writes assignment directly and does not check contractor document compliance at assignment time.
- `insertCertificationAudit()` checks contractor document validity only for `cert_type = 'external'`, which is too late for assignment compliance.
- Direct-order runtime code already treats `client_id === null` as direct, while migration comments in `005_direct_orders_and_billing.sql` still describe `assigned_collaborator_id` as direct-order-defining language.
- Bulk certification/invoicing in `CertificationPage.tsx` runs `Promise.all(...)` over single-order transitions and discards per-order errors.
- Demo mode uses fixture-backed in-memory tables and generic update behavior; it does not currently provide production-equivalent business blockers for assignment/lifecycle/bulk result semantics.

## Goals

1. Enforce contractor assignment compliance before assigning work to external contractors.
2. Make client acceptance/audit writes atomic for client-backed orders.
3. Keep invoicing prerequisites distinct for client-backed orders vs direct orders.
4. Return stable structured results for bulk actions and render partial success accurately.
5. Make `client_id IS NULL` the canonical direct-order model everywhere.
6. Preserve demo-mode parity with production constraints.
7. Author Supabase migrations only; do not apply them locally or regenerate `database.types.ts` manually.
8. Keep implementation slices reviewable under strict TDD.

## Non-Goals

- Replacing the whole workflow engine.
- Redesigning admin certification UI beyond accurate blockers/results.
- Adding payroll/HR compliance rules outside required contractor documents.
- Applying migrations from this machine.
- Manually editing generated `src/types/database.types.ts`.

## Canonical Model and Invariants

### Direct-order classification

For MVP, direct order means exactly:

```sql
work_orders.client_id IS NULL
```

`assigned_collaborator_id`, `assigned_technician`, and `assigned_team` are assignment fields only. They MUST NOT affect direct-order classification.

### Lifecycle prerequisites

- `internally_certified`: requires complete Rückmeldung details, required photos, and durable `certification_audits.cert_type = 'internal'` evidence for the successful certification event.
- `client_accepted`: for client-backed orders only, requires a durable `certification_audits.cert_type = 'client'` row and state history in the same transaction as the status update.
- `invoiced` for client-backed orders: requires `status = 'client_accepted'` and valid client audit evidence.
- `invoiced` for direct orders: requires `status = 'internally_certified'` and valid internal audit evidence; no client audit or `client_accepted` status required.
- External contractor assignment: requires all required contractor documents present, approved, and unexpired for the intended assignment date.

## Service and RPC Boundary Design

### Principle

The React app should call service functions; service functions should call Supabase RPCs for multi-write or critical invariant operations. Direct table updates remain acceptable only for simple CRUD that cannot violate business workflow guarantees.

### Proposed service API additions/changes

In `src/services/workOrderService.ts`:

```ts
export type WorkOrderActionErrorCode =
  | 'invalid_transition'
  | 'permission_denied'
  | 'contractor_documents_missing'
  | 'contractor_documents_unapproved'
  | 'contractor_documents_expired'
  | 'incomplete_rueckmeldung'
  | 'missing_required_photos'
  | 'missing_internal_audit'
  | 'missing_client_audit'
  | 'not_client_backed'
  | 'not_direct_order'
  | 'not_found'
  | 'server_error'

export interface WorkOrderActionReason {
  code: WorkOrderActionErrorCode
  message: string
  requirementId?: string
  documentType?: string
  field?: string
}

export interface WorkOrderActionResult<T = unknown> {
  ok: boolean
  data: T | null
  reasons: WorkOrderActionReason[]
}
```

Replace string-only validation for new hardening paths with structured reasons. Existing `{ data, error }` callers can be adapted gradually by mapping first reason to `error`, but new bulk/UI code should consume `reasons`.

Recommended service functions:

- `validateAssignmentCompliance(technicianId, assignmentDate): Promise<WorkOrderActionReason[]>`
- `assignWorkOrder(...)`: use `rpc('assign_work_order_checked', ...)` when assignee is a contractor or when history/status must be written atomically.
- `certifyWorkOrderInternal(args)`: validates Rückmeldung, creates internal audit, updates status, writes history atomically via RPC.
- `acceptWorkOrderClient(args)`: creates/links client audit, updates to `client_accepted`, writes history atomically via RPC.
- `invoiceWorkOrder(args)`: applies direct/client-backed invoice prerequisites via RPC.
- `bulkWorkOrderAction(args)`: iterates per order over the same single-order service functions and returns structured per-order outcomes.

### RPC boundary

Add Supabase RPCs for operations that require atomic multi-table writes:

1. `assign_work_order_checked(p_work_order_id, p_team, p_assignee_id, p_assigned_date, p_changed_by, p_notes)`
   - Checks assignee role.
   - If role is `contractor`, checks document compliance for `p_assigned_date`.
   - Updates `work_orders.assigned_*`, transitions to `assigned` where valid, and inserts `work_order_state_history` in one transaction.

2. `certify_work_order_internal(p_work_order_id, p_changed_by, p_data_hash, p_notes)`
   - Verifies current status and internal certification prerequisites.
   - Inserts internal certification audit.
   - Updates status to `internally_certified`.
   - Inserts history.

3. `accept_work_order_client(p_work_order_id, p_changed_by, p_data_hash, p_notes)`
   - Rejects direct orders (`client_id IS NULL`).
   - Verifies current status is `sent_to_client`.
   - Inserts client audit and updates status/history atomically.

4. `invoice_work_order_checked(p_work_order_id, p_changed_by, p_billing_reference, p_notes)`
   - Branches on `client_id IS NULL`.
   - Direct: requires `internally_certified` + internal audit.
   - Client-backed: requires `client_accepted` + client audit.
   - Updates status and billing reference/history atomically.

Bulk processing SHOULD stay in the service layer for MVP and call single-order RPCs per item. That preserves per-order durability and avoids one large DB transaction rolling back all eligible orders because one selected order fails.

## Supabase Migration Strategy

### Hard rule

Implementation must create SQL migration files only. Do not run Supabase migrations locally, do not apply to the remote database from this machine, and do not manually regenerate `database.types.ts`. Alejandro applies migrations and regenerates types after application.

### Migration content

A future migration should be additive and reversible where practical:

- Add or replace helper functions:
  - `contractor_required_document_types()` may be reused.
  - Add `contractor_document_compliance_failures(p_contractor_id uuid, p_assignment_date date)` returning rows with `document_type` and `failure_code`.
  - Keep `contractor_documents_are_valid(...)` as compatibility wrapper or extend it to date-aware behavior.
- Add trigger function on `work_orders` to block direct assignment updates to non-compliant contractors.
- Add lifecycle trigger function on `work_orders` to reject direct status updates that violate:
  - client-backed `client_accepted` without client audit;
  - client-backed `invoiced` without `client_accepted` + client audit;
  - direct `invoiced` without internal certification + internal audit.
- Add RPC functions listed above for atomic assignment/certification/acceptance/invoicing.
- Update misleading comments from migration `005` via `COMMENT ON COLUMN public.work_orders.assigned_collaborator_id` and possibly `COMMENT ON COLUMN public.work_orders.client_id` to document the canonical direct-order definition.

### Existing data rollout

Before adding hard blockers, implementation should include a SQL preflight/remediation query in the migration comments or docs to identify:

- orders assigned to non-compliant contractors;
- client-backed orders in `client_accepted` or later without client audit;
- direct orders in `invoiced` or later without internal audit;
- any data relying on `assigned_collaborator_id` as a direct-order marker.

If production contains violating rows, Alejandro should either backfill audit/document state or apply the migration after remediation. The migration should not silently rewrite business history unless an explicit backfill is reviewed.

## Contractor Assignment Compliance

### Service behavior

`assignWorkOrder()` should fetch the assignee profile role before assignment. If the assignee is a contractor, it should call the compliance validator and return all document failures together. Internal employees/technicians bypass contractor-document checks.

Failure payload examples:

```ts
;[
  {
    code: 'contractor_documents_missing',
    documentType: 'gewerbeanmeldung',
    requirementId: 'contractor_document:gewerbeanmeldung',
    message: 'Gewerbeanmeldung fehlt',
  },
  {
    code: 'contractor_documents_expired',
    documentType: 'haftpflichtversicherung',
    requirementId: 'contractor_document:haftpflichtversicherung',
    message: 'Haftpflichtversicherung ist abgelaufen',
  },
]
```

### Database behavior

The DB must block direct updates where `assigned_technician` changes to a contractor whose documents are not valid for the intended assignment date. This trigger protects stale clients and alternate data paths. RPC remains preferred for normal app writes because it can write assignment and history atomically.

## Client Acceptance and Audit Atomicity

Client acceptance should no longer be implemented as only `transitionWorkOrderStatus(id, 'client_accepted', ...)`.

- UI calls `acceptWorkOrderClient()`.
- Service computes/receives audit evidence hash and calls `accept_work_order_client` RPC.
- RPC inserts `certification_audits(cert_type = 'client')`, updates `work_orders.status`, and inserts `work_order_state_history` in one transaction.
- If any write fails, no audit/status/history partial state remains.

A DB trigger should reject any direct attempt to set `status = 'client_accepted'` for a client-backed order unless a client audit exists by statement end. Because PostgreSQL triggers are not naturally deferred unless defined as constraint triggers, prefer the RPC for app writes and add a defensive trigger that rejects unsafe direct table updates. The implementation should choose between:

- requiring pre-existing client audit before direct status update; or
- defining a deferred constraint trigger if direct update + audit insert in one transaction must be supported outside RPC.

For MVP, the clean contract is: app code uses RPC for atomic creation; direct table update must already have valid audit evidence or be rejected.

## Bulk Result Types and UI Handling

### Result shape

```ts
export type BulkWorkOrderOutcome = 'succeeded' | 'failed' | 'skipped'

export interface BulkWorkOrderItemResult {
  workOrderId: string
  orderNumber?: string
  outcome: BulkWorkOrderOutcome
  reasons: WorkOrderActionReason[]
}

export interface BulkWorkOrderResult {
  action: 'assign' | 'internal_certify' | 'send_to_client' | 'client_accept' | 'invoice'
  total: number
  succeeded: number
  failed: number
  skipped: number
  items: BulkWorkOrderItemResult[]
}
```

Every selected order must appear exactly once. Successful per-order operations may remain durable after another item fails. Each item operation must be atomic through the single-order RPC/service path.

### UI behavior

`CertificationPage.tsx` should replace fire-and-forget `Promise.all` with `bulkWorkOrderAction()`. UI must show:

- all-success only when `failed === 0 && skipped === 0`;
- partial success summary when any item failed/skipped;
- a dense per-order list/table of reasons using existing NEXUS.OS tokens/classes;
- no toast-only success claim for mixed results.

Bulk send-to-client can use the same result type even if no new DB invariants are introduced there.

## Demo-Mode Parity

Demo mode must enforce the same user-visible constraints without pretending to be a full PostgreSQL clone.

Implementation options:

1. Preferred: route demo UI through the same service functions and make the demo Supabase mock support the new RPC names with in-memory transactional behavior per work order.
2. Fallback: add pure business-rule helpers shared by production service and demo RPC mock, then wire the mock update paths to call those helpers.

Required demo changes:

- Fixtures: add at least one compliant contractor and one non-compliant contractor; include document rows covering missing, pending/rejected, and expired categories where practical.
- Fixtures: include client-backed orders for valid and invalid client acceptance/invoicing paths.
- Fixtures: include a direct order with `client_id: null`, internal audit, and invoice-ready status; include a direct-order negative path without internal audit.
- Mock RPCs: implement `assign_work_order_checked`, `certify_work_order_internal`, `accept_work_order_client`, and `invoice_work_order_checked` with per-order atomic updates to in-memory store.
- Mock direct updates: either block invalid status/assignment writes or ensure all app paths use RPC so demo behavior matches production UI behavior.
- Tests: assert production service calls and demo RPC/mock results share the same bulk result shape and key failure codes.

## Testing Plan under Strict TDD

Strict TDD is active. Implementation must use `npm test` for RED/GREEN evidence and finish with `npm run typecheck` and `npm run lint`.

Recommended test slices:

1. Service validation RED tests
   - contractor assignment returns multiple structured document failures;
   - internal employee assignment bypasses contractor docs;
   - direct-order classification uses only `client_id === null`.

2. Lifecycle service/RPC adapter RED tests
   - client acceptance creates/requires client audit and rejects partial state;
   - client-backed invoicing rejects missing client audit;
   - direct invoicing accepts internal audit and rejects missing internal audit.

3. Bulk result RED tests
   - mixed certification/invoicing returns one item per selected order;
   - partial success is not reported as aggregate success;
   - failed item leaves no partial local/service writes in mock tests.

4. Schema migration text tests (`src/__tests__/schemaMigrations.test.ts`)
   - migration contains assignment compliance trigger/RPC;
   - migration contains lifecycle trigger/RPC;
   - migration documents `client_id IS NULL` canonical direct-order semantics;
   - migration declares dependency on latest upstream migration.

5. Demo parity tests
   - demo RPC blocks non-compliant contractor assignment;
   - demo client acceptance cannot leave status without audit;
   - demo direct-order invoice rules match production reason codes;
   - demo bulk result shape matches production type expectations.

Because migrations cannot be applied locally, SQL behavior should be validated via schema text tests plus documented manual verification steps for Alejandro after applying in Supabase.

## Review Slicing and Rollout

This change crosses service logic, SQL, demo, UI, and tests. To protect review workload, split implementation into reviewable PR-sized slices if possible:

1. Types/shared validators and direct-order canonical cleanup.
2. SQL migration authoring + schema migration tests only.
3. Service adapters to RPCs and single-order tests.
4. Demo-mode RPC parity + fixtures/tests.
5. Bulk result UI handling in `CertificationPage.tsx` and related tests.

Avoid a single large diff combining SQL, mock engine changes, service rewrite, and UI rendering unless explicitly approved. Expected total touched lines could exceed 400, so review slicing should be treated as a real risk, not a preference.

## Tradeoffs

- **RPCs vs client-side multi-write services:** RPCs add SQL complexity but are required for atomic audit/status/history operations and for bypass resistance.
- **Bulk in service vs bulk RPC:** Service-level bulk is simpler and supports partial durability per item. A DB bulk RPC would be faster but risks oversized transaction semantics and harder per-item reporting.
- **Defensive triggers plus RPCs:** Some invariant logic is duplicated, but triggers protect direct writes while RPCs provide clean atomic app workflows.
- **Structured reasons vs strings:** More upfront type work, but enables deterministic UI, bulk reporting, and tests without parsing German text.
- **Demo parity in mock RPCs:** Adds mock complexity, but prevents demos from showing workflows production rejects.

## Open Implementation Notes

- Before choosing the migration filename/number, implementation must check upstream/develop migration state per project rules. Do not assume local `015` is latest.
- If generated DB types do not include new RPCs until Alejandro regenerates `database.types.ts`, service calls may need temporary narrow casts with TODO comments, not manual type edits.
- Existing accepted/invoiced rows without audits need a preflight report and explicit remediation decision before strict production enforcement.
