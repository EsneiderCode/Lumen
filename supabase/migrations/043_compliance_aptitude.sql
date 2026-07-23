-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 043 — Compliance aptitude engine + assignment gate + expiry sweep
-- Depends on: 042_compliance_core.sql
-- Purpose:
--   - country_origin_bucket()       : ISO country → requirement origin bucket
--   - applicable_requirement_ids()  : which matrix rows apply to an entity
--                                     (mirrors src/services/complianceRequirementEngine.ts)
--   - compute_entity_aptitude()     : traffic light (green/yellow/red) per
--                                     entity and obra, with explicit missing list
--   - Assignment gate trigger       : draft → confirmed blocked while red,
--                                     unless an audited override is set
--   - run_compliance_expiry_sweep() : daily transitions approved → expiring →
--                                     expired (Europe/Berlin). Scheduling +
--                                     notifications arrive in a later phase.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Country → origin bucket ──────────────────────────────────────────────────
-- EU/EEA/CH members (minus DE/ES which have their own buckets) map to EU_OTHER;
-- everything else is NON_EU.

CREATE OR REPLACE FUNCTION public.country_origin_bucket(p_country TEXT)
RETURNS public.requirement_origin
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN upper(COALESCE(p_country, '')) = 'DE' THEN 'DE'::public.requirement_origin
    WHEN upper(COALESCE(p_country, '')) = 'ES' THEN 'ES'::public.requirement_origin
    WHEN upper(COALESCE(p_country, '')) = ANY (ARRAY[
      'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT',
      'LV','LT','LU','MT','NL','PL','PT','RO','SE','SI','SK',
      'IS','LI','NO','CH'
    ]) THEN 'EU_OTHER'::public.requirement_origin
    ELSE 'NON_EU'::public.requirement_origin
  END;
$$;

-- 2) Applicable requirements for an entity ────────────────────────────────────
-- A matrix row applies iff: active, applies_to = entity.kind, origin matches
-- the entity's bucket (or ALL), and conditions is a subset of attributes
-- (JSONB containment: '{}' always applies).

CREATE OR REPLACE FUNCTION public.applicable_requirement_ids(p_entity_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.id
  FROM public.compliance_entities e
  JOIN public.document_requirements r
    ON r.is_active
   AND r.applies_to = e.kind
   AND (r.origin = 'ALL' OR r.origin = public.country_origin_bucket(e.country_code))
   AND r.conditions <@ e.attributes
  WHERE e.id = p_entity_id;
$$;

-- 3) Aptitude computation ─────────────────────────────────────────────────────
-- Level semantics:
--   green  : every applicable mandatory requirement approved and valid for the
--            obra and its assignment dates
--   yellow : approved but expiring soon, or optional requirements outstanding
--   red    : any mandatory requirement missing / in review / rejected /
--            expired / failing amount, coverage or date-coverage validation
-- A company_worker can never rank better than its company for the same obra.
-- `missing` lists every problem explicitly (document type code + reason).

