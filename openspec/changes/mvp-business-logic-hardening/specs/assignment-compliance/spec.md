# Assignment Compliance Delta Spec

## ADDED Requirements

### Requirement: External contractor assignment eligibility

The system MUST block assignment of a work order to an external contractor when the contractor is not compliant at assignment time. A contractor is compliant only when every required contractor document is present, approved, and unexpired for the intended assignment date. The blocking decision MUST be enforced consistently by service-layer validation, production Supabase-side controls, and demo mode.

#### Scenario: Compliant external contractor can be assigned

Given an external contractor has all required documents present, approved, and unexpired
And an admin assigns an eligible work order to that contractor
When the assignment is submitted
Then the assignment MUST succeed
And the work order MUST record the contractor assignment
And any assignment/state history written by the workflow MUST remain consistent with the successful assignment.

#### Scenario: Missing contractor document blocks assignment

Given an external contractor is missing at least one required document
When an admin attempts to assign a work order to that contractor
Then the assignment MUST be rejected
And the rejection MUST identify each missing document requirement in an actionable error payload or message
And the work order MUST NOT be assigned to the contractor.

#### Scenario: Unapproved or expired contractor document blocks assignment

Given an external contractor has a required document that is pending, rejected, expired, or expires before the intended assignment date
When an admin attempts to assign a work order to that contractor
Then the assignment MUST be rejected
And the rejection MUST identify the invalid document and reason
And the work order MUST NOT be assigned to the contractor.

#### Scenario: Internal employee assignment is not blocked by contractor document requirements

Given the assignee is an internal employee and not an external contractor
When an admin assigns a work order to that employee
Then contractor document requirements MUST NOT be applied
And assignment eligibility MUST be evaluated only against rules relevant to internal employees.

### Requirement: Server-side contractor assignment enforcement

Production data paths MUST enforce external contractor assignment compliance on the Supabase side so direct table writes, stale clients, or alternate UI paths cannot assign work to a non-compliant external contractor. Multi-step assignment operations SHOULD be exposed through RPC when atomic history/status/assignment writes are required.

#### Scenario: Direct database update cannot bypass compliance

Given an external contractor is non-compliant
When a client attempts to assign a work order through a direct table update or any non-UI production data path
Then Supabase-side enforcement MUST reject the write
And the work order MUST remain unassigned to that contractor.

#### Scenario: Atomic assignment records related history consistently

Given assignment is performed through a server-side RPC that also writes assignment history
When contractor compliance validation passes
Then the assignment and related history MUST commit together
And if any required write fails, all writes in that assignment operation MUST be rolled back.

### Requirement: Assignment compliance error contract

Assignment validation failures MUST return deterministic, per-requirement failure details that UI and bulk operations can display without parsing free text.

#### Scenario: Multiple document failures are reported together

Given an external contractor is missing one required document and has another expired required document
When assignment validation runs
Then the validation result MUST include both failures
And each failure MUST include the document requirement identifier and failure category.

#### Scenario: UI does not claim success after blocked assignment

Given assignment validation fails for contractor compliance
When the assignment action returns to the UI
Then the UI MUST NOT show an all-success confirmation
And it MUST surface the actionable validation failures to the admin.
