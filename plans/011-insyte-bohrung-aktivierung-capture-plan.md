# Plan 011 — Insyte "Bohrung + Aktivierung" capture plan (230 € position)

Status: IN PROGRESS (slice 1 — Gap A + Gap B shipped as migration 079; slice 2 —
Gap C signature shipped as migration 080)
Priority: P1 · Effort: L
Source: field requirements from Jeisson Romero (Slack, 2026-07-29), transcribed
and reconciled against the code by the coordinator.

## Why this plan exists

The catalogue position already exists and is already priced. `supabase/migrations/004_service_catalog_seed.sql:93-97`
seeds **"HÜP-GFTA-ONT, Fusion + Aktivierung + Bohrung", client `INSYTE`, 230.00 €**,
`detail_form = 'alta'`, duplicated five times (one code per operator: `DGF_ACT_001`,
`MER_ACT_001`, `GFPLUS_ACT_001`, `GFNW_ACT_001`, `GVG_ACT_001`). Plan 010 removes the
operator from the order flow, so those five rows collapse into one Insyte position.

What does *not* exist is the evidence contract for it. Today the position resolves to
the generic `alta` capture plan. The field team needs a specific, branching plan, and
because `assert_work_order_rueckmeldung_complete()` gates internal certification and
client send (`056_retire_legacy_rueckmeldung_gate.sql:88-150`, called from
`069_executor_certification_paths.sql:204,264`), the capture plan *is* the billing gate:
no evidence, no certification, no invoice.

## What the admin supplies vs what the technician supplies

- **Admin, at order creation**: client (Insyte), the activity (this 230 € position),
  the dwelling address, the appointment time, plus any context attachments.
- **Technician, in the field**: everything in the capture plan below.

## Verified engine capabilities (no technical risk)

`CaptureCondition { path, equals }` attaches at three levels — section
(`src/types/capture-plan.ts:91`), photo slot (`:82`) and field (`:62`) — and is
evaluated identically in TypeScript (`src/services/capturePlanEngine.ts:70-80`) and in
plpgsql (`054_capture_plan_gate.sql:141-191`). An invisible node is never demanded
(`capturePlanEngine.ts:335`). Every branch this plan needs is already proven by the
shipped `soplado_ra` plan, which reveals conditional slots and makes follow-up text
fields mandatory (`src/constants/capture-plans-soplado-ra.ts:89,92,144,204-226`).

Constraints to design around:

- One condition per node, `equals` only — no `AND`/`OR`, no `notEquals`.
- `path` is two segments: `item.<field>` (current repeater item) or `<section>.<field>`.
- A condition controls **visibility**; invisible implies not-required. "Always visible
  but sometimes mandatory" is not expressible.
- Photos are `CapturePhotoSlot`, not fields — there is no `photo` field type.
- Plans are immutable per `(key, version)` (`052_capture_plans.sql:38-52`), and
  `src/__tests__/capturePlans.test.ts:46-53` deep-compares the TS constant against the
  SQL seed, so the module and the migration must ship together and match exactly.

## The plan

`key: insyte_bohrung_aktivierung` · `version: 1` · `workType: 'alta'`

Terminology fixed with the owner: **"balona" = Speedpipe**, the microduct the fibre runs
through. Labelled as Speedpipe/Mikrorohr in the UI.

| # | Section (`kind`) | Node | Type / `min` | Condition |
|---|---|---|---|---|
| 1 | `external_method` (`fields`) | `execution_type` | `select`, required — `tiefbau` \| `lanze` | — |
| 2 | `external_photos` (`photos`) | `speedpipe` | photo, min 1 | — (both branches) |
| | | `excavation_open` | photo, min 1 | `external_method.execution_type = tiefbau` |
| | | `muffe` | photo, min 1 | `… = tiefbau` |
| | | `excavation_closed` | photo, min 1 | `… = tiefbau` |
| | | `before_work` | photo, min 1 | `… = lanze` |
| | | `after_work` | photo, min 1 | `… = lanze` |
| 3 | `huep` (`photos`) | `huep_open`, `huep_closed`, `huep_panorama`, `faser_anmeldung` | photo, min 1 each | — |
| 4 | `nt_ta` (`checklist`) | `ta_installed` | `yesno`, required | — |
| | | `nt_synchronized` | `yesno`, required | — |
| | | `sync_issue_note` | `text`, required | `nt_ta.nt_synchronized = false` |
| 5 | `nt_ta_photos` (`photos`) | `nt_connected` | photo, min 1 | — |
| | | `nt_serial` | photo, min 1 | — |
| | | `ta_front` | photo, min 1 | `nt_ta.ta_installed = true` |
| | | `nt_panorama` | photo, min 1 | — |
| 6 | `service_pack` (`checklist`) | `sp_performed` | `yesno`, required | — |
| | | `sp_hours` | `number`, required | `service_pack.sp_performed = true` |
| 7 | `service_pack_photos` (`photos`) | `sp_evidence` | photo, min 1 | `service_pack.sp_performed = true` |
| 8 | `closing` (`photos`) | `activation`, `measurements` | photo, min 1 each | — |
| 9 | `closing_signature` (`fields`) | `client_signature` | see Gap C | — |

Why the selector and its photos live in separate sections: a `photos` section carries
only slots and a `fields` section carries only fields, and a slot condition addresses a
field by `<section>.<field>`. Splitting is the idiomatic way to branch a photo set.

## Gaps to build