CREATE OR REPLACE FUNCTION public.compute_entity_aptitude(
  p_entity_id  UUID,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (level TEXT, missing JSONB)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity      public.compliance_entities%ROWTYPE;
  v_start       DATE;
  v_end         DATE;
  v_today       DATE := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_req         RECORD;
  v_doc         public.entity_documents%ROWTYPE;
  v_found       BOOLEAN;
  v_reason      TEXT;
  v_severity    TEXT;
  v_problems    JSONB := '[]'::jsonb;
  v_has_red     BOOLEAN := false;
  v_has_yellow  BOOLEAN := false;
  v_parent      RECORD;
BEGIN
  SELECT * INTO v_entity FROM public.compliance_entities WHERE id = p_entity_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'red'::text,
      jsonb_build_array(jsonb_build_object(
        'severity', 'red', 'document_type', NULL,
        'reason', 'entity_not_found'));
    RETURN;
  END IF;

  -- Assignment window for must_cover_assignment checks (latest active one).
  IF p_project_id IS NOT NULL THEN
    SELECT pa.start_date, pa.end_date INTO v_start, v_end
    FROM public.project_assignments pa
    WHERE pa.entity_id = p_entity_id
      AND pa.project_id = p_project_id
      AND pa.status IN ('draft', 'confirmed')
    ORDER BY pa.created_at DESC
    LIMIT 1;
  END IF;

  FOR v_req IN
    SELECT r.*, dt.code AS type_code
    FROM public.document_requirements r
    JOIN public.document_types dt ON dt.id = r.document_type_id
    WHERE r.id IN (SELECT public.applicable_requirement_ids(p_entity_id))
  LOOP
    -- Per-project requirements only participate when evaluating an obra.
    IF v_req.scope = 'per_project' AND p_project_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT ed.* INTO v_doc
    FROM public.entity_documents ed
    WHERE ed.entity_id = p_entity_id
      AND ed.requirement_id = v_req.id
      AND (
        (v_req.scope = 'entity'      AND ed.project_id IS NULL)
        OR
        (v_req.scope = 'per_project' AND ed.project_id = p_project_id)
      )
    LIMIT 1;
    v_found := FOUND;
    v_reason := NULL;

    IF NOT v_found OR v_doc.status IN ('pending', 'not_applicable') THEN
      v_reason := 'missing';
    ELSIF v_doc.status IN ('in_review', 'rejected', 'expired') THEN
      v_reason := v_doc.status::text;
    ELSE
      -- status is approved or expiring — run validity checks on the
      -- reviewer-confirmed metadata.
      IF v_req.validity_rule = 'expiry_required' THEN
        IF v_doc.approved_expires_at IS NULL OR v_doc.approved_expires_at < v_today THEN
          v_reason := 'expired';
        END IF;
      ELSIF v_req.validity_rule = 'days_from_issue' THEN
        IF v_doc.approved_issued_at IS NULL
           OR v_doc.approved_issued_at + v_req.validity_days < v_today THEN
          v_reason := 'expired';
        END IF;
      ELSIF v_req.validity_rule = 'must_cover_assignment' THEN
        IF v_start IS NOT NULL THEN
          IF v_doc.approved_issued_at IS NULL OR v_doc.approved_expires_at IS NULL
             OR v_doc.approved_issued_at > v_start
             OR v_doc.approved_expires_at < v_end THEN
            v_reason := 'does_not_cover_assignment';
          END IF;
        ELSIF v_doc.approved_expires_at IS NOT NULL AND v_doc.approved_expires_at < v_today THEN
          v_reason := 'expired';
        END IF;
      END IF;

      IF v_reason IS NULL AND v_req.min_amount IS NOT NULL
         AND (v_doc.approved_amount IS NULL OR v_doc.approved_amount < v_req.min_amount) THEN
        v_reason := 'amount_below_minimum';
      END IF;

      IF v_reason IS NULL AND v_req.requires_coverage_confirmation
         AND NOT v_doc.coverage_confirmed THEN
        v_reason := 'coverage_not_confirmed';
      END IF;

      IF v_reason IS NULL AND v_doc.status = 'expiring' THEN
        v_reason := 'expiring_soon';
      END IF;
    END IF;

    IF v_reason IS NOT NULL THEN
      -- expiring_soon is always a warning; every other problem on an optional
      -- requirement is a warning too; problems on mandatory ones are blocking.
      IF v_reason = 'expiring_soon' OR NOT v_req.is_mandatory THEN
        v_severity := 'yellow';
        v_has_yellow := true;
        IF NOT v_req.is_mandatory AND v_reason <> 'expiring_soon' THEN
          v_reason := 'optional_' || v_reason;
        END IF;
      ELSE
        v_severity := 'red';
        v_has_red := true;
      END IF;
      v_problems := v_problems || jsonb_build_object(
        'severity', v_severity,
        'document_type', v_req.type_code,
        'reason', v_reason
      );
    END IF;
  END LOOP;

  -- Workers are capped by their company's aptitude for the same obra.
  IF v_entity.kind = 'company_worker' AND v_entity.parent_entity_id IS NOT NULL THEN
    SELECT * INTO v_parent
    FROM public.compute_entity_aptitude(v_entity.parent_entity_id, p_project_id);
    IF v_parent.level = 'red' THEN
      v_has_red := true;
      v_problems := v_problems || jsonb_build_object(
        'severity', 'red', 'document_type', NULL, 'reason', 'company_not_apt');
    ELSIF v_parent.level = 'yellow' THEN
      v_has_yellow := true;
      v_problems := v_problems || jsonb_build_object(
        'severity', 'yellow', 'document_type', NULL, 'reason', 'company_has_warnings');
    END IF;
  END IF;

  RETURN QUERY SELECT
    CASE WHEN v_has_red THEN 'red'
         WHEN v_has_yellow THEN 'yellow'
         ELSE 'green' END::text,
    v_problems;
END;
$$;

-- 4) Assignment gate ──────────────────────────────────────────────────────────
-- Confirming an assignment of a NO-APTO entity is blocked. Administration can
-- force it with override=true + reason + override_by (audited by the row).

