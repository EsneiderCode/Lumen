-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 052 — Capture plans ("Erfassungspläne") for the Rückmeldung
-- Depends on: 001_initial_schema.sql, 016_mvp_business_logic_hardening.sql,
--             034_rbac_core.sql, 035_rbac_policy_migration.sql
-- Purpose:
--   Replace the three fixed photo buckets (before/during/after) and the
--   hardcoded per-work-type detail fields with a DECLARATIVE capture plan:
--     - capture_plans              : versioned plan definitions (JSONB)
--     - work_orders.capture_plan_key : plan override; NULL falls back to work_type
--     - work_order_capture_reports : the technician's answers for an order
--     - work_order_photos.*        : which slot/item each photo belongs to,
--                                    plus when and where it was taken
--
--   The plans live in the DATABASE, not in the frontend, because the
--   certification gate is SQL (assert_work_order_rueckmeldung_complete, 016).
--   If the plan only existed in TypeScript the server could not validate
--   completeness and "no complete Rückmeldung → no internal certification"
--   would degrade from a business rule to a UI rule.
--
--   PHASE 1 IS INERT: this migration only adds structure and seeds one default
--   plan per work_type that reproduces exactly what is enforced today (three
--   photos + the required detail fields of both current gates). Nothing reads
--   the plans yet — the technician UI lands in phase 2, the Soplado-RA plan in
--   phase 3, and the SQL gate starts reading them in phase 5.
--
--   The TypeScript twin of the seeded plans is src/constants/capture-plans.ts;
--   src/__tests__/capturePlans.test.ts compares this file's JSON with it, so the
--   two cannot drift.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Plan catalog ─────────────────────────────────────────────────────────────
-- (key, version) is the identity: a plan is never edited in place, a new version
-- is inserted, so orders captured under the old one stay reproducible. Work
-- orders reference the key only; the current version is resolved at read time.
-- No FK from work_orders: the key must survive a plan being retired.

CREATE TABLE IF NOT EXISTS public.capture_plans (
  key         TEXT    NOT NULL,
  version     INTEGER NOT NULL CHECK (version > 0),
  definition  JSONB   NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key, version),
  -- The blob is self-describing: the client caches it in IndexedDB on its own.
  CONSTRAINT capture_plans_definition_matches_identity CHECK (
    definition->>'key' = key
    AND (definition->>'version')::integer = version
    AND jsonb_typeof(definition->'sections') = 'array'
  )
);

CREATE INDEX IF NOT EXISTS idx_capture_plans_active
  ON public.capture_plans (key, version DESC) WHERE is_active;

DROP TRIGGER IF EXISTS set_updated_at_capture_plans ON public.capture_plans;
CREATE TRIGGER set_updated_at_capture_plans BEFORE UPDATE ON public.capture_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2) Plan selection on the work order ─────────────────────────────────────────
-- "Soplado de RA" is a variant of soplado, not a new work_type: the work_type
-- enum is embedded in seven detail tables and every export.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS capture_plan_key TEXT;

COMMENT ON COLUMN public.work_orders.capture_plan_key IS
  'Capture plan override; NULL = use the plan named after work_type.';

-- 3) The technician's answers ─────────────────────────────────────────────────
-- Deliberately decoupled from the wo_detail_* tables: a new work type or plan
-- must not require DDL. plan_key/plan_version pin the plan the order was
-- captured under, so a later plan version cannot retroactively invalidate it.

CREATE TABLE IF NOT EXISTS public.work_order_capture_reports (
  work_order_id  UUID PRIMARY KEY REFERENCES public.work_orders(id) ON DELETE CASCADE,
  plan_key       TEXT    NOT NULL,
  plan_version   INTEGER NOT NULL,
  answers        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  submitted_at   TIMESTAMPTZ,
  updated_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_order_capture_reports_answers_object CHECK (jsonb_typeof(answers) = 'object')
);

DROP TRIGGER IF EXISTS set_updated_at_capture_reports ON public.work_order_capture_reports;
CREATE TRIGGER set_updated_at_capture_reports BEFORE UPDATE ON public.work_order_capture_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4) Photos: which slot, and where/when it was taken ──────────────────────────
-- photo_type STAYS as it is (NOT NULL, CHECK before/during/after), fed from the
-- slot's legacyType, so the PDF, the admin detail view and the current gate keep
-- working from day one. Photos uploaded before this migration have NULL
-- section_key/slot_key and are matched to slots by photo_type.
--
-- taken_at + coordinates are captured now rather than later on purpose: Vancom
-- demands full Rückmeldung transparency, and a photo with a verifiable time and
-- coordinate is the commercial argument of the system. Backfilling them onto
-- photos already uploaded is impossible.

