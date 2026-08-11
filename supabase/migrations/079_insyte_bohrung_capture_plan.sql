-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 079 — Insyte "Bohrung + Aktivierung" capture plan (plan 011)
-- Depends on: 052_capture_plans.sql, 066_client_owned_service_catalog.sql
-- Purpose:
--   The INSYTE "HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung" position already
--   exists and is already priced (004_service_catalog_seed.sql), but its
--   evidence contract does not: today it resolves to the generic `alta` plan.
--   This migration ships the branching plan the field team needs — and because
--   assert_work_order_rueckmeldung_complete() gates internal certification and
--   client send, the capture plan IS the billing gate for this position.
--
--   Three things happen together:
--     1. Seed `insyte_bohrung_aktivierung` v1 — identical JSON to the compiled
--        TS constant (src/constants/capture-plans-insyte-bohrung.ts);
--        capturePlans.test.ts compares both, so they cannot drift.
--     2. Add `service_items.capture_plan_key` and stamp it on every INSYTE
--        row of this position. Post-066 the catalogue still carries the five
--        per-operator rows (DGF/MER/GFPLUS/GFNW/GVG _ACT_001); matching on
--        client + description binds all of them, and any future collapsed row
--        reseeded with the same description.
--     3. Extend `public.work_order_capture_plan_key()` with the new
--        precedence: order override → service item → work type. Its TS twin
--        `capturePlanKeyForOrder()` changes in the same commit.
--
-- Notes:
--   Every photo slot key is unique across the WHOLE plan, not just its
--   section — migration 078 made the slot, not the section, the identity of a
--   photo, so two sections claiming one slot name would make their photos
--   count for nothing.
--
--   `closing_signature.client_signature` is a yesno for now (plan 011 Gap C):
--   the signature canvas will answer the same node later, without a new plan
--   version. The key must not change.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1) The plan ─────────────────────────────────────────────────────────────────