CREATE OR REPLACE FUNCTION public.enforce_assignment_aptitude()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_apt RECORD;
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    IF NOT NEW.override THEN
      SELECT * INTO v_apt
      FROM public.compute_entity_aptitude(NEW.entity_id, NEW.project_id);
      IF v_apt.level = 'red' THEN
        RAISE EXCEPTION
          'Assignment blocked: entity is not apt for this project. Missing: %',
          v_apt.missing::text
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_assignments_enforce_aptitude ON public.project_assignments;
CREATE TRIGGER project_assignments_enforce_aptitude
  BEFORE INSERT OR UPDATE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_aptitude();

-- 5) Daily expiry sweep ───────────────────────────────────────────────────────
-- Transitions approved → expiring (inside the largest notify window) and
-- approved/expiring → expired, using reviewer-confirmed dates and
-- Europe/Berlin "today". Returns the number of rows touched.
-- Scheduling (pg_cron) and the notification fan-out are added in the
-- notifications phase; the function is already safe to run ad hoc.

CREATE OR REPLACE FUNCTION public.run_compliance_expiry_sweep()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today   DATE := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_touched INTEGER := 0;
  v_count   INTEGER;
BEGIN
  -- Effective expiry date per item:
  --   expiry_required / must_cover_assignment → approved_expires_at
  --   days_from_issue                         → approved_issued_at + validity_days
  WITH effective AS (
    SELECT
      ed.id,
      ed.status,
      CASE
        WHEN r.validity_rule = 'days_from_issue'
          THEN ed.approved_issued_at + r.validity_days
        ELSE ed.approved_expires_at
      END AS expires_on,
      (SELECT max(d) FROM unnest(r.notify_days) AS d) AS warn_days
    FROM public.entity_documents ed
    JOIN public.document_requirements r ON r.id = ed.requirement_id
    WHERE ed.status IN ('approved', 'expiring')
      AND r.validity_rule <> 'no_expiry'
  ),
  expired AS (
    UPDATE public.entity_documents ed
    SET status = 'expired'
    FROM effective ef
    WHERE ed.id = ef.id
      AND ef.expires_on IS NOT NULL
      AND ef.expires_on < v_today
    RETURNING ed.id
  )
  SELECT count(*) INTO v_count FROM expired;
  v_touched := v_touched + v_count;

  WITH effective AS (
    SELECT
      ed.id,
      ed.status,
      CASE
        WHEN r.validity_rule = 'days_from_issue'
          THEN ed.approved_issued_at + r.validity_days
        ELSE ed.approved_expires_at
      END AS expires_on,
      (SELECT max(d) FROM unnest(r.notify_days) AS d) AS warn_days
    FROM public.entity_documents ed
    JOIN public.document_requirements r ON r.id = ed.requirement_id
    WHERE ed.status = 'approved'
      AND r.validity_rule <> 'no_expiry'
  ),
  expiring AS (
    UPDATE public.entity_documents ed
    SET status = 'expiring'
    FROM effective ef
    WHERE ed.id = ef.id
      AND ef.expires_on IS NOT NULL
      AND ef.expires_on >= v_today
      AND ef.expires_on - v_today <= COALESCE(ef.warn_days, 30)
    RETURNING ed.id
  )
  SELECT count(*) INTO v_count FROM expiring;
  v_touched := v_touched + v_count;

  RETURN v_touched;
END;
$$;
