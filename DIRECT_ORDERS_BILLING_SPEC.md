# Direct Orders + Billing Model — Phase 2-5 Spec

> Implementation guide for **@alejandro** to pick up after Phase 0 (DB schema) + Phase 1 (state-machine enforcement) land.
>
> **Owner**: Alejandro · **Reviewer**: Jarl
>
> Phases 0 and 1 are delivered in this PR. Phases 2-5 are described here for follow-up implementation.

---

## Why this exists

Lumen does **not** issue invoices. The invoice is emitted by **DATEV** (German accounting system). Lumen produces:

1. A signed **certification** with SHA-256 audit trail (already implemented).
2. A **billable-quantity record** per certified order — quantity × snapshot price × line items.
3. A **DATEV-compatible export** that Beatriz/Janet can import in DATEV to generate the actual `Rechnung`.

There are two flavours of work order:

- **With-client**: routed through Insyte / Vancom / etc. Goes through full pipeline with `sent_to_client → client_accepted` before invoicing.
- **Direct**: no external client. `client_id IS NULL`. Skips client phase: certified internally, then invoiced.

---

## Already delivered in this PR (Phases 0-1)

### Phase 0 — `supabase/migrations/005_direct_orders_and_billing.sql`

> **Depends on `004_service_catalog_seed.sql`** (already in `upstream/develop`). Migration 005 must be applied AFTER 004.

- `work_orders.client_id` → nullable (`NULL` = direct order)
- `wo_detail_fusion_ap` / `wo_detail_fusion_dp` gain `cabinet_code TEXT` + `card_count INTEGER`
- New table `work_order_billing_lines` with snapshot pricing (`unit_price_snapshot`) and `subtotal` as a stored generated column. FK `service_item_id → service_items(id)` resolves against the catalog seeded in 004.
- `validate_work_order_status_transition()` updated: direct orders may shortcut `internally_certified → invoiced`

**Alejandro applies this manually in Supabase SQL Editor, then runs `supabase gen types typescript` to refresh `src/types/database.types.ts`.**

### Phase 1 — `src/services/workOrderService.ts`

- `validateStatusTransition(from, to, role?, isDirectOrder?)` — pure machine + role validator. New 4th param mirrors the SQL trigger's direct-order shortcut.
- `validateTransitionPrerequisites(workOrderId, toStatus)` — async DB-backed prerequisite check. Enforces:
  - `→ internally_certified` requires complete `wo_detail_*` (per-type required fields, see `REQUIRED_DETAIL_FIELDS`) **and** before/during/after photos uploaded.
  - `→ invoiced` requires a `certification_audits` row with the right `cert_type` (`internal` for direct, `client` for with-client).
- `transitionWorkOrderStatus()` updated to fetch `client_id`, derive `isDirectOrder`, and call both validators before the UPDATE.
- 21 new tests covering the new rules. Total: 72 tests passing.

---

## Phase 2 — Billable quantities per work_type

### Goal
The Rückmeldung form must capture the **billable unit** per work type so Phase 3 can compute the invoice preview.

### Model per work_type

| work_type | Billable unit | Source field(s) | UI in RückmeldungPage |
|---|---|---|---|
| `soplado` | meters | `wo_detail_soplado.meters` | already exists |
| `fusion_ap` / `fusion_dp` | cabinet (NE3/NE4) **or** cards (POP) | `wo_detail_fusion_*.cabinet_code` + `card_count` | NEW — see below |
| `alta` | multiple billable items per order | `work_order_billing_lines[]` | NEW multi-item editor |
| `nt_installation` | flat per unit | TBD (likely 1 line in `work_order_billing_lines`) | TBD |
| `patchkabel` | per cable | TBD | TBD |
| `pop` | TBD — `wo_detail_pop` table does not yet exist | blocked | blocked |

### Phase 2 work items

#### 2.1 — Fusion: cabinet + card_count UI
**File**: `src/pages/technician/RueckmeldungPage.tsx`, plus `src/constants/detail-fields.ts`

Add to the Fusión AP/DP detail form:
- `cabinet_code` — text input, required. Format hint: `NE3-S-001` / `POP-X-12`.
- `card_count` — integer input, optional, min `1`. Visible only when `line` would indicate POP work, but for v1 just show it always with a label "Cards (only for POP)".

#### 2.2 — Alta: multi-item billing editor
**Files**: `src/pages/technician/RueckmeldungPage.tsx` (or a new sub-component), `src/services/workOrderService.ts`

Add an editor section after the Alta detail fields:
- "Geleistete Posten" — list of `work_order_billing_lines` rows.
- Each row: searchable selector against `service_items` (filtered by `client_id` or operator if applicable), qty input (numeric, > 0), notes (optional).
- "Add line" / "Remove line" buttons.
- Show running total at the bottom: `Σ(qty × current unit_price)`.

**Service layer**:
```ts
// src/services/workOrderService.ts
export async function fetchBillingLines(workOrderId: string)
export async function upsertBillingLines(workOrderId: string, lines: BillingLineDraft[])
```
On insert, **snapshot the current `unit_price` from `service_items`** into `unit_price_snapshot`. Never copy by reference.