ALTER TABLE public.work_order_photos
  ADD COLUMN IF NOT EXISTS section_key TEXT,
  ADD COLUMN IF NOT EXISTS slot_key    TEXT,
  ADD COLUMN IF NOT EXISTS item_id     TEXT,
  ADD COLUMN IF NOT EXISTS taken_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS accuracy_m  REAL;

ALTER TABLE public.work_order_photos
  DROP CONSTRAINT IF EXISTS work_order_photos_coords_complete;
ALTER TABLE public.work_order_photos
  ADD CONSTRAINT work_order_photos_coords_complete CHECK (
    (lat IS NULL AND lng IS NULL)
    OR (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
  );

CREATE INDEX IF NOT EXISTS idx_photos_wo_slot
  ON public.work_order_photos (work_order_id, section_key, slot_key);

-- 5) Resolution helpers ───────────────────────────────────────────────────────
-- The SQL twins of capturePlanKeyForOrder() / the client-side plan lookup. The
-- phase-5 gate builds on these; nothing calls them yet.

CREATE OR REPLACE FUNCTION public.work_order_capture_plan_key(p_work_order_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(wo.capture_plan_key), ''), wo.work_type::text)
  FROM public.work_orders wo
  WHERE wo.id = p_work_order_id;
$$;

-- Highest active version of a plan. Returns NULL for an unknown key — callers
-- decide whether that is an error (the phase-5 gate) or a fallback (the client,
-- which keeps the default plans compiled in for offline use).
CREATE OR REPLACE FUNCTION public.current_capture_plan(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.definition
  FROM public.capture_plans cp
  WHERE cp.key = p_key AND cp.is_active
  ORDER BY cp.version DESC
  LIMIT 1;
$$;

-- 6) Permissions ──────────────────────────────────────────────────────────────

INSERT INTO public.permissions (module, action, description) VALUES
  ('settings', 'manage_capture_plans', 'Create and version Rückmeldung capture plans')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.module = 'settings' AND p.action = 'manage_capture_plans'
WHERE r.name = 'admin' AND r.is_system
ON CONFLICT DO NOTHING;

-- 7) RLS ──────────────────────────────────────────────────────────────────────
-- Plans are readable by anyone who can see a work order (the technician needs
-- them to render the form) and writable only by plan administrators.
-- Capture reports follow the wo_detail_* rules they will eventually replace.

ALTER TABLE public.capture_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_capture_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capture_plans_select_perm" ON public.capture_plans;
CREATE POLICY "capture_plans_select_perm" ON public.capture_plans
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view'));

DROP POLICY IF EXISTS "capture_plans_write_perm" ON public.capture_plans;
CREATE POLICY "capture_plans_write_perm" ON public.capture_plans
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage_capture_plans'))
  WITH CHECK (public.has_permission('settings.manage_capture_plans'));

DROP POLICY IF EXISTS "wo_capture_reports_select_perm" ON public.work_order_capture_reports;
CREATE POLICY "wo_capture_reports_select_perm" ON public.work_order_capture_reports
  FOR SELECT TO authenticated
  USING (public.has_permission('work_orders.view'));

DROP POLICY IF EXISTS "wo_capture_reports_write_perm" ON public.work_order_capture_reports;
CREATE POLICY "wo_capture_reports_write_perm" ON public.work_order_capture_reports
  FOR ALL TO authenticated
  USING (public.has_permission('work_orders.edit'))
  WITH CHECK (public.has_permission('work_orders.edit'));

-- 8) Default plans ────────────────────────────────────────────────────────────
-- One per work_type, reproducing today's behaviour exactly: the three photo
-- buckets (min 1 each) plus the detail fields, with `required` set to the union
-- of the two gates enforced right now — the SQL one in 016 and the client-side
-- REQUIRED_DETAIL_FIELDS in workOrderService.ts (an order has to pass both).
-- 'pop' has no required field: POP orders have no certification gate today.
--
-- Generated from src/constants/capture-plans.ts — do not hand-edit; the parity
-- test in src/__tests__/capturePlans.test.ts fails if these drift apart.