**A. The plan itself.** New module `src/constants/capture-plans-insyte-bohrung.ts`,
registered in `src/constants/capture-plans.ts` (`CAPTURE_PLAN_VERSIONS`), plus a
migration seeding the identical JSONB with `on conflict (key, version) do update`, plus
the parity assertion in `src/__tests__/capturePlans.test.ts`. Verify the rendered result
with `npm run diagrams:capture` (`scripts/generate-capture-diagrams.mjs`), which draws
each plan from the real definition.

**B. Bind the plan to the catalogue position.** Today plans key off `work_type`, or off a
manual `work_orders.capture_plan_key` override (`052_capture_plans.sql:65-69,127-137`);
`service_items` has no link at all. Add `service_items.capture_plan_key` and extend
resolution in both twins — `public.work_order_capture_plan_key()` and
`capturePlanKeyForOrder()` (`src/constants/capture-plans.ts:79-85`) — with precedence
**order override → service item → work type**. Without this, someone has to pick the
variant by hand on every order (`src/pages/admin/WorkOrderFormPage.tsx:230,631-632`).

**C. Real client signature.** ~~Nothing exists today~~ **Shipped (slice 2,
migration 080).** `SignatureField` (pointer-event canvas, ink-on-paper tokens)
replaces the plain control behind any `client_signature` field — the yesno of
this plan and the checkbox of the alta default alike. The PNG lives in the
`work-order-photos` bucket under `<orderId>/signature/` (the 073 path scoping is
the whole access rule — no storage DDL), referenced from
`work_order_capture_reports.client_signature_path`; the boolean answer flips to
true only after the image is stored, so the gate and the plan JSONB are
untouched. The certificate PDF embeds the image as its closing section.

**D. Attachments.** The security prerequisite is already handled; two changes remain:
1. Allow images outside `diagrama_routing` — today PNG/JPG are only accepted for that
   type (`src/types/work-order-documents.ts:29-41`).
2. Surface attachments to the technician by mounting `DocumentUploader` (read-only) on
   the field pages; it lives only on admin pages today.

The blocker that used to sit here — `tech_read_work_order_documents` being scoped by
*team* rather than by assignee, and ignoring the role — was fixed in **PR #24**
(migration `073_work_order_access_scope.sql`), together with the `work-order-documents`
bucket and `work-order-photos`, which was readable and writable by any authenticated
user. **Do not mount the field attachment view until PR #24 is merged and applied.**

## Migrations

Verified against `upstream/develop` on 2026-08-09: `071`–`078` are all **taken**
(`073` landed with PR #24; `074`–`078` followed — phantom-column fix, basemap
bucket, soplado_ra v4, billing repair, slot-key rescue). Next free number is
therefore **079**. Re-check with `git ls-tree upstream/develop supabase/migrations/`
before writing any SQL — this plan has now been renumbered three times
(074/075 → renumbered → **079/080**).

1. `079_insyte_bohrung_capture_plan.sql` — **shipped in slice 1**: seeds the
   plan; adds `service_items.capture_plan_key`, binds the INSYTE rows of the
   position, and extends `work_order_capture_plan_key()` with the precedence
   order override → service item → work type.
2. `080_client_signature.sql` — **shipped in slice 2**: adds
   `work_order_capture_reports.client_signature_path`. No storage DDL — the
   image reuses the `<orderId>/…` prefix the 073 policies already scope.
Gap D needs no migration of its own any more — the policy work landed in `073`.

Note: `071_capture_plan_soplado_ra_v3.sql` is a worked example of publishing a new
plan version rather than editing one in place — follow its shape. `078` adds the
hard rule slice 1 builds on: a photo slot key must be unique across the WHOLE
plan, because the slot — not the section — is the identity of a photo.

Ship `.sql` only; the repo owner applies them and regenerates `database.types.ts`.

## Normative constraints

- **Prices are invisible to field roles.** Owner rule, 2026-07-30: technicians and
  contractors never see prices; prices belong to the internal certification process
  only. Nothing in this plan may surface an amount. The existing
  `reported_service_items` picker already complies (code, description, unit, quantity —
  `RueckmeldungPage.tsx:1013-1035`). The attachment view added in Gap D is the one real
  leak channel: any price list attached to an order becomes downloadable by the field.
- NEXUS Brand System for all new UI: CSS tokens only, no hex, no gradients, no shadows,
  no toasts, no skeletons, outline icons.
- All user-facing strings via i18next (`de.json`, `es.json`).
- Extend demo mode (`src/lib/demo/fixtures.ts`, `supabase-mock.ts`) with an order using
  this plan, covering both external branches and both TA/sync outcomes.

## Open questions

- **Faser anmeldung**: is the photo of the registration screen/app, or of the physical
  label? Changes only the hint text and the example image.
- **Scope**: this plan covers `ACT_001` (230 €). `ACT_003` "Fusion + Bohrung" (184 €,
  no activation) and `ACT_004` "Aktivierungsteil" (46 €, activation only) presumably
  need trimmed variants — deliberately out of scope until confirmed.
- **Signature gating**: does a missing signature block the Rückmeldung submission, or
  only the internal certification? Default assumption: same gate as every other required
  node, i.e. it blocks.

## STOP conditions

- STOP if `git ls-tree upstream/develop supabase/migrations/` shows `079`/`080` taken.
- STOP before mounting the technician attachment view until PR #24 (migration `073`) is
  merged AND applied — until then the document policy is still team-scoped and
  role-agnostic, and the photo bucket is world-readable to any authenticated user.
- Never edit an existing `(key, version)` plan in place — publish a new version.
- Never hand-edit `database.types.ts`.
