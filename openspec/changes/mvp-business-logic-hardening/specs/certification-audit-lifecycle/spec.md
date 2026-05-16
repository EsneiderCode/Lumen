# Certification Audit Lifecycle Delta Spec

## ADDED Requirements

### Requirement: Internal certification prerequisites

The system MUST NOT internally certify a work order unless the required Rückmeldung details, required photos, and internal certification evidence are complete for that work type. Successful internal certification MUST create or require a durable `certification_audits` record with `cert_type = 'internal'`.

#### Scenario: Complete Rückmeldung can be internally certified

Given a work order has all required Rückmeldung fields and photos for its work type
And no blocking validation errors exist
When an authorized user internally certifies the work order
Then the work order MAY transition to `internally_certified`
And an internal certification audit record MUST exist for that certification event.

#### Scenario: Incomplete Rückmeldung blocks internal certification

Given a work order is missing required Rückmeldung details or required photos
When an authorized user attempts internal certification
Then the certification MUST be rejected
And the work order MUST NOT transition to `internally_certified`
And no successful internal certification audit row MUST be created for that failed attempt.

### Requirement: Client acceptance and client audit evidence are atomic

For client-backed work orders, the system MUST NOT allow status `client_accepted` unless a corresponding `certification_audits` record with `cert_type = 'client'` exists. The transition operation MUST either atomically create the client audit record with the status/history update or require a pre-existing valid client audit record before the status update commits.

#### Scenario: Client acceptance creates client audit atomically

Given a client-backed work order is eligible for client acceptance
And the acceptance operation includes valid client audit evidence
When the work order is accepted by the client
Then the work order MUST transition to `client_accepted`
And a `certification_audits` row with `cert_type = 'client'` MUST exist for that work order
And the status update, audit insert, and history insert MUST commit atomically.

#### Scenario: Client acceptance fails when audit evidence cannot be recorded

Given a client-backed work order is otherwise eligible for client acceptance
When the operation cannot create or associate a valid client audit record
Then the work order MUST NOT transition to `client_accepted`
And no status history entry MUST claim client acceptance succeeded.

#### Scenario: Existing accepted order without client audit cannot be silently invoiced

Given a client-backed work order has status `client_accepted`
But no corresponding client certification audit record exists
When invoicing validation runs
Then invoicing MUST be rejected
And the error MUST identify the missing client audit evidence as a data remediation issue.

### Requirement: Client-backed invoicing prerequisites

A client-backed work order MUST NOT transition to `invoiced` unless it is `client_accepted` and has valid client certification audit evidence. The invoicing operation MUST enforce these prerequisites in the service layer and production Supabase-side controls.

#### Scenario: Client-backed accepted order with audit can be invoiced

Given a client-backed work order has status `client_accepted`
And a valid `certification_audits` row with `cert_type = 'client'` exists
When an authorized user invoices the work order
Then the work order MUST transition to `invoiced`
And invoice history MUST be recorded consistently.

#### Scenario: Client-backed order cannot be invoiced before client acceptance

Given a client-backed work order is not in status `client_accepted`
When an authorized user attempts to invoice the work order
Then invoicing MUST be rejected
And the work order MUST NOT transition to `invoiced`.

### Requirement: Server-side lifecycle enforcement

Critical certification, client acceptance, and invoicing invariants MUST be enforceable on the Supabase side through RPCs, triggers, constraints, or equivalent database controls. Multi-step lifecycle transitions that combine status changes, audit writes, and history writes MUST be atomic.

#### Scenario: Direct status update cannot bypass client audit requirement

Given a client-backed work order has no valid client audit record
When a direct production data path attempts to set status to `client_accepted`
Then Supabase-side enforcement MUST reject the update
And the work order status MUST remain unchanged.

#### Scenario: Direct status update cannot bypass invoicing prerequisites

Given a client-backed work order lacks client acceptance or client audit evidence
When a direct production data path attempts to set status to `invoiced`
Then Supabase-side enforcement MUST reject the update
And the work order status MUST remain unchanged.

#### Scenario: Failed atomic lifecycle transition leaves no partial audit

Given a client acceptance RPC writes status, audit, and history together
When one of those writes fails
Then none of the writes in that operation MUST be committed
And subsequent reads MUST NOT observe a client audit without the matching status/history or a status/history without the matching audit.
