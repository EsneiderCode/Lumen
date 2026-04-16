# LUMEN — Scrum Plan
## German Fiber Optic Operations Platform

**Client**: HMR Nexus Engineering GmbH | **PO**: Jarl / Isabelle
**Timeline**: 30 sprints (5 phases) | **Start**: 2026-03-25 | **MVP**: 2026-05-06
**Stack**: React 19 + TypeScript + Vite + Tailwind v4 | Supabase | Vercel | jsPDF | SheetJS

---

## User Personas

| Role | Access | Key Actions |
|------|--------|-------------|
| **Admin** (Jarl/Isabelle) | Full system | Create/assign/certify OS, manage personnel & payroll, dashboard |
| **Interner Mitarbeiter** | Own work orders | Start/execute OS, submit Rückmeldung, request vacation, view payslips |
| **Colaborador Externo** | Assigned OS | Submit Rückmeldung, upload required docs, view certification/payment status |

> Auth: All roles use **email/password** via Supabase Auth. PIN removed (insecure).

---

## Epic Summary

| ID | Epic | Priority | Phase |
|----|------|----------|-------|
| LUM-E001 | Service Orders Management | Highest | 1 |
| LUM-E002 | Field Reporting (Rückmeldungen) | Highest | 1 |
| LUM-E003 | Dual Certification System | High | 2 |
| LUM-E004 | Personnel Management | Medium | 3 |
| LUM-E005 | Material Control | Medium | 4 |
| LUM-E006 | Executive Dashboard | High | 5 |
| LUM-E007 | Automated Alerts | Low | 4 |

---

## Work Order State Machine

```
Creada → Asignada → En progreso → Ejecutada → Rückmeldung pendiente →
Rückmeldung enviada → Certificada internamente → Enviada al cliente →
Aceptada por cliente → Facturada → Pagada
                          ↕
              Requiere corrección / Rechazada por cliente
```

**Blocking rules:**
- No Rückmeldung → cannot certify internally
- No internal cert → cannot send to client
- No client acceptance → cannot invoice
- Contractor with expired/missing docs → **assignment blocked**

---

## Database Schema

```sql
users, profiles (admin / interner_mitarbeiter / colaborador_externo)
work_orders, work_order_state_history, work_order_details_*
clients (Insyte, Vancom), projects (HXT/RSD/WCB/QFF/WRZ/EHR)
teams (Rot/Grün/Blau/Gelb), operators (DGF/GFP/UGG)
ruckmeldungen, ruckmeldung_photos
certifications_internal, certifications_client
employee_profiles, payroll_records, vacation_requests
contractor_profiles, contractor_documents
materials, material_inventory, work_order_materials
alerts_log
```

---

## Sprint Roadmap

---

### FASE 1 — MVP CORE (Semanas 1–6) 🚀

---

#### Sprint 1 — Foundation ✅ (2026-03-25 → 2026-03-26)
**Goal**: App corriendo, Supabase conectado, PWA funcional, routing por roles

| Story | Title | Pts |
|-------|-------|-----|
| LUM-001 | Project infrastructure (React 19 + Vite + TS strict + Tailwind v4 + ESLint) | 5 |
| LUM-002 | Supabase config (Auth + PostgreSQL + Storage + typed client) | 8 |
| LUM-006 | PWA (vite-plugin-pwa, manifest, service worker, offline fallback) | 3 |
| LUM-007 | React Router v7 — 3 role-based layouts + ProtectedRoute + LoginPage | 3 |

**Total**: 19 pts ✅

---

#### Sprint 2 — Auth & Data Model ✅ (2026-03-26)
**Goal**: 3 roles autenticados con email/password, schema completo en Supabase

| Story | Title | Pts |
|-------|-------|-----|
| LUM-003 | Admin auth (email/password, session, redirect to dashboard) | 5 |
| LUM-004 | Technician auth (email/password — PIN descartado) | 5 |
| LUM-005 | Contractor auth (email/password, role detection from profile) | 3 |
| LUM-008 | DB schema migration (all tables, FK, indexes, RLS policies) | 8 |