#### 2.3 — Contract import for Alta service items — ✅ DONE upstream
Already in `upstream/develop` via commit `6e7e0b9` (`feat(catalog): service items CRUD + seed 102 contract prices from UMTELKOMD PDF`):
- `service_items` table created with RLS (admin full, all auth read active rows).
- 102 rows seeded from Insyte NE3 Rev 6, Insyte NE4 MDU v0, Vancom NE4 Rahmenvertrag — covering operators DGF, MER, GFPLUS, GFNW, GVG, WESTC.
- Admin CRUD UI in `src/pages/admin/ServiceItemsPage.tsx`.

What remains in this phase (still open):
- Bind selected `service_item_id` to `work_order_billing_lines` from the Rückmeldung form (2.2 above).
- Filter the selector by the order's `client_id` and `operator_id` so technicians only see relevant catalog rows.

### Acceptance criteria — Phase 2
- Technician fills Fusión cabinet + card_count → values persist on submit.
- Technician adds 3 Alta line items → 3 rows in `work_order_billing_lines` with snapshotted prices.
- Sum of subtotals = sum of `qty × unit_price_snapshot` (DB column `subtotal` is generated).
- All existing Rückmeldung flows still work for non-Alta types.

---

## Phase 3 — Invoice preview modal

### Goal
Before transitioning to `invoiced`, admin sees exactly what will be billed. No surprises.

### What already exists (LUM-018)
The current `WorkOrderDetailPage.tsx` (commit `a137bdd` on `origin/main`) already has an **invoice-number modal** that prompts for an invoice number string and writes it to `state_history.notes` on the `client_accepted → invoiced` transition. This phase **replaces** that modal — it must not delete the LUM-018 wiring without giving admin the same final outcome (status → `invoiced` + history record).

A `pdfService.ts` (LUM-016) using jsPDF already generates the certification PDF — reuse it for the invoice-preview download if useful, but invoice itself stays in DATEV.

### Implementation

**File**: new component `src/components/admin/InvoicePreviewModal.tsx`, replaces the inline invoice modal in `WorkOrderDetailPage.tsx` and is also called from `CertificationPage.tsx` for bulk invoicing.

Modal contents:
- **Header**: `Order LUM-XXX · Direkt` or `Order LUM-XXX · Kunde: Insyte Deutschland`.
- **Lines table**: code, description (de), qty, unit, unit_price_snapshot, subtotal — sourced from `work_order_billing_lines`.
- **Footer**: total bruto.
- **For with-client orders**: show last `certification_audits` of `cert_type='client'` — `certified_by`, `certified_at`, `data_hash` (truncated).
- **Optional invoice-number field**: keep the LUM-018 input as a free-text reference that goes into `state_history.notes` (DATEV is the system of record for the real invoice number — this is just a Lumen-side label).
- **CTA buttons**: `Abbrechen` (ghost) / `Fakturierung bestätigen` (primary).

Confirming triggers `transitionWorkOrderStatus(id, 'invoiced', userId, notes, 'admin')`. The Phase 1 validations will block if prerequisites are not met.

### Acceptance criteria — Phase 3
- Modal blocks invoice transition when no billing lines exist (empty preview).
- Modal blocks invoice transition for with-client order without `cert_type='client'` audit row (Phase 1 validation surfaces the message).
- After confirm, status moves to `invoiced` and a `state_history` row is written with notes containing the total amount and (optional) invoice-number reference.
- LUM-018 outcomes preserved: existing orders that already reached `invoiced` keep their note format readable.

---

## Phase 4 — DATEV export

### Goal
A button that exports a CSV that DATEV can import as a `Buchungsstapel` (or similar). Beatriz/Janet drop it into DATEV.

### Open question (blocker)
**Action item for Jarl**: confirm with Beatriz which DATEV import format she uses:
- `DATEV-Format ASCII` (legacy, fixed-width)
- `DATEV-Format CSV (EXTF)` (modern, headered CSV)
- Another tool's intermediate (Lexoffice, Sevdesk) that ingests DATEV-style CSV

Without this, default to **EXTF CSV** as the most common modern format.

### EXTF CSV columns (minimum viable)

```
Umsatz | Soll/Haben | WKZ | Kurs | Konto | Gegenkonto | BU | Belegdatum | Belegfeld 1 | Buchungstext | Steuersatz
```

Mapping per order:
- `Umsatz` — total bruto from `work_order_billing_lines` sum
- `Soll/Haben` — `S` (Soll, debit on customer account)
- `Konto` — customer account in DATEV (TBD — needs Beatriz mapping per `client_id` or fixed direct-order account)
- `Gegenkonto` — revenue account (TBD — likely 8400 Erlöse 19% USt)
- `Belegfeld 1` — `order_number`
- `Buchungstext` — `Auftrag {order_number} - {project.code}`
- `Steuersatz` — `19` (default German VAT)

### Implementation

