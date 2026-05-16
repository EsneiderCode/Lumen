# Tasks: MVP Business Logic Hardening

## Review Workload Forecast

| Field                   | Value                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | 900-1,500 total across SQL, services, demo mock/fixtures, UI, and tests                                                                                  |
| 400-line budget risk    | High                                                                                                                                                     |
| Chained PRs recommended | Yes                                                                                                                                                      |
| Suggested split         | PR 1: contracts/validators/tests → PR 2: SQL migration/tests → PR 3: service RPC adapters/tests → PR 4: demo parity/tests → PR 5: bulk/UI handling/tests |
| Delivery strategy       | auto-chain                                                                                                                                               |
| Chain strategy          | stacked-to-main                                                                                                                                          |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Strict TDD Protocol

- Use `npm test` for every RED and GREEN checkpoint.
- Finish each PR/slice with `npm test`, `npm run typecheck`, and `npm run lint`.
- Record evidence in the apply log for each task: failing test name/output before implementation, passing test output after implementation, and any REFACTOR validation rerun.
- Do not apply Supabase migrations locally. Author SQL only and validate with text/schema tests plus manual verification notes for Alejandro.
- Preserve demo mode parity for every production business-rule path.

## Delivery Plan and Dependencies

### PR 1 — Shared contracts, validators, and direct-order canonical cleanup

- [x] 1.1 RED: Add contract/validator tests for structured workflow reasons and direct-order classification.
  - Depends on: none.
  - Files likely touched: `src/__tests__/workOrderBusinessRules.test.ts` or `src/__tests__/workOrderService.test.ts`, `src/services/workOrderService.ts`, `src/services/contractorDocumentService.ts`, `src/types/contractor-documents.ts`.
  - Verify RED: tests fail for missing `WorkOrderActionReason`, missing multi-document assignment failures, and any direct-order logic not based only on `client_id === null`.

- [x] 1.2 GREEN: Introduce shared action result/reason types and pure helpers.
  - Depends on: 1.1.
  - Files likely touched: `src/services/workOrderService.ts` and/or new `src/services/workOrderBusinessRules.ts`, `src/services/contractorDocumentService.ts`.
  - Implement: `WorkOrderActionErrorCode`, `WorkOrderActionReason`, `WorkOrderActionResult`, direct-order helper, document compliance failure builder that reports missing/unapproved/expired requirements together.
  - Verify GREEN: `npm test` passes targeted tests.

- [x] 1.3 REFACTOR: Replace ad hoc direct-order checks/comments in service/UI with the helper where local and low-risk.
  - Depends on: 1.2.
  - Files likely touched: `src/services/workOrderService.ts`, `src/pages/admin/WorkOrderDetailPage.tsx`, possibly `src/components/admin/InvoicePreviewModal.tsx`.
  - Verify REFACTOR: `npm test`, `npm run typecheck`, `npm run lint`.

### PR 2 — Supabase migration authoring and schema text tests

- [x] 2.1 Discovery: Check latest upstream migration number before naming the migration.
  - Depends on: PR 1 branch base.
  - Discovery target: `git ls-tree upstream/develop supabase/migrations/` and local `supabase/migrations/`.
  - Output: choose next migration filename; do not apply it.

- [x] 2.2 RED: Extend schema migration tests for assignment, lifecycle, direct-order comments, dependencies, and preflight notes.
  - Depends on: 2.1.
  - Files likely touched: `src/__tests__/schemaMigrations.test.ts`.
  - Verify RED: `npm test -- src/__tests__/schemaMigrations.test.ts` or `npm test` fails because migration content is absent.

- [x] 2.3 GREEN: Author additive SQL migration with RPCs/triggers and rollout notes.
  - Depends on: 2.2.
  - Files likely touched: `supabase/migrations/<next>_mvp_business_logic_hardening.sql`.
  - Implement: `contractor_document_compliance_failures(...)`, compatibility wrapper if needed, assignment compliance trigger, lifecycle enforcement trigger, `assign_work_order_checked`, `certify_work_order_internal`, `accept_work_order_client`, `invoice_work_order_checked`, comments documenting `client_id IS NULL`, and preflight/remediation queries.
  - Verify GREEN: schema text tests pass with `npm test`; no local migration apply.

- [x] 2.4 REFACTOR: Tighten SQL comments, rollback notes, and failure code consistency.
  - Depends on: 2.3.
  - Files likely touched: migration and `src/__tests__/schemaMigrations.test.ts`.
  - Verify REFACTOR: `npm test`, `npm run typecheck`, `npm run lint`.

### PR 3 — Production service RPC adapters and single-order lifecycle tests

- [x] 3.1 RED: Add service tests for assignment compliance and lifecycle RPC adapter behavior.
  - Depends on: PR 1 and PR 2.
  - Files likely touched: `src/__tests__/workOrderService.test.ts`, existing Supabase test mock utilities if present.
  - Verify RED: failures show `assignWorkOrder()` does not return structured contractor-document failures and lifecycle transitions still use direct status updates.

- [x] 3.2 GREEN: Update `assignWorkOrder()` to validate contractor compliance and call `assign_work_order_checked` where required.
  - Depends on: 3.1.
  - Files likely touched: `src/services/workOrderService.ts`, `src/services/contractorDocumentService.ts`.
  - Implement: profile-role lookup, assignment-date-aware document failures, legacy `{ data, error }` compatibility where callers still need it, structured reasons for new paths.
  - Verify GREEN: targeted `npm test` passes.

- [x] 3.3 RED: Add tests for atomic internal certification, client acceptance, and invoicing paths.
  - Depends on: 3.2.
  - Files likely touched: `src/__tests__/workOrderService.test.ts`.
  - Verify RED: tests fail because client acceptance can occur without client audit and invoicing does not distinguish client-backed vs direct audit prerequisites.

