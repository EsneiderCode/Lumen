# Bulk Work Order Actions Delta Spec

## ADDED Requirements

### Requirement: Structured bulk action results

Bulk work-order actions MUST return structured per-order results that distinguish succeeded, failed, and skipped items. A bulk action MUST NOT report aggregate success when any selected item failed or was skipped. Each failed or skipped item MUST include an actionable reason code and human-readable message.

#### Scenario: Mixed certification results report successes and failures

Given an admin selects multiple work orders for bulk internal certification
And some selected orders satisfy certification prerequisites while others do not
When the bulk certification action runs
Then eligible orders MAY be certified successfully
And ineligible orders MUST remain unchanged
And the result MUST list each selected work order as succeeded, failed, or skipped with its reason.

#### Scenario: Mixed invoicing results report successes and failures

Given an admin selects multiple work orders for bulk invoicing
And some selected orders satisfy invoicing prerequisites while others do not
When the bulk invoicing action runs
Then eligible orders MAY be invoiced successfully
And ineligible orders MUST remain unchanged
And the result MUST list each selected work order as succeeded, failed, or skipped with its reason.

#### Scenario: UI surfaces partial success instead of all-success feedback

Given a bulk action returns at least one failure or skipped item
When the UI presents the result
Then the UI MUST NOT claim all selected orders were processed successfully
And it MUST show the partial-success summary and per-order reasons to the admin.

### Requirement: Bulk operations preserve per-order invariants

Bulk actions MUST use the same assignment, certification, client acceptance, invoicing, direct-order, and server-side prerequisites as single-order actions. Bulk processing MUST NOT bypass validations for speed or convenience.

#### Scenario: Bulk invoicing cannot bypass client audit requirement

Given a selected client-backed work order lacks valid client audit evidence
When bulk invoicing runs
Then that work order MUST fail or be skipped with a missing-client-audit reason
And it MUST NOT transition to `invoiced`.

#### Scenario: Bulk certification cannot bypass Rückmeldung completeness

Given a selected work order lacks required Rückmeldung details or required photos
When bulk internal certification runs
Then that work order MUST fail or be skipped with an incomplete-rueckmeldung reason
And it MUST NOT transition to `internally_certified`.

#### Scenario: Bulk assignment cannot bypass contractor compliance

Given a selected work order would be assigned to a non-compliant external contractor
When bulk assignment runs, if bulk assignment exists for this workflow
Then that work order MUST fail or be skipped with contractor document reasons
And it MUST NOT be assigned to the non-compliant contractor.

### Requirement: Bulk action durability and transaction boundaries

Bulk action semantics MUST be explicit: successful per-order operations MAY remain durable when other items fail, but each individual work-order operation MUST be atomic for its own status, audit, history, and related writes.

#### Scenario: Successful items remain durable after partial failure

Given a bulk operation processes multiple work orders independently
And one work order succeeds before another work order fails validation
When the bulk operation completes
Then the successful work order MAY remain updated
And the failed work order MUST remain unchanged
And the response MUST clearly indicate partial success.

#### Scenario: A failed item leaves no partial lifecycle writes

Given a selected work order requires status, audit, and history writes
When that work order's operation fails during the bulk action
Then that work order MUST NOT retain partial status, audit, or history writes from the failed attempt.

### Requirement: Bulk action error contract

Bulk action result payloads MUST be stable enough for tests and UI rendering. For every selected work order, the result MUST include the work-order identifier, outcome, and reason details when outcome is not succeeded.

#### Scenario: Every selected order appears in the result

Given an admin selects five work orders
When a bulk action completes with any mixture of outcomes
Then the result MUST contain exactly one result entry for each selected work order
And no selected work order MUST be omitted from the response.

#### Scenario: Unexpected server error is reported per affected item

Given one selected work order encounters an unexpected server-side error
When the bulk action completes or aborts further processing
Then the result MUST identify which work order failed due to server error when known
And the UI MUST present that not all selected orders were processed.