**Total**: 21 pts ✅
**Notes**: Password reset UI ready; SMTP (Resend) pending config in Supabase dashboard.

---

#### Sprint 3 — Work Orders Core ✅ (2026-03-26)
**Goal**: Admin crea, edita y asigna órdenes de servicio

| Story | Title | Pts |
|-------|-------|-----|
| LUM-009 | WorkOrderFormPage — all fields, dynamic detail fields by work_type (6 types), validation | 13 |
| LUM-010 | WorkOrdersPage — table with filters (status/team/type/client/project/search), delete | 8 |
| LUM-010b | WorkOrderAssignPage — team + technician filtered by team + date → status: assigned | 8 |

**Total**: 29 pts ✅
**Work types**: Soplado NE3/NE4, Fusión AP/DP, Alta, NT Installation, Patchkabel

---

#### Sprint 4 — Rückmeldungen ✅ (2026-03-29)
**Goal**: Técnico ejecuta OS y envía reporte de campo con fotos

| Story | Title | Pts |
|-------|-------|-----|
| LUM-011 | TechOrdersPage — mobile cards, grouped Active/Completed, filtered by user | 5 |
| LUM-012 | TechOrderDetailPage — status buttons (assigned→in_progress→executed), history log | 5 |
| LUM-013 | RueckmeldungPage — dynamic fields by work_type, photo upload (before/during/after), times | 13 |
| LUM-014 | AdminOrderDetailPage — Rückmeldung review, photo grid, "Interne Zertifizierung" button | 5 |

**Total**: 28 pts ✅
**Storage**: Supabase bucket `work-order-photos` | RLS policies deployed.

---

#### Sprint 5 — Certification Core ✅ (2026-03-30)
**Goal**: Ciclo completo de certificación interna + cliente + PDF

| Story | Title | Pts |
|-------|-------|-----|
| LUM-015 | CertificationPage — cola agrupada por estado, filtros (team/project/date), bulk select | 8 |
| LUM-016 | PDF certificate generation (jsPDF — OS data, Rückmeldung, fotos, Statusverlauf) | 8 |
| LUM-017 | Client delivery tracking — `sent_to_client` → `client_accepted/rejected` + modal con razón | 5 |
| LUM-018 | Invoicing — `client_accepted` → `invoiced` (nº factura) → `paid` + Excel export batch | 5 |

**Total**: 26 pts ✅
**Notes**: Bulk actions: certify / send to client / invoice. WorkOrderFilters extended with `date_from`/`date_to`. ESLint `react-hooks/set-state-in-effect` fixed across WorkOrdersPage + TechOrdersPage.

---

#### Sprint 6 — MVP Polish & Contractor View ✅
**Goal**: MVP completo y entregable — contratistas ven sus OS y certificaciones

| Story | Title | Pts |
|-------|-------|-----|
| LUM-019 | ContractorOrdersPage — assigned OS, status, certification status, payment visibility | 8 |
| LUM-020 | Admin: Work order edit + history timeline view | 5 |
| LUM-021 | Work order filtering/search improvements (all roles) | 3 |
| LUM-022 | SMTP config (Resend) — password reset emails funcionales | 3 |

**Total**: 19 pts ✅

> **🎯 MVP ENTREGABLE — Fin Semana 6**: Auth + OS completas + Rückmeldungen + Certificación + Contractor view

---

#### Sprint 6.5 — Non-Conformity & Photo Management ✅ (2026-03-30, branch: develop)
**Goal**: Flujo completo de devolución por no-conformidad + gestión de fotos en campo

