# Demo Mode Parity Delta Spec

## ADDED Requirements

### Requirement: Demo mode mirrors production business blockers

Demo mode MUST enforce the same user-visible business constraints as production for contractor assignment compliance, certification prerequisites, client audit lifecycle, invoicing prerequisites, bulk action results, and direct-order semantics. Demo mode MAY use in-memory or fixture-backed checks, but it MUST NOT demonstrate workflows that production rejects.

#### Scenario: Demo blocks non-compliant contractor assignment

Given demo mode is active
And a seeded external contractor is missing, unapproved, or expired for a required document
When a demo admin attempts to assign a work order to that contractor
Then demo mode MUST reject the assignment
And the rejection MUST identify the same categories of document failures as production.

#### Scenario: Demo allows compliant contractor assignment

Given demo mode is active
And a seeded external contractor has all required documents present, approved, and unexpired
When a demo admin assigns a work order to that contractor
Then demo mode MUST allow the assignment
And the demo store MUST reflect the assigned contractor consistently.

#### Scenario: Demo rejects client acceptance without audit evidence

Given demo mode is active
And a client-backed work order lacks valid client audit evidence for acceptance
When a demo user attempts to move the order to `client_accepted`
Then demo mode MUST reject the transition or atomically create the required client audit according to the production contract
And it MUST NOT leave the order in `client_accepted` without client audit evidence.

#### Scenario: Demo rejects invalid invoicing

Given demo mode is active
And a work order does not satisfy its client-backed or direct-order invoicing prerequisites
When a demo user attempts to invoice the work order
Then demo mode MUST reject invoicing
And the demo store MUST NOT transition the work order to `invoiced`.

### Requirement: Demo fixtures cover positive and negative paths

Demo fixtures MUST include enough seeded data to exercise successful and failing examples for contractor compliance, client-backed lifecycle enforcement, direct-order invoicing, and bulk partial-success reporting.

#### Scenario: Demo includes compliant and non-compliant contractors

Given demo fixtures are loaded
When assignment flows are tested or demonstrated
Then at least one external contractor fixture MUST be assignment-compliant
And at least one external contractor fixture MUST be non-compliant for an actionable document reason.

#### Scenario: Demo includes client-backed audit lifecycle examples

Given demo fixtures are loaded
When certification and invoicing flows are tested or demonstrated
Then fixtures MUST include client-backed orders that can validly progress through client acceptance and invoicing
And fixtures MUST include client-backed orders that fail due to missing prerequisites or audit evidence.

#### Scenario: Demo includes direct-order examples

Given demo fixtures are loaded
When direct-order flows are tested or demonstrated
Then fixtures MUST include at least one direct order identified by `client_id IS NULL`
And the direct order MUST follow direct-order invoicing prerequisites instead of client-backed prerequisites.

### Requirement: Demo bulk action results match production result shape

Demo-mode bulk actions MUST return the same structured result shape as production bulk actions so UI behavior and tests remain representative.

#### Scenario: Demo bulk action returns per-order outcomes

Given demo mode is active
And a demo admin selects a mix of eligible and ineligible work orders for a bulk action
When the bulk action runs
Then the demo result MUST include one outcome per selected work order
And each failed or skipped outcome MUST include an actionable reason.

#### Scenario: Demo UI shows partial success consistently

Given demo mode is active
And a bulk action partially succeeds
When the UI renders the result
Then the UI MUST present partial success using the same semantics as production
And it MUST NOT show an all-success message.

### Requirement: Demo tests protect parity

Implementation MUST include test coverage or documented verification that demo-mode constraints match production constraints for this change. Demo parity MUST be validated with `npm test` where practical.

#### Scenario: Demo parity regression is caught by tests

Given a future change weakens demo-mode assignment, lifecycle, direct-order, or bulk-result validation
When the relevant test suite runs
Then at least one test SHOULD fail before production and demo behavior can drift silently.