INSERT INTO public.capture_plans (key, version, definition) VALUES
  ('soplado', 1, $plan$
{
  "key": "soplado",
  "version": 1,
  "sections": [
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_soplado",
      "fields": [
        {
          "key": "meters",
          "type": "number",
          "labelKey": "detailField.meters",
          "legacyColumn": "meters",
          "placeholderKey": "detailPlaceholder.meters",
          "required": true
        },
        {
          "key": "section",
          "type": "text",
          "labelKey": "detailField.section",
          "legacyColumn": "section",
          "placeholderKey": "detailPlaceholder.section",
          "required": true
        },
        {
          "key": "tube_diameter",
          "type": "text",
          "labelKey": "detailField.tube_diameter",
          "legacyColumn": "tube_diameter",
          "placeholderKey": "detailPlaceholder.tube_diameter",
          "required": true
        },
        {
          "key": "result",
          "type": "select",
          "labelKey": "detailField.result",
          "legacyColumn": "result",
          "options": [
            "OK",
            "NOK",
            "Ausstehend"
          ],
          "required": true
        }
      ]
    }
  ]
}
$plan$::jsonb),
  ('fusion_ap', 1, $plan$
{
  "key": "fusion_ap",
  "version": 1,
  "sections": [
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_fusion_ap",
      "fields": [
        {
          "key": "cabinet_code",
          "type": "text",
          "labelKey": "detailField.cabinet_code",
          "legacyColumn": "cabinet_code",
          "placeholderKey": "detailPlaceholder.cabinet_code",
          "required": true
        },
        {
          "key": "card_count",
          "type": "number",
          "labelKey": "detailField.card_count",
          "legacyColumn": "card_count",
          "placeholderKey": "detailPlaceholder.card_count",
          "min": 0
        },
        {
          "key": "splice_count",
          "type": "number",
          "labelKey": "detailField.splice_count",
          "legacyColumn": "splice_count",
          "placeholderKey": "detailPlaceholder.splice_count",
          "required": true
        },
        {
          "key": "fiber_type",
          "type": "text",
          "labelKey": "detailField.fiber_type",
          "legacyColumn": "fiber_type",
          "placeholderKey": "detailPlaceholder.fiber_type",
          "required": true
        },
        {
          "key": "fusion_losses",
          "type": "number",
          "labelKey": "detailField.fusion_losses",
          "legacyColumn": "fusion_losses",
          "placeholderKey": "detailPlaceholder.fusion_losses",
          "min": 0
        },
        {
          "key": "has_measurement_cert",
          "type": "checkbox",
          "labelKey": "detailField.has_measurement_cert",
          "legacyColumn": "has_measurement_cert",
          "required": true
        }
      ]
    }
  ]
}
$plan$::jsonb),
  ('fusion_dp', 1, $plan$
{
  "key": "fusion_dp",
  "version": 1,
  "sections": [
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_fusion_dp",
      "fields": [
        {
          "key": "cabinet_code",
          "type": "text",
          "labelKey": "detailField.cabinet_code",
          "legacyColumn": "cabinet_code",
          "placeholderKey": "detailPlaceholder.cabinet_code",
          "required": true
        },
        {
          "key": "card_count",
          "type": "number",
          "labelKey": "detailField.card_count",
          "legacyColumn": "card_count",
          "placeholderKey": "detailPlaceholder.card_count",
          "min": 0
        },
        {
          "key": "splice_count",
          "type": "number",
          "labelKey": "detailField.splice_count",
          "legacyColumn": "splice_count",
          "placeholderKey": "detailPlaceholder.splice_count",
          "required": true
        },
        {
          "key": "fiber_type",
          "type": "text",
          "labelKey": "detailField.fiber_type",
          "legacyColumn": "fiber_type",
          "placeholderKey": "detailPlaceholder.fiber_type",
          "required": true
        },
        {
          "key": "fusion_losses",
          "type": "number",
          "labelKey": "detailField.fusion_losses",
          "legacyColumn": "fusion_losses",
          "placeholderKey": "detailPlaceholder.fusion_losses",
          "min": 0
        },
        {
          "key": "has_measurement_cert",
          "type": "checkbox",
          "labelKey": "detailField.has_measurement_cert",
          "legacyColumn": "has_measurement_cert",
          "required": true
        }
      ]
    }
  ]
}
$plan$::jsonb),
  ('alta', 1, $plan$
{
  "key": "alta",
  "version": 1,
  "sections": [
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_alta",
      "fields": [
        {
          "key": "access_type",
          "type": "select",
          "labelKey": "detailField.access_type",
          "legacyColumn": "access_type",
          "options": [
            "Keller",
            "Erdgeschoss",
            "Obergeschoss",
            "Dach",
            "Außen"
          ],
          "required": true
        },
        {
          "key": "equipment_installed",
          "type": "text",
          "labelKey": "detailField.equipment_installed",
          "legacyColumn": "equipment_installed",
          "placeholderKey": "detailPlaceholder.equipment_installed",
          "required": true
        },
        {
          "key": "client_signature",
          "type": "checkbox",
          "labelKey": "detailField.client_signature",
          "legacyColumn": "client_signature",
          "required": true
        }
      ]
    }
  ]
}
$plan$::jsonb),
  ('nt_installation', 1, $plan$
{
  "key": "nt_installation",
  "version": 1,
  "sections": [
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_nt",
      "fields": [
        {
          "key": "nt_type",
          "type": "select",
          "labelKey": "detailField.nt_type",
          "legacyColumn": "nt_type",
          "options": [
            "NT-100",
            "NT-200",
            "NT-300",
            "ONT",
            "ONU"
          ],
          "required": true
        },
        {
          "key": "serial_number",
          "type": "text",
          "labelKey": "detailField.serial_number",
          "legacyColumn": "serial_number",
          "placeholderKey": "detailPlaceholder.serial_number",
          "required": true
        },
        {
          "key": "location",
          "type": "text",
          "labelKey": "detailField.location",
          "legacyColumn": "location",
          "placeholderKey": "detailPlaceholder.location",
          "required": true
        },
        {
          "key": "configuration",
          "type": "text",
          "labelKey": "detailField.configuration",
          "legacyColumn": "configuration",
          "placeholderKey": "detailPlaceholder.configuration"
        }
      ]
    }
  ]
}
$plan$::jsonb),
  ('patchkabel', 1, $plan$
{
  "key": "patchkabel",
  "version": 1,
  "sections": [
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_patchkabel",
      "fields": [
        {
          "key": "connected_section",
          "type": "text",
          "labelKey": "detailField.connected_section",
          "legacyColumn": "connected_section",
          "placeholderKey": "detailPlaceholder.connected_section",
          "required": true
        },
        {
          "key": "cable_length",
          "type": "number",
          "labelKey": "detailField.cable_length",
          "legacyColumn": "cable_length",
          "placeholderKey": "detailPlaceholder.cable_length",
          "required": true
        },
        {
          "key": "connector_type",
          "type": "select",
          "labelKey": "detailField.connector_type",
          "legacyColumn": "connector_type",
          "options": [
            "SC/APC",
            "SC/UPC",
            "LC/APC",
            "LC/UPC",
            "FC/APC"
          ],
          "required": true
        },
        {
          "key": "test_result",
          "type": "select",
          "labelKey": "detailField.test_result",
          "legacyColumn": "test_result",
          "options": [
            "OK",
            "NOK",
            "Ausstehend"
          ],
          "required": true
        }
      ]
    }
  ]
}
$plan$::jsonb),
  ('pop', 1, $plan$
{
  "key": "pop",
  "version": 1,
  "sections": [
    {
      "key": "photos",
      "kind": "photos",
      "titleKey": "rueckmeldung.photos.title",
      "slots": [
        {
          "key": "before",
          "min": 1,
          "labelKey": "photo.before",
          "legacyType": "before"
        },
        {
          "key": "during",
          "min": 1,
          "labelKey": "photo.during",
          "legacyType": "during"
        },
        {
          "key": "after",
          "min": 1,
          "labelKey": "photo.after",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "details",
      "kind": "fields",
      "titleKey": "capture.section.details",
      "descriptionKey": "rueckmeldung.details.subtitle",
      "legacyTable": "wo_detail_pop",
      "fields": [
        {
          "key": "rack_id",
          "type": "text",
          "labelKey": "detailField.rack_id",
          "legacyColumn": "rack_id",
          "placeholderKey": "detailPlaceholder.rack_id"
        },
        {
          "key": "tray_count",
          "type": "number",
          "labelKey": "detailField.tray_count",
          "legacyColumn": "tray_count",
          "placeholderKey": "detailPlaceholder.tray_count",
          "min": 0
        },
        {
          "key": "cable_entry_points",
          "type": "text",
          "labelKey": "detailField.cable_entry_points",
          "legacyColumn": "cable_entry_points",
          "placeholderKey": "detailPlaceholder.cable_entry_points"
        }
      ]
    }
  ]
}
$plan$::jsonb)
ON CONFLICT (key, version) DO UPDATE
  SET definition = EXCLUDED.definition,
      updated_at = now();
