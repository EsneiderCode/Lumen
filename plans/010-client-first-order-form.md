# Plan 010 — Client-first order form, client-owned catalogs, executor-driven certification

Status: TODO
Priority: P1 · Effort: L
Provenance: orchestrated planning (Orca DAG 2026-07-29). Annexes hold the full detail:
- `plans/scratch/010-exploration.md` — codebase map (codex)
- `plans/scratch/010-data-model.md` — schema/migrations/state machine (codex)
- `plans/scratch/010-ui-admin.md` — UI/admin CRUD plan (grok)

This document is the contract; where an annex conflicts with the decisions below,
this document wins.

## Business rules (canonical, from owner)

1. The **client** is the root of all selection in the new-order form. Selecting a
   client filters **its** projects (e.g., Insyte → Rossdorf) and **its** service/price
   catalog. Clients are admin-managed master data (CRUD).
2. **Operator is removed** from the order flow — irrelevant once the client is chosen.
3. The **NE3/NE4 line field is removed** from the form. Careful: `work_orders.line`
   (NE3/NE4) ≠ `segment_kind` (RA/RD) ≠ POP/DP site reference — the RA/RD + POP→DP
   work reference **stays** (see exploration §Scope).
4. After the client, the decisive choice is the **executor type**:
   - `external_contractor` → internal (Nexus) certification **then** client certification.
   - `own_team` → **direct** client certification, no intermediate internal step.
5. Personnel splits into two admin-managed categories: **own teams/employees** and
   **external collaborators (contractors)**. The executor selector sources from these.

## Resolved decisions (conflicts between annexes)

| # | Conflict | Resolution |
|---|----------|------------|
| D1 | UI annex kept operator/line "hidden but persisted via project defaults"; data annex omits them for new orders | **Omit for v2 orders.** New-flow orders write `operator_id = NULL`, `line = NULL`. No hidden fields, no save-blocking on project defaults. Historical rows keep their values; PDF/DATEV/NE4-bridge render them only when present. UI annex §2 "hidden but persisted" and §4 validation rules 4/6 are overridden. |
| D2 | UI annex kept teams as `team_color` enum; data annex creates a `teams` table | **Create `teams` master data** (migration 067) with admin CRUD. The user requirement is explicit: admin creates/edits/deletes the personnel source. UI annex §5 "no new teams table" is overridden; personnel tab gains team management. |
| D3 | UI annex left executor category as UI-only state; data annex persists it | **Persist `executor_type` on `work_orders`** (+ `executor_team_id` / `executor_entity_id`). Certification guards must never derive the path from a mutable `profiles.role`. Chosen on the create form, confirmed at assignment, frozen from `in_progress`. |

Other adopted decisions (from `010-data-model.md`, with deploy-window hardening):
`flow_version` v1/v2 compatibility column; migration 065 backfills unambiguous
`projects.client_id` evidence but leaves no-evidence Direktauftrag projects nullable;
`service_items` stays the single catalog table with a `legacy_only` flag; own
personnel = `employees`, contractors = top-level `compliance_entities` (no
duplicate table); soft-deactivate everywhere, no hard deletes of referenced
master data.

Deploy-window decisions confirmed by review:
- Migration 070 is deferred to a later PR after the old UI has been cut over;
  it adds both
  `projects.client_id SET NOT NULL` and
  `service_items_client_required_unless_legacy`; migrations 065–066 must not
  reject writes still produced by the running old app.
- `validate_client_first_work_order()` is `SECURITY DEFINER` with
  `search_path = public, pg_temp`. On UPDATE it returns immediately when all
  routing-relevant columns are unchanged, so status-only field work does not
  re-read RLS-protected executor data; real routing changes still hit the
  freeze-from-`in_progress` guard.
- `clients.notes` is excluded from ordinary authenticated column privileges.
  Permission-gated readers use the checked `get_client_notes()` RPC; the open
  client lookup policy exposes only non-sensitive master-data fields.

## State machine (target, v2)

```
own_team:            … → rueckmeldung_sent → sent_to_client → client_accepted → invoiced → paid
external_contractor: … → rueckmeldung_sent → internally_certified → sent_to_client → …
```

Guards live in checked RPCs (lock → validate → update → history, one transaction);
direct status updates for certification-sensitive transitions are revoked. v1 orders
keep today's behavior, including the direct-order invoicing shortcut. Full detail:
`010-data-model.md` §State machine.

## Work slices (execution order)

| Slice | Content | Depends on |
|-------|---------|-----------|
| A. Migrations 065–070 | client master data → client-owned catalog → teams/personnel links → work-order routing columns + validator → certification-path RPCs → post-cutover cleanup (070 is post-deploy only and enforces project/catalog client constraints). Sequence + backfill rules: `010-data-model.md` §Migration sequence, §Backfill | — (verify numbering first, see Open questions Q1) |
| B. Services + RLS | `clientService.ts` (new), `fetchProjects(clientId)` required, client-scoped catalog fetch (drop operator from applicability, mirror in `rueckmeldungLoader.ts`), executor option queries (no payroll exposure), portal RLS via `executor_entity_id` | A |
| C. Order form | `WorkOrderFormPage.tsx` client-first cascade (client → executor type → project → service), remove operator/line/`derived data` disclosure, cert-path callout, `WorkOrderAssignPage.tsx` category split. Detail: `010-ui-admin.md` §2–4 minus D1/D3 overrides | B |
| D. Admin CRUD | `/admin/clients` (new page + nav), per-client filters on Projects/ServiceItems pages, personnel category tabs (own teams incl. team CRUD per D2 / external collaborators). Detail: `010-ui-admin.md` §5 | B |
| E. i18n + demo + tests | de/es keys (`010-ui-admin.md` §6), fixtures with ≥2 clients + both executor paths, mock chain methods + checked RPCs, demo-store versioning note, test list (`010-data-model.md` §Generated types…) | C, D |

Ship order: A alone (owner applies SQL, regenerates `database.types.ts`), then B–E
as feature branches per repo flow (`npm run feature:start`, PR to `origin/develop`).

## Open questions for owner (do not block planning, block implementation)

- **Q1 — migration numbering**: `origin/develop` showed 062 while local
  `develop`/`upstream` has 063–064. Re-run
  `git ls-tree origin/develop supabase/migrations/` immediately before reserving
  065–070.
- **Q2 — Direktauftrag**: keep the direct-order toggle with global (`client_id IS
  NULL`) catalog rows, or fold direct orders into a house client? Plan assumes keep.
- **Q3 — unresolved v1 backfill**: migration 065 aborts only when historical
  project→client evidence conflicts. No-evidence projects are reported by NOTICE
  and remain nullable because they may be legitimate Direktauftrag projects;
  they must be resolved before migration 070 can enforce `NOT NULL`.

## STOP conditions

- STOP if `git ls-tree origin/develop supabase/migrations/` shows numbers ≥065
  already taken — renumber before writing any SQL.
- STOP slice A if the backfill export (Q3) finds conflicting project→client
  evidence and the owner has not mapped it.
- STOP before touching `service worker`, NE4 bridge contract, or scheduler
  appointment forms — out of scope (bridge keeps inserting v1 orders).
- Never edit `database.types.ts` by hand; regenerate after the owner applies SQL.