| Story | Title | Pts |
|-------|-------|-----|
| LUM-025a | Admin: Return work order for non-conformity (modal con categoría + descripción obligatoria ≥20 chars) desde `rueckmeldung_sent` o `internally_certified` → status `returned` | 5 |
| LUM-025b | Technician: Red banner with non-conformity reason + "Korrigierte RM senden" button on RueckmeldungPage; returned orders appear in dedicated top section of TechOrdersPage; TechOrderDetailPage shows banner + "Rückmeldung korrigieren" button | 5 |
| LUM-025c | Technician: Delete photo button (✕ overlay) on each uploaded photo in RueckmeldungPage — removes from Supabase Storage + DB | 3 |

**Total**: 13 pts ✅

**Commits**: `83deb4b`, `4b194d6`, `5869638` (branch `develop`)

---

### FASE 2 — CERTIFICACIÓN AVANZADA (Semanas 7–10)

---

#### Sprint 7 — Certification Review Interface
**Goal**: Vista comparativa completa para revisión de calidad

| Story | Title | Pts |
|-------|-------|-----|
| LUM-023 | Side-by-side assigned vs. reported (photos, materials, times) | 13 |
| LUM-024 | Certification audit trail (timestamps, admin ID, cryptographic hash) | 5 |
| LUM-025 | Return to technician with comments → status: `returned` ✅ (implemented in Sprint 6.5) | 5 |

**Total**: 23 pts

---

#### Sprint 8 — Client Certification & Reports
**Goal**: Proceso completo hacia el cliente y reportes Excel

| Story | Title | Pts |
|-------|-------|-----|
| LUM-026 | Client cert batch processing — bulk PDF generation | 8 |
| LUM-027 | Client delivery tracking (email/SharePoint confirmation) | 5 |
| LUM-028 | Client rejection workflow — reasons, return to correction queue | 5 |
| LUM-029 | Excel consolidation reports (by period/project/client) | 5 |

**Total**: 23 pts

---

#### Sprint 9 — Contractor Certification Visibility
**Goal**: Contratistas ven en qué punto está su certificación y pago

| Story | Title | Pts |
|-------|-------|-----|
| LUM-030 | Contractor certification calendar | 5 |
| LUM-031 | Contractor payment status tracker | 5 |
| LUM-032 | Admin: Automatic progression to invoicing on client acceptance | 5 |

**Total**: 15 pts

---

#### Sprint 10 — Certification Hardening
**Goal**: Auditoría completa y validaciones de estado

| Story | Title | Pts |
|-------|-------|-----|
| LUM-033 | Complete state machine validation rules (all 13 states) | 8 |
| LUM-034 | Certification seal (hash + timestamp + admin signature) | 5 |
| LUM-035 | Bulk certification operations | 5 |

**Total**: 18 pts

---

### FASE 3 — PERSONAL (Semanas 11–20)

---

#### Sprint 11 — Employee Profiles
**Goal**: Perfiles de empleados alemanes con datos de compliance

| Story | Title | Pts |
|-------|-------|-----|
| LUM-036 | Employee profile CRUD (Steuer-ID, SV-Nummer, IBAN, Steuerklasse I-VI, contract) | 13 |
| LUM-037 | Contract type (befristet/unbefristet), hours, health insurance type | 5 |

**Total**: 18 pts

---

#### Sprint 12 — German Payroll ⚠️
**Goal**: Cálculo Brutto → Netto con todas las deducciones alemanas

| Story | Title | Pts |
|-------|-------|-----|
| LUM-038 | Payroll calculation: Lohnsteuer + Soli (5.5%) + KV + PV + RV + AV → Netto | 21 |

**Total**: 21 pts
> ⚠️ **Validate with Steuerberaterin Janet Martinez de Peglow before go-live**

---

#### Sprint 13 — Gehaltsabrechnung PDF
**Goal**: Nómina mensual descargable en PDF

| Story | Title | Pts |
|-------|-------|-----|
| LUM-039 | Gehaltsabrechnung PDF (HMR Nexus header, all deductions itemized, YTD totals) | 13 |
| LUM-040 | Historical payslip archive per employee | 5 |

**Total**: 18 pts

---