**File**: new `src/services/datevExportService.ts`, button in `src/pages/admin/CertificationPage.tsx`.

```ts
export async function buildDatevExport(orderIds: string[]): Promise<Blob> {
  // 1. Fetch all orders + billing_lines + clients + projects
  // 2. Build CSV rows per order
  // 3. Return Blob with `text/csv;charset=utf-8`
}
```

UI in CertificationPage:
- New tab `Bereit für DATEV` — shows orders in `invoiced` state without a DATEV export marker yet (we'll add a `datev_exported_at` column in a future migration if Beatriz needs idempotency)
- Button `DATEV-Export herunterladen` triggers `buildDatevExport()` and downloads the file.

### Acceptance criteria — Phase 4
- Click "Export DATEV" with N invoiced orders selected → downloads `lumen-datev-{date}.csv` with N rows.
- File opens cleanly in Excel and DATEV import accepts it (Beatriz validates).
- Direct orders and with-client orders both produce valid rows.

---

## Phase 5 — UI/UX cleanup

### 5.1 — Direct-order toggle in WorkOrderFormPage
**File**: `src/pages/admin/WorkOrderFormPage.tsx`

- Add a checkbox: `[ ] Direktauftrag (kein externer Kunde)`.
- When checked: hide/disable the `client_id` selector and submit `client_id: null`.
- Field copy: "Direkte Aufträge überspringen die Kundenfreigabe und gehen direkt zur Fakturierung."

### 5.2 — WorkOrderDetailPage hides client phase for direct orders
**File**: `src/pages/admin/WorkOrderDetailPage.tsx`

- When `order.client_id === null`:
  - Hide the `Send to client`, `Accept`, `Reject` action buttons.
  - From `internally_certified`, show a single `Fakturierung vorbereiten` button → opens InvoicePreviewModal (Phase 3).
- Otherwise, current behaviour stays.

### 5.3 — CertificationPage: split tabs for direct vs with-client
**File**: `src/pages/admin/CertificationPage.tsx`

- Add a top-level filter: `Alle | Mit Kunde | Direktaufträge`.
- Tabs `client_accepted` and `sent_to_client` are hidden when `Direktaufträge` is active (irrelevant).
- Current state-based tab UI otherwise unchanged.

### Acceptance criteria — Phase 5
- New work order created with `Direktauftrag` checked → `client_id IS NULL` in DB, list shows it with a `Direkt` badge.
- DetailPage for direct order shows shortcut to invoice preview, no client buttons.
- CertificationPage `Direktaufträge` filter scopes the list correctly.

---

## Standards to respect (NEXUS.OS — see `BRIEF.md`)

- All panels/cards: `bg-[var(--color-bg-1)]` or `bg-[var(--color-bg-2)]`. **Never** colored backgrounds.
- Headings: `<h1>` = `font-light`, `<h2>` = `font-medium`, both on `var(--font-display)`.
- Radii: only `rounded-sm` / `rounded-md` / `rounded-lg`. No `xl` / `2xl` / `3xl`.
- Buttons: `.nx-btn .nx-btn-primary | -secondary | -ghost | -danger`. Never `rounded-full` on buttons.
- Accent `#FF4D2E` reserved for CTAs / active states / `.OS` brand fragment / chart highlights.
- No `bg-gray-*`, `text-gray-*`, gradients, shadows, blur, skeletons, toasts, filled icons, parallax.
- Spacing on Tailwind 4px base scale (`p-1`, `p-2`, …). No arbitrary values.

## Patterns to respect

- **Service / page split**: business logic in `src/services/*.ts`, async data + UI in `src/pages/*.tsx`. No DB calls in components.
- **State transitions** always go through `transitionWorkOrderStatus()`. Never write `status` directly.
- **State-machine source of truth**: `validate_work_order_status_transition()` SQL trigger AND `VALID_TRANSITIONS` in `workOrderService.ts`. **Keep both in sync** when adding states.
- **Translations**: any new UI string goes in `src/i18n/locales/{de,es}.json`. Use `useTranslation()`.
- **Tests**: every new service function gets a test. Mock supabase via the chain pattern in `src/__tests__/workOrderService.test.ts`.

---

## Test plan (post Phase 5)

- [ ] Create direct order, fill Rückmeldung, certify internally, invoice via preview modal → `invoiced` status with billing lines persisted.
- [ ] Create with-client order, full pipeline, attempt to invoice without client acceptance → blocked with German message.
- [ ] Export 5 invoiced orders to DATEV CSV → file downloads, Beatriz imports successfully.
- [ ] Existing flows (cancel, return, client_rejected) still work.
- [ ] `npm test` and `npm run typecheck` green.

---

## Out of scope (next iteration)

- POP work-type table (`wo_detail_pop`) and its detail-form mapping.
- Digital signature widget for Alta `client_signature` (currently boolean).
- GPS capture on Rückmeldung submission.
- Photo retry queue when offline upload fails mid-Rückmeldung.
- DATEV idempotency (`datev_exported_at` column) — add if Beatriz double-imports become a real problem.
