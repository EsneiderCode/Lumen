# Apply Progress: MVP Business Logic Hardening

## Workload / PR Boundary

- Delivery path from tasks: `auto-chain`, `stacked-to-main`, high 400-line budget risk.
- This apply run implemented coherent service/schema/demo/bulk slices in one worktree because the user approved unattended continuation.
- Remaining UI/demo fixture polish should be treated as a follow-up review slice before PR.

## Completed Tasks

- [x] 1.1 RED: contract/validator tests for structured workflow reasons and direct-order classification.
- [x] 1.2 GREEN: shared action result/reason types and pure helpers.
- [x] 1.3 REFACTOR: direct-order helper used in service prerequisite/transition paths.
- [x] 2.1 Discovery: checked upstream/local migration numbering; selected `016_mvp_business_logic_hardening.sql` after local `015`.
- [x] 2.2 RED: schema migration tests for hardening RPC/trigger/comment/preflight content.
- [x] 2.3 GREEN: additive SQL migration authored, not applied.
- [x] 2.4 REFACTOR: migration includes rollout/preflight and rollback notes.
- [x] 3.1 RED: service tests for assignment compliance and lifecycle RPC adapters.
- [x] 3.2 GREEN: `assignWorkOrder()` blocks non-compliant contractors and uses `assign_work_order_checked` for compliant contractors.
- [x] 3.3 RED: tests for internal certification, client acceptance, invoicing RPC adapters.
- [x] 3.4 GREEN: added `certifyWorkOrderInternal`, `acceptWorkOrderClient`, `invoiceWorkOrder` with structured error mapping.
- [x] 4.1 RED: demo parity tests for assignment blocker, client acceptance audit creation, direct invoicing.
- [x] 4.3 GREEN: demo RPC implementations for `assign_work_order_checked`, `accept_work_order_client`, `invoice_work_order_checked`.
- [x] 5.1 RED: bulk result service tests for mixed invoice outcomes.
- [x] 5.2 GREEN: `bulkWorkOrderAction()` with per-item outcomes and stable counts.
- [x] Final validation commands run: `npm test`, `npm run typecheck`, `npm run lint`.
- [x] Confirmed no Supabase migration was applied locally and `src/types/database.types.ts` was not edited.

## Files Changed

- `src/services/workOrderBusinessRules.ts` — new shared pure helpers and structured action/result types.
- `src/services/workOrderService.ts` — direct-order helper usage, contractor assignment compliance, lifecycle RPC adapters, bulk action helper.
- `src/services/contractorDocumentService.ts` — no production edit beyond reuse via exported existing document fetch.
- `src/lib/demo/supabase-mock.ts` — demo RPC parity for critical assignment/client acceptance/invoice operations.
- `src/__tests__/workOrderBusinessRules.test.ts` — pure business-rule tests.
- `src/__tests__/workOrderService.test.ts` — assignment compliance and lifecycle adapter tests.
- `src/__tests__/schemaMigrations.test.ts` — migration content coverage.
- `src/__tests__/demoBusinessLogic.test.ts` — demo parity tests.
- `src/__tests__/workOrderBulkActions.test.ts` — bulk action result tests.
- `supabase/migrations/016_mvp_business_logic_hardening.sql` — additive SQL migration with helpers, triggers, RPCs, comments, and preflight notes.
- `openspec/changes/mvp-business-logic-hardening/tasks.md` — completed checkboxes for implemented slices.
- `openspec/changes/mvp-business-logic-hardening/apply-progress.md` — this log.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.3 | `src/__tests__/workOrderBusinessRules.test.ts`, `src/__tests__/workOrderService.test.ts` | Unit | ✅ `workOrderService` + schema baseline: 46 passed | ✅ Missing module/helper failed | ✅ 5 business-rule tests passed; combined 38 passed | ✅ direct/client-backed + missing/unapproved/expired cases | ✅ service direct-order checks use helper; combined tests passed |
| 2.1-2.4 | `src/__tests__/schemaMigrations.test.ts` | Schema text/unit | ✅ schema baseline included in 46 passed | ✅ failed for missing migration 016 content | ✅ 15 schema tests passed | ✅ RPC/trigger and direct-order/preflight assertions | ✅ comments/rollback/preflight included; schema tests passed |
| 3.1-3.4 | `src/__tests__/workOrderService.test.ts` | Unit with Supabase mock | ✅ existing `workOrderService` tests passed before edits | ✅ assignment/RPC adapter tests failed against old service | ✅ 38 tests passed | ✅ blocked contractor + compliant contractor; success + error lifecycle paths | ✅ structured RPC helper extracted; tests passed |
| 4.1/4.3 | `src/__tests__/demoBusinessLogic.test.ts` | Integration-ish demo mock | N/A new focused tests | ✅ demo RPC unsupported failures | ✅ 3 demo parity tests passed | ✅ assignment blocker, client audit creation, direct invoice | ✅ helper functions extracted in mock; focused tests passed |
| 5.1-5.2 | `src/__tests__/workOrderBulkActions.test.ts` | Unit with Supabase mock | N/A new focused tests | ✅ `bulkWorkOrderAction` missing failures | ✅ 2 bulk tests passed | ✅ mixed success/failure + skipped unsupported action | ✅ result counting centralized; focused tests passed |

