-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 053 — Capture plan "Soplado de RA" + example photo bucket
-- Depends on: 052_capture_plans.sql, 034_rbac_core.sql, 035_rbac_policy_migration.sql
-- Purpose:
--   Phase 3 of the Rückmeldung capture flow: the first hand-written capture
--   plan, and the bucket that holds the example thumbnail of every slot.
--
--   "Soplado de RA" is a VARIANT of the `soplado` work type, not a new work
--   type: the work_type enum is embedded in seven detail tables and every
--   export. An order is captured under it by setting
--   `work_orders.capture_plan_key = 'soplado_ra'` (the admin order form writes
--   it); its `details` section keeps feeding `wo_detail_soplado`, so both gates
--   enforced today — the SQL one in 016 and REQUIRED_DETAIL_FIELDS in
--   workOrderService.ts — keep passing.
--
--   What the plan asks for:
--     - mandatory : 4 photos, always (fiber at the DP, gas block, POP label,
--                   balloon). Their legacyType deliberately spreads over
--                   before/during/after, because 016 still demands one photo of
--                   each and the trenches below are optional.
--     - catas     : repeatable trench, min 0 — a blowing job may not open the
--                   ground at all. Photos before/open/restored, plus a safety
--                   signage slot REVEALED (not demanded) by answering that the
--                   trench stays open. Fields: left open, depth, position.
--     - incidents : free gallery, never mandatory.
--     - checklist : was the planned duct used? "No" demands trunk, duct and
--                   reason — the one conditional primitive of the plan.
--     - details   : the wo_detail_soplado columns, unchanged.
--
--   Generated from src/constants/capture-plans-soplado-ra.ts — do not hand-edit;
--   the parity test in src/__tests__/capturePlans.test.ts fails if these drift
--   apart. Changing the plan means a NEW version row, never an edit in place:
--   orders captured under version 1 must stay reproducible.
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Example photos bucket ────────────────────────────────────────────────────
-- One reference image per slot ("this is what a correct gas block photo looks
-- like"), shown as a thumbnail next to the slot. It is what makes the form
-- self-explanatory for a technician who has never done a Soplado de RA.
-- Private like every other bucket here, read by anyone who may see a work order
-- and written only by plan administrators. Objects live at
-- capture-examples/<plan_key>/<slot>.jpg — the `example` path of each slot.

INSERT INTO storage.buckets (id, name, public)
VALUES ('capture-examples', 'capture-examples', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "storage_capture_examples_read" ON storage.objects;
CREATE POLICY "storage_capture_examples_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'capture-examples'
    AND public.has_permission('work_orders.view')
  );

DROP POLICY IF EXISTS "storage_capture_examples_write" ON storage.objects;
CREATE POLICY "storage_capture_examples_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'capture-examples'
    AND public.has_permission('settings.manage_capture_plans')
  );

DROP POLICY IF EXISTS "storage_capture_examples_update" ON storage.objects;
CREATE POLICY "storage_capture_examples_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'capture-examples'
    AND public.has_permission('settings.manage_capture_plans')
  );

DROP POLICY IF EXISTS "storage_capture_examples_delete" ON storage.objects;
CREATE POLICY "storage_capture_examples_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'capture-examples'
    AND public.has_permission('settings.manage_capture_plans')
  );

-- 2) The plan ─────────────────────────────────────────────────────────────────

