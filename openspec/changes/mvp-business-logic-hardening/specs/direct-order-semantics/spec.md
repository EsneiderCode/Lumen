# Direct Order Semantics Delta Spec

## ADDED Requirements

### Requirement: Canonical direct-order definition

For the MVP, a work order MUST be considered a direct order when and only when `client_id IS NULL`. `assigned_collaborator_id` MUST NOT determine whether a work order is direct; it MAY identify the assigned collaborator/contractor according to assignment rules. Runtime logic, migrations, service validation, documentation comments, and demo fixtures MUST use this same definition.

#### Scenario: Work order without client is direct

Given a work order has `client_id` set to `NULL`
When direct-order classification runs
Then the work order MUST be classified as a direct order
Regardless of whether `assigned_collaborator_id` is set.

#### Scenario: Work order with client is client-backed

Given a work order has a non-null `client_id`
When direct-order classification runs
Then the work order MUST be classified as client-backed
Regardless of whether `assigned_collaborator_id` is set.

#### Scenario: Collaborator assignment does not change direct-order classification

Given a direct order has no `client_id`
When the order is assigned to or unassigned from a collaborator
Then the order MUST remain classified as direct
And no runtime or migration logic MUST infer client-backed status from `assigned_collaborator_id`.

### Requirement: Direct-order lifecycle prerequisites

Direct orders MUST skip external client delivery and client acceptance prerequisites for invoicing. A direct order MUST NOT require a client certification audit with `cert_type = 'client'`; instead, invoicing MUST require internal certification and a valid internal certification audit unless a later approved design introduces an explicit direct-order audit type.

#### Scenario: Direct order can be invoiced after internal certification

Given a direct order has status `internally_certified`
And a valid internal certification audit exists
When an authorized user invoices the direct order
Then the direct order MUST transition to `invoiced`
And no client acceptance status or client certification audit MUST be required.

#### Scenario: Direct order cannot be invoiced before internal certification

Given a direct order is not internally certified or lacks a valid internal certification audit
When an authorized user attempts to invoice the direct order
Then invoicing MUST be rejected
And the direct order MUST NOT transition to `invoiced`.

#### Scenario: Direct order is not forced through sent-to-client or client-accepted statuses

Given a direct order has completed internal certification
When the workflow evaluates next valid states
Then `sent_to_client` and `client_accepted` MUST NOT be mandatory prerequisites for invoicing
And the order MAY proceed to invoicing according to direct-order rules.

### Requirement: Direct-order server-side enforcement

Production Supabase-side controls MUST enforce the canonical direct-order invoicing prerequisites and MUST NOT apply client-backed audit/acceptance requirements to direct orders.

#### Scenario: Database rejects direct-order invoice without internal audit

Given a direct order lacks valid internal certification audit evidence
When a production data path attempts to set status to `invoiced`
Then Supabase-side enforcement MUST reject the update
And the direct order status MUST remain unchanged.

#### Scenario: Database allows direct-order invoice without client audit when internal prerequisites pass

Given a direct order has valid internal certification and audit evidence
And no client audit exists
When an authorized production data path invoices the order
Then Supabase-side enforcement MUST NOT reject the operation solely because client audit evidence is absent.

### Requirement: Client-backed lifecycle remains distinct from direct-order lifecycle

Client-backed work orders MUST continue to require client delivery, client acceptance, and client certification audit evidence before invoicing. The direct-order shortcut MUST NOT be applied to any work order with a non-null `client_id`.

#### Scenario: Client-backed order with internal certification only cannot be invoiced

Given a client-backed work order has internal certification and internal audit evidence
But it has not reached `client_accepted` and lacks client audit evidence
When an authorized user attempts to invoice it
Then invoicing MUST be rejected
And the direct-order invoicing path MUST NOT be used.