#### Sprint 14 — Vacation Management (BUrlG)
**Goal**: Gestión de vacaciones conforme a ley alemana

| Story | Title | Pts |
|-------|-------|-----|
| LUM-041 | Urlaubsverwaltung — min. 20 days, pro-rata, carryover (max ⅓, expires Mar 31) | 13 |
| LUM-042 | Vacation request/approval workflow with notifications | 13 |

**Total**: 26 pts

---

#### Sprint 15 — Sick Leave & Hours
**Goal**: Ausencias, control de horas y reportes mensuales

| Story | Title | Pts |
|-------|-------|-----|
| LUM-043 | Sick leave (Krankmeldung) registration | 5 |
| LUM-044 | Working hours tracking from work order history | 5 |
| LUM-045 | Monthly payroll summary reports | 5 |

**Total**: 15 pts

---

#### Sprint 16 — Contractor Profiles & Document Alerts
**Goal**: Perfiles de colaboradores con alertas de vencimiento

| Story | Title | Pts |
|-------|-------|-----|
| LUM-046 | Contractor profile CRUD | 5 |
| LUM-047 | Document expiration alerts (30-day warning → email + Telegram) | 8 |

**Total**: 13 pts

---

#### Sprint 17 — Document Upload System
**Goal**: Portal de documentación obligatoria para colaboradores

| Story | Title | Pts |
|-------|-------|-----|
| LUM-048 | Upload portal for 6 required docs: Gewerbeanmeldung, Haftpflicht, Unbedenklichkeit (Finanzamt + SOKA-BAU), ID/Passport, Subunternehmervertrag | 13 |

**Total**: 13 pts

---

#### Sprint 18 — Assignment Blocking & Contractor Dashboard
**Goal**: Bloqueo automático y visibilidad completa del colaborador

| Story | Title | Pts |
|-------|-------|-----|
| LUM-049 | Auto-block assignment for expired/missing docs (with admin override + audit log) | 8 |
| LUM-050 | Contractor dashboard — assignments, certs, docs status, payment | 5 |

**Total**: 13 pts

---

#### Sprint 19 — Document Validation & Payment Visibility
**Goal**: Admin valida documentos; colaboradores ven estado de pago

| Story | Title | Pts |
|-------|-------|-----|
| LUM-051 | Document validation/approval workflow (admin) | 5 |
| LUM-052 | Contractor payment status visibility (linked to cert cycle) | 5 |

**Total**: 10 pts

---

### FASE 4 — MATERIAL & ALERTAS (Semanas 21–25)

---

#### Sprint 20 — Material Catalog
**Goal**: Catálogo de materiales gestionable

| Story | Title | Pts |
|-------|-------|-----|
| LUM-053 | Material catalog CRUD (units: m/ud/rollo/caja/kg, SKU, min stock, supplier) | 13 |

**Total**: 13 pts

---

#### Sprint 21 — Stock & Consumption
**Goal**: Trazabilidad completa del material

| Story | Title | Pts |
|-------|-------|-----|
| LUM-054 | Stock tracking by team/vehicle | 5 |
| LUM-055 | Material assignment to work orders | 5 |
| LUM-056 | Material consumption in Rückmeldungen | 5 |
| LUM-057 | Low stock alerts (< 20% minimum) | 5 |

**Total**: 20 pts

---

#### Sprint 22 — Telegram Webhook
**Goal**: Integración con Telegram para notificaciones

| Story | Title | Pts |
|-------|-------|-----|
| LUM-058 | Telegram bot + webhook (priority levels: Baja/Media/Alta/Urgente, retry, spam limits) | 8 |

**Total**: 8 pts

---

#### Sprint 23 — All Alert Triggers ⚠️
**Goal**: Los 11 triggers automatizados operativos

| Story | Title | Pts |
|-------|-------|-----|
| LUM-059 | 11 triggers: assigned >1d without Rückmeldung, executed >4h without Rückmeldung, stock below min, cert not sent >24h, project deadline <48h, client rejection, doc expiry <30d, doc expired (blocking), vacation request, contract expiry <60d | 21 |