INSERT INTO public.capture_plans (key, version, definition) VALUES
  ('soplado_ra', 1, $plan$
{
  "key": "soplado_ra",
  "version": 1,
  "workType": "soplado",
  "titleKey": "capturePlan.sopladoRa.title",
  "sections": [
    {
      "key": "mandatory",
      "kind": "photos",
      "titleKey": "capturePlan.sopladoRa.mandatory.title",
      "descriptionKey": "capturePlan.sopladoRa.mandatory.description",
      "slots": [
        {
          "key": "fiber_dp",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberDp.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberDp.hint",
          "example": "soplado_ra/fiber_dp.jpg",
          "legacyType": "before"
        },
        {
          "key": "fiber_dp_gasblock",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberDpGasblock.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberDpGasblock.hint",
          "example": "soplado_ra/fiber_dp_gasblock.jpg",
          "legacyType": "during"
        },
        {
          "key": "fiber_pop_label",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.fiberPopLabel.label",
          "hintKey": "capturePlan.sopladoRa.slot.fiberPopLabel.hint",
          "example": "soplado_ra/fiber_pop_label.jpg",
          "legacyType": "after"
        },
        {
          "key": "balloon_pop",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.balloonPop.label",
          "hintKey": "capturePlan.sopladoRa.slot.balloonPop.hint",
          "example": "soplado_ra/balloon_pop.jpg",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "catas",
      "kind": "repeater",
      "titleKey": "capturePlan.sopladoRa.catas.title",
      "descriptionKey": "capturePlan.sopladoRa.catas.description",
      "itemLabelKey": "capturePlan.sopladoRa.catas.item",
      "min": 0,
      "slots": [
        {
          "key": "before_open",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.beforeOpen.label",
          "hintKey": "capturePlan.sopladoRa.slot.beforeOpen.hint",
          "example": "soplado_ra/cata_before_open.jpg",
          "legacyType": "before"
        },
        {
          "key": "during_open",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.duringOpen.label",
          "hintKey": "capturePlan.sopladoRa.slot.duringOpen.hint",
          "example": "soplado_ra/cata_during_open.jpg",
          "legacyType": "during"
        },
        {
          "key": "closed",
          "min": 1,
          "labelKey": "capturePlan.sopladoRa.slot.closed.label",
          "hintKey": "capturePlan.sopladoRa.slot.closed.hint",
          "example": "soplado_ra/cata_closed.jpg",
          "legacyType": "after"
        },
        {
          "key": "safety_signage",
          "min": 0,
          "labelKey": "capturePlan.sopladoRa.slot.safetySignage.label",
          "hintKey": "capturePlan.sopladoRa.slot.safetySignage.hint",
          "example": "soplado_ra/cata_safety_signage.jpg",
          "legacyType": "during",
          "condition": {
            "path": "item.left_open",
            "equals": true
          }
        }
      ],
      "fields": [
        {
          "key": "left_open",
          "type": "yesno",
          "labelKey": "capturePlan.sopladoRa.field.leftOpen",
          "required": true
        },
        {
          "key": "depth_cm",
          "type": "number",
          "labelKey": "capturePlan.sopladoRa.field.depthCm",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.depthCm",
          "required": true
        },
        {
          "key": "location",
          "type": "geopoint",
          "labelKey": "capturePlan.sopladoRa.field.location"
        }
      ]
    },
    {
      "key": "incidents",
      "kind": "gallery",
      "titleKey": "capturePlan.sopladoRa.incidents.title",
      "descriptionKey": "capturePlan.sopladoRa.incidents.description",
      "slots": [
        {
          "key": "photo",
          "min": 0,
          "labelKey": "capturePlan.sopladoRa.slot.incident.label",
          "hintKey": "capturePlan.sopladoRa.slot.incident.hint",
          "legacyType": "during"
        }
      ],
      "fields": [
        {
          "key": "description",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.incidentDescription",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.incidentDescription"
        }
      ]
    },
    {
      "key": "checklist",
      "kind": "checklist",
      "titleKey": "capturePlan.sopladoRa.checklist.title",
      "descriptionKey": "capturePlan.sopladoRa.checklist.description",
      "fields": [
        {
          "key": "duct_as_planned",
          "type": "yesno",
          "labelKey": "capturePlan.sopladoRa.field.ductAsPlanned",
          "required": true
        },
        {
          "key": "trunk_used",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.trunkUsed",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.trunkUsed",
          "required": true,
          "condition": {
            "path": "checklist.duct_as_planned",
            "equals": false
          }
        },
        {
          "key": "duct_used",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.ductUsed",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.ductUsed",
          "required": true,
          "condition": {
            "path": "checklist.duct_as_planned",
            "equals": false
          }
        },
        {
          "key": "change_reason",
          "type": "text",
          "labelKey": "capturePlan.sopladoRa.field.changeReason",
          "placeholderKey": "capturePlan.sopladoRa.placeholder.changeReason",
          "required": true,
          "condition": {
            "path": "checklist.duct_as_planned",
            "equals": false
          }
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
$plan$::jsonb)
ON CONFLICT (key, version) DO UPDATE
  SET definition = EXCLUDED.definition,
      updated_at = now();
