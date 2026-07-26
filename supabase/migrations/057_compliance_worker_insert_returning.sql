-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 057 — A company can finally add its own workers
-- Depends on: 042_compliance_core.sql
-- Purpose:
--   Fixes the 42501 a contractor hits in the portal when adding a worker
--   (ContractorDocumentsPage → ComplianceEntityPanel → createEntity):
--     new row violates row-level security policy for table "compliance_entities"
--
--   The INSERT policy was never the problem. `compliance_entities_own_worker_insert`
--   is correct and passes: the row is a company_worker, it has a parent, and
--   owns_compliance_entity(parent) is true for the logged-in company. Reproduced
--   against a local Postgres 15 with the policies of 042 copied verbatim:
--
--     INSERT ...                    →  INSERT 0 1     (allowed)
--     INSERT ... RETURNING id       →  ERROR 42501    (refused)
--
--   The RETURNING is what fails. Postgres applies the SELECT policies to the row
--   an INSERT returns, and both of them are unusable at that moment:
--     - compliance_entities_view_perm needs `compliance.view`, which a
--       contractor does not have (and must not have — it would expose every
--       entity in the system).
--     - compliance_entities_own_select asks owns_compliance_entity(id), which
--       LOOKS THE ROW UP IN THE TABLE. The row was created by the very statement
--       being checked, and the function is STABLE, so it runs against the
--       statement's snapshot and cannot see it. It returns false, and the insert
--       is reported as an RLS violation.
--
--   `createEntity` in complianceService.ts does `.insert(...).select().single()`,
--   which PostgREST sends as INSERT ... RETURNING, so every worker a company
--   added through the portal has been failing since 042 shipped. Reads always
--   worked, which is why this looked like a permissions or session problem for
--   so long: an EXISTING worker row is visible, only a brand-new one is not.
--
--   The fix is a SELECT policy that judges the row by what the row itself
--   carries — its parent — instead of looking itself up. The parent already
--   exists and is visible, so it works during RETURNING and afterwards alike.
--
--   It grants nothing new: compliance_entities_own_select already lets the owner
--   of a company read its workers, through the `parent.profile_id = auth.uid()`
--   branch of owns_compliance_entity. This says the same thing in a form that
--   does not need the row to be committed first. Verified locally that a
--   stranger still sees zero rows.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "compliance_entities_own_child_select" ON public.compliance_entities;
CREATE POLICY "compliance_entities_own_child_select" ON public.compliance_entities
  FOR SELECT TO authenticated
  USING (
    parent_entity_id IS NOT NULL
    AND public.owns_compliance_entity(parent_entity_id)
  );

COMMENT ON POLICY "compliance_entities_own_child_select" ON public.compliance_entities IS
  'Lets an owner read a child entity from its parent alone, so INSERT ... RETURNING works on a worker that is not committed yet.';

-- The same hole exists on entity_documents: entity_documents_own_insert lets an
-- owner upload, and the service also asks for the row back. Its SELECT twin
-- (entity_documents_own_select) checks owns_compliance_entity(entity_id), and
-- entity_id points at a row that already exists — so that one resolves fine and
-- needs no change. Left here on purpose: it is the first thing to re-check if a
-- similar 42501 ever shows up on a document upload.