**Total**: 21 pts
> ⚠️ Each trigger: condition + recipient + priority + template + frequency control

---

### FASE 5 — DASHBOARD & POLISH (Semanas 26–30)

---

#### Sprint 24 — Alert Recipients & KPI Dashboard
**Goal**: Alertas enrutadas correctamente + 8 KPIs en vivo

| Story | Title | Pts |
|-------|-------|-----|
| LUM-060 | Alert recipient management (Jarl, Isabelle, technicians) | 5 |
| LUM-061 | Executive KPI dashboard (8 metrics live) | 8 |

**Total**: 13 pts

---

#### Sprint 25 — Traffic Lights, Timeline & Map
**Goal**: Visibilidad completa de proyectos

| Story | Title | Pts |
|-------|-------|-----|
| LUM-062 | Project traffic light system (green/yellow/red) | 5 |
| LUM-063 | Weekly timeline view by team | 5 |
| LUM-064 | Map view of work orders by city/zone | 5 |

**Total**: 15 pts

---

#### Sprint 26 — Calendars & Contractor Dashboard
**Goal**: Calendarios de ausencias + compliance de colaboradores

| Story | Title | Pts |
|-------|-------|-----|
| LUM-065 | Vacation/absence calendar for admin (team overlap view) | 5 |
| LUM-066 | Contractor documentation compliance dashboard | 5 |

**Total**: 10 pts

---

#### Sprint 27 — PWA Offline & Performance
**Goal**: App funcional offline para técnicos en campo

| Story | Title | Pts |
|-------|-------|-----|
| LUM-067 | PWA offline mode (service worker, IndexedDB sync queue) | 5 |
| LUM-068 | Performance optimization (code splitting, caching, image optimization) | 5 |

**Total**: 10 pts

---

#### Sprint 28 — Final Polish & UAT
**Goal**: Sistema production-ready aprobado por Jarl e Isabelle

| Story | Title | Pts |
|-------|-------|-----|
| LUM-069 | UX/UI final polish (Glasfaser design system consistency) | 5 |
| LUM-070 | User acceptance testing + stakeholder sign-off | 8 |

**Total**: 13 pts

---

## Story Point Summary

| Phase | Sprints | Points |
|-------|---------|--------|
| Fase 1 — MVP Core | 1–6 | ~136 pts (Sprints 1–4: ✅ completed) |
| Fase 2 — Certificación | 7–10 | ~79 pts |
| Fase 3 — Personal | 11–19 | ~147 pts |
| Fase 4 — Material & Alertas | 20–23 | ~62 pts |
| Fase 5 — Dashboard & Polish | 24–28 | ~61 pts |
| **Total** | **28 sprints** | **~485 pts** |

**Velocity**: 13–21 pts/sprint

---

## Risks

| Risk | Mitigation |
|------|-----------|
| German payroll complexity | Validate with Janet before Sprint 12 goes live |
| Supabase perf with large datasets | DB indexes + caching from day 1 (done in Sprint 1) |
| PWA offline complexity | Incremental — basic offline first, full sync in Sprint 27 |
| Changing German regulations | Flexible architecture; payroll rates configurable |
| Client cert process changes (Vancom/Insyte) | Configurable workflows in Phase 2 |

---

## Definition of Done

**Story**: AC met · Code reviewed · Mobile responsive · German compliance verified (where applicable)
**Sprint**: Goal achieved · Demo delivered · Backlog refined for next sprint
**Release**: Staging tested · Jarl + Isabelle sign-off · Payroll validated by Janet (HR module)

---

*Project start: 2026-03-25 | MVP go-live: 2026-05-06 | Full platform: 2026-10-21*
*Supabase: pqtrjescwavcezdzfoja (EU Frankfurt) | Deploy: lumen-ten-silk.vercel.app*