INSERT INTO public.capture_plans (key, version, definition) VALUES
  ('insyte_bohrung_aktivierung', 1, $plan$
{
  "key": "insyte_bohrung_aktivierung",
  "version": 1,
  "workType": "alta",
  "titleKey": "capturePlan.insyteBohrung.title",
  "sections": [
    {
      "key": "external_method",
      "kind": "fields",
      "titleKey": "capturePlan.insyteBohrung.externalMethod.title",
      "descriptionKey": "capturePlan.insyteBohrung.externalMethod.description",
      "fields": [
        {
          "key": "execution_type",
          "type": "select",
          "labelKey": "capturePlan.insyteBohrung.field.executionType",
          "options": [
            "tiefbau",
            "lanze"
          ],
          "required": true
        }
      ]
    },
    {
      "key": "external_photos",
      "kind": "photos",
      "titleKey": "capturePlan.insyteBohrung.externalPhotos.title",
      "descriptionKey": "capturePlan.insyteBohrung.externalPhotos.description",
      "slots": [
        {
          "key": "speedpipe",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.speedpipe.label",
          "hintKey": "capturePlan.insyteBohrung.slot.speedpipe.hint",
          "legacyType": "during"
        },
        {
          "key": "excavation_open",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.excavationOpen.label",
          "hintKey": "capturePlan.insyteBohrung.slot.excavationOpen.hint",
          "legacyType": "during",
          "condition": {
            "path": "external_method.execution_type",
            "equals": "tiefbau"
          }
        },
        {
          "key": "muffe",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.muffe.label",
          "hintKey": "capturePlan.insyteBohrung.slot.muffe.hint",
          "legacyType": "during",
          "condition": {
            "path": "external_method.execution_type",
            "equals": "tiefbau"
          }
        },
        {
          "key": "excavation_closed",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.excavationClosed.label",
          "hintKey": "capturePlan.insyteBohrung.slot.excavationClosed.hint",
          "legacyType": "after",
          "condition": {
            "path": "external_method.execution_type",
            "equals": "tiefbau"
          }
        },
        {
          "key": "before_work",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.beforeWork.label",
          "hintKey": "capturePlan.insyteBohrung.slot.beforeWork.hint",
          "legacyType": "before",
          "condition": {
            "path": "external_method.execution_type",
            "equals": "lanze"
          }
        },
        {
          "key": "after_work",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.afterWork.label",
          "hintKey": "capturePlan.insyteBohrung.slot.afterWork.hint",
          "legacyType": "after",
          "condition": {
            "path": "external_method.execution_type",
            "equals": "lanze"
          }
        }
      ]
    },
    {
      "key": "huep",
      "kind": "photos",
      "titleKey": "capturePlan.insyteBohrung.huep.title",
      "descriptionKey": "capturePlan.insyteBohrung.huep.description",
      "slots": [
        {
          "key": "huep_open",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.huepOpen.label",
          "hintKey": "capturePlan.insyteBohrung.slot.huepOpen.hint",
          "legacyType": "during"
        },
        {
          "key": "huep_closed",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.huepClosed.label",
          "hintKey": "capturePlan.insyteBohrung.slot.huepClosed.hint",
          "legacyType": "after"
        },
        {
          "key": "huep_panorama",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.huepPanorama.label",
          "hintKey": "capturePlan.insyteBohrung.slot.huepPanorama.hint",
          "legacyType": "after"
        },
        {
          "key": "faser_anmeldung",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.faserAnmeldung.label",
          "hintKey": "capturePlan.insyteBohrung.slot.faserAnmeldung.hint",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "nt_ta",
      "kind": "checklist",
      "titleKey": "capturePlan.insyteBohrung.ntTa.title",
      "descriptionKey": "capturePlan.insyteBohrung.ntTa.description",
      "fields": [
        {
          "key": "ta_installed",
          "type": "yesno",
          "labelKey": "capturePlan.insyteBohrung.field.taInstalled",
          "required": true
        },
        {
          "key": "nt_synchronized",
          "type": "yesno",
          "labelKey": "capturePlan.insyteBohrung.field.ntSynchronized",
          "required": true
        },
        {
          "key": "sync_issue_note",
          "type": "text",
          "labelKey": "capturePlan.insyteBohrung.field.syncIssueNote",
          "placeholderKey": "capturePlan.insyteBohrung.placeholder.syncIssueNote",
          "required": true,
          "condition": {
            "path": "nt_ta.nt_synchronized",
            "equals": false
          }
        }
      ]
    },
    {
      "key": "nt_ta_photos",
      "kind": "photos",
      "titleKey": "capturePlan.insyteBohrung.ntTaPhotos.title",
      "descriptionKey": "capturePlan.insyteBohrung.ntTaPhotos.description",
      "slots": [
        {
          "key": "nt_connected",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.ntConnected.label",
          "hintKey": "capturePlan.insyteBohrung.slot.ntConnected.hint",
          "legacyType": "after"
        },
        {
          "key": "nt_serial",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.ntSerial.label",
          "hintKey": "capturePlan.insyteBohrung.slot.ntSerial.hint",
          "legacyType": "after"
        },
        {
          "key": "ta_front",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.taFront.label",
          "hintKey": "capturePlan.insyteBohrung.slot.taFront.hint",
          "legacyType": "after",
          "condition": {
            "path": "nt_ta.ta_installed",
            "equals": true
          }
        },
        {
          "key": "nt_panorama",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.ntPanorama.label",
          "hintKey": "capturePlan.insyteBohrung.slot.ntPanorama.hint",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "service_pack",
      "kind": "checklist",
      "titleKey": "capturePlan.insyteBohrung.servicePack.title",
      "descriptionKey": "capturePlan.insyteBohrung.servicePack.description",
      "fields": [
        {
          "key": "sp_performed",
          "type": "yesno",
          "labelKey": "capturePlan.insyteBohrung.field.spPerformed",
          "required": true
        },
        {
          "key": "sp_hours",
          "type": "number",
          "labelKey": "capturePlan.insyteBohrung.field.spHours",
          "placeholderKey": "capturePlan.insyteBohrung.placeholder.spHours",
          "required": true,
          "condition": {
            "path": "service_pack.sp_performed",
            "equals": true
          }
        }
      ]
    },
    {
      "key": "service_pack_photos",
      "kind": "photos",
      "titleKey": "capturePlan.insyteBohrung.servicePackPhotos.title",
      "descriptionKey": "capturePlan.insyteBohrung.servicePackPhotos.description",
      "slots": [
        {
          "key": "sp_evidence",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.spEvidence.label",
          "hintKey": "capturePlan.insyteBohrung.slot.spEvidence.hint",
          "legacyType": "during",
          "condition": {
            "path": "service_pack.sp_performed",
            "equals": true
          }
        }
      ]
    },
    {
      "key": "closing",
      "kind": "photos",
      "titleKey": "capturePlan.insyteBohrung.closing.title",
      "descriptionKey": "capturePlan.insyteBohrung.closing.description",
      "slots": [
        {
          "key": "activation",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.activation.label",
          "hintKey": "capturePlan.insyteBohrung.slot.activation.hint",
          "legacyType": "after"
        },
        {
          "key": "measurements",
          "min": 1,
          "labelKey": "capturePlan.insyteBohrung.slot.measurements.label",
          "hintKey": "capturePlan.insyteBohrung.slot.measurements.hint",
          "legacyType": "after"
        }
      ]
    },
    {
      "key": "closing_signature",
      "kind": "fields",
      "titleKey": "capturePlan.insyteBohrung.closingSignature.title",
      "fields": [
        {
          "key": "client_signature",
          "type": "yesno",
          "labelKey": "capturePlan.insyteBohrung.field.clientSignature",
          "required": true
        }
      ]
    }
  ]
}
$plan$::jsonb)
ON CONFLICT (key, version) DO UPDATE SET definition = EXCLUDED.definition;

-- 2) The catalogue binding ────────────────────────────────────────────────────

ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS capture_plan_key text NULL;

COMMENT ON COLUMN public.service_items.capture_plan_key IS
  'Capture plan bound to this catalogue position. Resolution precedence: '
  'work_orders.capture_plan_key override → this column (via the order''s '
  'service item) → work type. NULL = the position has no plan of its own.';

UPDATE public.service_items si
SET capture_plan_key = 'insyte_bohrung_aktivierung'
FROM public.clients c
WHERE c.code = 'INSYTE'
  AND si.client_id = c.id
  AND si.description_de = 'HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung';

-- 3) The resolution precedence ────────────────────────────────────────────────
-- Extends the 052 helper. TS twin: capturePlanKeyForOrder()
-- (src/constants/capture-plans.ts) — both must answer identically.

CREATE OR REPLACE FUNCTION public.work_order_capture_plan_key(p_work_order_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(btrim(wo.capture_plan_key), ''),
    NULLIF(btrim(si.capture_plan_key), ''),
    wo.work_type::text
  )
  FROM public.work_orders wo
  LEFT JOIN public.service_items si ON si.id = wo.service_item_id
  WHERE wo.id = p_work_order_id;
$$;

COMMENT ON FUNCTION public.work_order_capture_plan_key(uuid) IS
  'The plan a work order is captured under: its explicit capture_plan_key, '
  'failing that the one bound to its catalogue position (079), failing that '
  'its work type. TS twin: capturePlanKeyForOrder().';

COMMIT;