## Test Commands Run

- `npm test -- src/__tests__/workOrderService.test.ts src/__tests__/schemaMigrations.test.ts` → 2 files, 46 tests passed (baseline).
- `npm test -- src/__tests__/workOrderBusinessRules.test.ts` → RED failed for missing module, then GREEN 5 tests passed.
- `npm test -- src/__tests__/workOrderBusinessRules.test.ts src/__tests__/workOrderService.test.ts` → 2 files, 38 tests passed.
- `npm test -- src/__tests__/schemaMigrations.test.ts` → RED failed for missing migration content, then GREEN 15 tests passed.
- `npm test -- src/__tests__/workOrderService.test.ts` → RED failed assignment/lifecycle tests, then GREEN 38 tests passed.
- `npm test -- src/__tests__/demoBusinessLogic.test.ts` → RED failed unsupported demo RPCs, then GREEN 3 tests passed.
- `npm test -- src/__tests__/workOrderBulkActions.test.ts` → RED failed missing bulk function, then GREEN 2 tests passed.
- `npm test -- src/__tests__/workOrderBusinessRules.test.ts src/__tests__/workOrderService.test.ts src/__tests__/schemaMigrations.test.ts src/__tests__/demoBusinessLogic.test.ts src/__tests__/workOrderBulkActions.test.ts` → 5 files, 63 tests passed.
- `npm run typecheck` → initially failed on helper type strictness, then passed after widening helper input type.
- `npm run lint` → passed.
- `npm test` → 9 files, 122 tests passed.

## Deviations from Design

- Full UI routing was not completed in this pass. `CertificationPage` still needs partial-success rendering and replacement of `Promise.all` with `bulkWorkOrderAction()`.
- Demo fixtures were not expanded with a second compliant contractor fixture. Demo parity tests use existing non-compliant contractor and existing direct/external orders.
- Demo mock implements `assign_work_order_checked`, `accept_work_order_client`, and `invoice_work_order_checked`; `certify_work_order_internal` demo RPC remains follow-up.
- SQL migration is covered by text/schema tests only and was not applied locally, by rule.
- The lifecycle RPC SQL intentionally centralizes atomic writes, but Rückmeldung detail/photo validation inside `certify_work_order_internal` is still a TODO for SQL-level parity; service-level validation remains present for legacy transition path.

## Remaining Tasks / Blockers

- [ ] 3.5 Route `WorkOrderDetailPage` actions to new lifecycle service functions.
- [ ] 4.2 Expand demo fixtures with explicit compliant and non-compliant contractor examples plus more lifecycle positives/negatives.
- [ ] 4.3 Add demo `certify_work_order_internal` RPC parity.
- [ ] 4.4 Decide whether generic demo table updates should block lifecycle bypass or document that only RPC paths are supported.
- [ ] 5.3 Add UI tests for partial-success rendering.
- [ ] 5.4 Replace `CertificationPage` bulk `Promise.all` with `bulkWorkOrderAction()` and render partial result details.
- [ ] 5.5 Review direct-order invoice eligibility filters in UI.
- [ ] Alejandro must review/apply migration 016 and regenerate `database.types.ts`; this agent did not apply migrations or edit generated types.
