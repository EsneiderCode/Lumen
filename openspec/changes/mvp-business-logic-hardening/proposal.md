# Proposal: MVP Business Logic Hardening

## Intent

Harden the Lumen MVP business rules that protect assignment, certification, client acceptance, invoicing, and direct-order handling. The audit found that the application is moving in the right direction with a service-layer state machine in `src/services/workOrderService.ts`, but several critical workflow guarantees are still enforced too late, inconsistently, or only on the client side.

This change makes business logic harder to bypass, easier to audit, and safer to use in bulk admin workflows while preserving demo-mode usability.

## Problem Statement

The current implementation has important gaps against the AGENTS.md business rules:

- External contractor documentation blocks external certification, but not assignment. This allows non-compliant contractors to receive work they should not be assigned.
- Client acceptance can transition an order to `client_accepted` without guaranteeing a corresponding `certification_audits.cert_type = 'client'` row, while invoicing later expects that audit evidence.
- Bulk certification and invoicing actions can partially fail without clear per-order reporting.
- Direct-order semantics are inconsistent: runtime logic treats `client_id IS NULL` as direct order, while migration notes and collaborator logic also reference `assigned_collaborator_id`.
- Server-side enforcement for valid transitions and prerequisites is incomplete or duplicated outside the database/RPC boundary.
- Demo mode must mirror the same constraints so demos do not present an impossible production workflow.

## Scope

### In Scope

1. **Assignment compliance gate**
   - Block assignment to external contractors unless required contractor documents are present, approved, and unexpired.
   - Align UI/service validation, Supabase enforcement, and demo-mode behavior.
   - Return actionable errors that identify missing or invalid document requirements.

2. **Certification and audit lifecycle alignment**
   - Define exactly which status transitions create or require `certification_audits` rows.
   - Ensure client acceptance and client audit evidence are atomic: no `client_accepted` status without the required `cert_type = 'client'` audit record.
   - Preserve internal certification prerequisites: complete Rückmeldung details and required photos.
   - Preserve external contractor acceptance/certification checks while moving the blocker earlier to assignment as well.

3. **Bulk action error reporting**
   - Replace silent per-item failures with structured results: succeeded, failed, skipped, and reason per work order.
   - Keep successful items durable when partial success is allowed, but make partial success visible to admins.
   - Avoid UI claims that all selected orders were processed when any item failed.

4. **Direct-order model cleanup**
   - Clarify canonical direct-order semantics for MVP.
   - Resolve the mismatch between `client_id IS NULL` and `assigned_collaborator_id` language.
   - Define how direct orders move through certification and invoicing, including whether they skip `sent_to_client` / `client_accepted` and which audit prerequisite is required.

5. **DB/RPC enforcement design for critical invariants**
   - Move or duplicate critical workflow invariants to Supabase-side enforcement where direct table access could bypass the service layer.
   - Prefer RPC functions for multi-step atomic transitions that need status update + audit insert + history insert.
   - Do not apply migrations locally; any approved implementation should only create SQL migration files for Alejandro to apply.

6. **Demo parity**
   - Update demo fixtures and Supabase mock behavior during implementation so document compliance, audit lifecycle, bulk results, and direct-order rules behave like production.

### Out of Scope

- Replacing the whole work-order workflow engine.
- Adding new HR/payroll compliance features beyond contractor document assignment eligibility.
- Applying Supabase migrations from this machine.
- Regenerating `database.types.ts` manually.
- Redesigning certification UI beyond the changes needed to surface accurate validation and bulk errors.
- Changing the NEXUS.OS visual system.

## Affected Areas

Likely implementation areas, subject to spec/design refinement:

- `src/services/workOrderService.ts`
  - Assignment validation.
  - Status transition prerequisite validation.
  - Certification audit creation/fetching.
  - Bulk certification/invoicing service helpers if present or added.

- `src/services/contractorDocumentService.ts`
  - Reuse or adapt contractor compliance checks for assignment-time enforcement.

- Supabase migrations and policies/triggers/RPCs
  - Contractor assignment blocker.
  - Atomic transition functions for acceptance/invoicing where needed.
  - Server-side prerequisites for status transitions and audit existence.
  - Direct-order constraints or comments/docs that make the model unambiguous.

- Certification / invoicing / assignment UI flows
  - Display compliance blockers before assignment.
  - Display per-order bulk operation results.
  - Avoid misleading success toasts or aggregate-only status.

- Demo mode
  - `src/lib/demo/fixtures.ts`.
  - `src/lib/demo/supabase-mock.ts` or equivalent mock service paths.

- Tests
  - Vitest unit/integration coverage for service-layer rules.
  - Schema migration tests where appropriate.
  - Demo-mode tests if current test harness supports them.

## Risks

- **Workflow compatibility risk:** Existing data may contain orders assigned to non-compliant contractors or orders in `client_accepted` without client audit rows. Implementation may need a migration/backfill or guarded rollout path.
- **Direct-order ambiguity risk:** Choosing the wrong canonical direct-order definition could break billing assumptions. This requires explicit design before implementation.
- **Database enforcement complexity:** Overlapping service validation, RLS, triggers, and RPCs can diverge if not designed as a single contract.
- **Bulk UX risk:** Partial success must be visible without making common admin flows unnecessarily slow or noisy.
- **Demo drift risk:** If demo fixtures/mocks are not updated with the same constraints, Jarl may demo behavior that production rejects.
- **Review workload risk:** This touches business logic, DB migration design, tests, and UI feedback. Tasks should be sliced to keep reviewable diffs manageable.

## Rollback

Rollback should be planned at two levels:

1. **Application rollback**
   - Revert service/UI/demo changes if validation blocks legitimate operations.
   - Keep tests documenting the intended rules so regressions are explicit.

2. **Database rollback**
   - Any future migration must include reversible `DROP TRIGGER`, `DROP FUNCTION`, or constraint rollback notes.
   - Because migrations must not be applied locally from this machine, rollback execution remains with Alejandro/Supabase deployment owner.
   - Prefer additive RPC/trigger changes over destructive schema changes for MVP hardening.

For existing bad data, implementation should prefer preflight reports/backfill migrations over hard constraints that immediately strand production rows without remediation.

## Success Criteria

- Assignment to an external contractor is blocked when required contractor documents are missing, unapproved, or expired.
- A work order cannot reach `client_accepted` without a corresponding client certification audit, or the transition operation atomically creates that audit.
- A client-backed order cannot be invoiced without client acceptance/audit evidence; a direct order follows the explicitly documented direct-order prerequisite.
- Bulk certification and invoicing actions report per-order success/failure with actionable reasons.
- Direct-order semantics are documented and consistently implemented across runtime logic, migrations, and demo fixtures.
- Critical invariants are enforceable server-side through Supabase triggers/RPCs/constraints as designed, not only through React UI paths.
- Demo mode remains usable and mirrors production constraints.
- Strict TDD evidence is available during implementation: `npm test` for RED/GREEN, plus `npm run typecheck` and `npm run lint` before completion.

## Testing and Validation Expectations

Strict TDD is active for this repository. Implementation should include failing tests before behavior changes where practical, then pass:

- `npm test`
- `npm run typecheck`
- `npm run lint`

Supabase migrations must be authored but not applied locally. Migration behavior should be covered by SQL/schema tests or documented manual verification steps where automated execution is not available.