- [x] 3.4 GREEN: Add service functions for atomic lifecycle operations.
  - Depends on: 3.3.
  - Files likely touched: `src/services/workOrderService.ts`, possibly `src/types/database.types.ts` only if generated types already include RPCs; otherwise use narrow RPC casts with TODO and do not hand-edit generated types.
  - Implement: `certifyWorkOrderInternal`, `acceptWorkOrderClient`, `invoiceWorkOrder`, structured reason mapping for RPC errors, direct-order prerequisite branching.
  - Verify GREEN: targeted `npm test` passes.

- [ ] 3.5 REFACTOR: Route detail-page single-order actions to new service functions without broad UI redesign.
  - Depends on: 3.4.
  - Files likely touched: `src/pages/admin/WorkOrderDetailPage.tsx`, `src/components/admin/InvoicePreviewModal.tsx`.
  - Verify REFACTOR: `npm test`, `npm run typecheck`, `npm run lint`.

### PR 4 — Demo parity in fixtures and Supabase mock

- [x] 4.1 RED: Add demo parity tests for contractor assignment, client acceptance, direct invoicing, and no partial writes.
  - Depends on: PR 3 service contracts.
  - Files likely touched: `src/__tests__/demoBusinessLogic.test.ts`, `src/lib/demo/supabase-mock.ts`, `src/lib/demo/fixtures.ts`.
  - Verify RED: `npm test` fails because demo RPCs/business blockers are missing.

- [ ] 4.2 GREEN: Expand demo fixtures for compliant/non-compliant contractors and lifecycle positive/negative orders.
  - Depends on: 4.1.
  - Files likely touched: `src/lib/demo/fixtures.ts`.
  - Implement: at least one compliant contractor, one non-compliant contractor, client-backed audit lifecycle examples, direct order with `client_id: null` and valid internal audit, direct-order negative path without internal audit.
  - Verify GREEN: fixture-focused tests pass.

- [x] 4.3 GREEN: Implement demo RPC parity for critical operations.
  - Depends on: 4.2.
  - Files likely touched: `src/lib/demo/supabase-mock.ts`, possibly new shared helpers in `src/lib/demo/business-rules.ts`.
  - Implement: `assign_work_order_checked`, `certify_work_order_internal`, `accept_work_order_client`, `invoice_work_order_checked`; ensure per-order in-memory atomicity and same key reason codes.
  - Verify GREEN: `npm test` passes demo parity tests.

- [ ] 4.4 REFACTOR: Ensure generic demo updates cannot visibly bypass app-level constraints or document why only RPC paths are supported.
  - Depends on: 4.3.
  - Files likely touched: `src/lib/demo/supabase-mock.ts`, test files.
  - Verify REFACTOR: `npm test`, `npm run typecheck`, `npm run lint`.

### PR 5 — Bulk action service and UI result handling

- [x] 5.1 RED: Add bulk result service tests for mixed certification/invoicing outcomes.
  - Depends on: PR 3 and PR 4.
  - Files likely touched: `src/__tests__/workOrderBulkActions.test.ts`, `src/services/workOrderService.ts`.
  - Verify RED: tests fail because bulk action result shape is absent and selected item outcomes are omitted.

- [x] 5.2 GREEN: Implement `bulkWorkOrderAction()` using single-order service functions.
  - Depends on: 5.1.
  - Files likely touched: `src/services/workOrderService.ts`.
  - Implement: `BulkWorkOrderOutcome`, `BulkWorkOrderItemResult`, `BulkWorkOrderResult`; one item per selected ID; success/failure/skipped counts; per-item server-error mapping; per-order durability.
  - Verify GREEN: targeted `npm test` passes.

- [ ] 5.3 RED: Add UI tests for partial-success rendering and no all-success claim.
  - Depends on: 5.2.
  - Files likely touched: `src/__tests__/CertificationPage.test.tsx` or existing admin page test file, `src/pages/admin/CertificationPage.tsx`.
  - Verify RED: UI tests fail because current `Promise.all` path discards per-order failures.

- [ ] 5.4 GREEN: Replace bulk `Promise.all` transitions in certification UI with structured bulk results.
  - Depends on: 5.3.
  - Files likely touched: `src/pages/admin/CertificationPage.tsx`.
  - Implement: use `bulkWorkOrderAction()` for certify/send-to-client/invoice as applicable, render partial summary and dense per-order reason list/table using existing NEXUS.OS classes (`panel`, `t`, `badge`, `input`/buttons); avoid toast-only/all-success claims.
  - Verify GREEN: UI tests and `npm test` pass.

- [ ] 5.5 REFACTOR: Review bulk selection filters for direct-order invoice eligibility.
  - Depends on: 5.4.
  - Files likely touched: `src/pages/admin/CertificationPage.tsx`, `src/services/workOrderService.ts`.
  - Implement: ensure direct orders eligible from `internally_certified` with internal audit are not forced through `client_accepted`; ensure client-backed orders still require client acceptance/audit.
  - Verify REFACTOR: `npm test`, `npm run typecheck`, `npm run lint`.

## Final Verification

- [x] Run full validation: `npm test`, `npm run typecheck`, `npm run lint`.
- [x] Confirm no Supabase migration was applied locally and `src/types/database.types.ts` was not manually regenerated.
- [ ] Confirm demo mode still starts with `npm run dev:demo` if a manual smoke test is practical.
- [ ] Confirm every acceptance scenario in `openspec/changes/mvp-business-logic-hardening/specs/*/spec.md` maps to at least one test or documented manual SQL verification step.
- [ ] Prepare reviewer notes per PR: changed files, RED/GREEN/REFACTOR evidence, SQL migration not applied, demo parity coverage, rollback considerations.
