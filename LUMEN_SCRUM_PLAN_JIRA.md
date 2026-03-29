# LUMEN - Scrum Development Plan for Jira
## German Fiber Optic Operations Platform

**Project**: LUMEN - Central Operational Platform
**Client**: HMR Nexus Engineering GmbH
**Timeline**: 30 weeks (5 phases) | MVP en 6 semanas
**Methodology**: Scrum (1-week sprints)
**Team**: Product Owner (Jarl/Isabelle), Scrum Master, Development Team

---

## 🎯 PROJECT OVERVIEW

**Vision**: Unified platform for work order management, dual certification (internal + client), and personnel management for German fiber optic operations.

**Problem Solved**:
- Double certification cycle without traceability (technicians → Nexus → client)
- Lost or delayed Rückmeldungen blocking payments
- No real visibility of work order status by project/team
- Dispersed personnel and documentation management

**Key Principle**: LUMEN is the single source of truth - work orders are born here, live here, and closed here.

---

## 👥 USER PERSONAS

### 🔑 Admin (Jarl/Isabelle)
- Full system access
- Creates, assigns, manages work orders
- Certifies work internally
- Sends certifications to clients
- Manages payroll, vacations, permits
- Views complete executive dashboard

### 🪖 Internal Technician (Formal Nexus/UMTELKOMD employee)
- Views assigned work orders (day/week)
- Reports Rückmeldung (progress, photos, materials)
- Views monthly payroll (Gehaltsabrechnung)
- Requests vacations/permits
- Views work history and hours

### 🤝 External Contractor (Subcontractor)
- Views assigned work orders
- Reports Rückmeldung
- Views certification status (knows when payment comes)
- Certification calendar
- Uploads required documentation

---

## 🗂️ EPIC STRUCTURE (7 Core Modules)

### EPIC 1: Service Orders Management
**Epic ID**: LUM-E001  
**Priority**: Highest  
**Description**: Complete work order lifecycle management system

### EPIC 2: Field Reporting (Rückmeldungen)
**Epic ID**: LUM-E002  
**Priority**: Highest  
**Description**: Technician progress and completion reporting system

### EPIC 3: Dual Certification System
**Epic ID**: LUM-E003  
**Priority**: High  
**Description**: Internal certification (Nexus) → External certification (Client)

### EPIC 4: Personnel Management
**Epic ID**: LUM-E004  
**Priority**: Medium  
**Description**: German employees (payroll, vacations) + external contractors (documentation)

### EPIC 5: Material Control
**Epic ID**: LUM-E005  
**Priority**: Medium  
**Description**: Inventory tracking by team/vehicle with alerts

### EPIC 6: Executive Dashboard
**Epic ID**: LUM-E006  
**Priority**: High  
**Description**: KPIs, project status monitoring, team performance

### EPIC 7: Automated Alerts
**Epic ID**: LUM-E007  
**Priority**: Low  
**Description**: Telegram notification system for critical events


---

## 🗺️ SPRINT → EPIC ALIGNMENT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 1 — MVP CORE (Semanas 1–6) 🚀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SETUP (Sin epic)
├── Sprint 1  →  Infraestructura + Supabase + PWA + Routing
└── Sprint 2  →  Autenticación (3 roles) + DB Schema

EPIC 1 — Service Orders Management (LUM-E001)
├── Sprint 3  →  Crear OS + Asignar OS
├── Sprint 4  →  Editar + Vistas + Búsqueda
└── Sprint 5  →  Máquina de estados + Flujo ejecución técnico

EPIC 2 — Field Reporting / Rückmeldungen (LUM-E002)
└── Sprint 6  →  Formulario Rückmeldung + Fotos + Material

🎯 ENTREGABLE MVP: Auth + OS completas + Rückmeldungen con fotos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 2 — CERTIFICACIÓN (Semanas 7–11)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPIC 3 — Dual Certification System (LUM-E003)
├── Sprint 7  →  Dashboard básico + Cola certificación + Auditoría
├── Sprint 8  →  Vista comparativa (assigned vs reported)
├── Sprint 9  →  Aprobación + Devolución + Bulk
├── Sprint 10 →  Certificación cliente + PDF
└── Sprint 11 →  Batch + Tracking + Rechazo + Facturación + Excel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 3 — PERSONAL (Semanas 12–21)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPIC 4 — Personnel Management (LUM-E004)
├── Sprint 12 →  Perfiles empleados
├── Sprint 13 →  Cálculo nómina (Brutto → Netto) ⚠️
├── Sprint 14 →  PDF Gehaltsabrechnung
├── Sprint 15 →  Gestión vacaciones (BUrlG)
├── Sprint 16 →  Flujo solicitud vacaciones
├── Sprint 17 →  Bajas + Horas + Reportes nómina
├── Sprint 18 →  Perfiles colaboradores + Alertas vencimiento
├── Sprint 19 →  Sistema subida documentos (6 tipos)
├── Sprint 20 →  Bloqueo asignación + Dashboard colaborador
└── Sprint 21 →  Validación docs + Estado de pago

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 4 — MATERIAL & ALERTAS (Semanas 22–25)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPIC 5 — Material Control (LUM-E005)
├── Sprint 22 →  Catálogo materiales
└── Sprint 23 →  Stock + Consumo + Alertas stock bajo

EPIC 7 — Automated Alerts (LUM-E007)
├── Sprint 24 →  Telegram webhook
└── Sprint 25 →  11 triggers automatizados ⚠️

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 5 — DASHBOARD & POLISH (Semanas 26–30)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPIC 6 — Executive Dashboard (LUM-E006)
├── Sprint 26 →  Gestión destinatarios + KPIs ejecutivos
├── Sprint 27 →  Semáforos + Timeline + Mapa
└── Sprint 28 →  Calendarios + Dashboard colaboradores

TÉCNICO
├── Sprint 29 →  PWA Offline + Optimización
└── Sprint 30 →  UX/UI Polish + UAT
```

---

## 🏃‍♂️ SPRINT PLANNING (1-week sprints)

---

### 🚀 FASE 1 — MVP CORE (Semanas 1–6)
**Objetivo**: Sistema funcional que el cliente puede usar para lo más crítico

---

### SPRINT 1 (Week 1) - Foundation
**Goal**: App corriendo, Supabase conectado, PWA configurado y routing funcional
**Stories**: LUM-001 (5 pts) + LUM-002 (8 pts) + LUM-006 (3 pts) + LUM-007 (3 pts) = **19 pts**
- LUM-001: Setup project infrastructure (React 19 + TypeScript + Vite + Tailwind v4)
- LUM-002: Configure Supabase backend (Auth + PostgreSQL + Storage)
- LUM-006: Setup PWA configuration
- LUM-007: Basic routing and layout structure

**Acceptance Criteria**: Dev server running, Supabase conectado, PWA configurado, routing funcional para los 3 roles

### SPRINT 2 (Week 2) - Authentication & Data Model
**Goal**: Los 3 tipos de usuario autenticados y schema completo desplegado
**Stories**: LUM-003 (5 pts) + LUM-004 (5 pts) + LUM-005 (3 pts) + LUM-008 (8 pts) = **21 pts**
- LUM-003: Admin authentication (email/password)
- LUM-004: Technician PIN authentication
- LUM-005: External contractor authentication
- LUM-008: Work order data model (all fields + work types)

**Acceptance Criteria**: Los 3 usuarios llegan a su dashboard; schema completo desplegado en Supabase

### SPRINT 3 (Week 3) - Work Orders Core
**Goal**: Admin puede crear y asignar órdenes de servicio
**Stories**: LUM-009 (13 pts) + LUM-010 (8 pts) = **21 pts**
- LUM-009: Admin: Create new work orders (all fields, types, validation)
- LUM-010: Admin: Assign work orders to teams and technicians

**Acceptance Criteria**: Admins pueden crear OS con todos los campos y asignarlas a equipos/técnicos

### SPRINT 4 (Week 4) - Work Orders Complete
**Goal**: Edición, vistas y búsqueda de OS para todos los roles
**Stories**: LUM-011 (5 pts) + LUM-012 (5 pts) + LUM-013 (5 pts) + LUM-014 (3 pts) = **18 pts**
- LUM-011: Admin: Edit and update work orders
- LUM-012: Work order list views (admin, technician, contractor)
- LUM-013: Work order detail views with work type-specific fields
- LUM-014: Work order filtering and search

**Acceptance Criteria**: Todos los roles pueden ver, editar, filtrar y buscar sus OS

### SPRINT 5 (Week 5) - State Machine & Execution
**Goal**: Ciclo de vida completo de 14 estados y flujo de ejecución del técnico
**Stories**: LUM-015 (13 pts) + LUM-016 (3 pts) + LUM-017 (3 pts) + LUM-022 (5 pts) = **24 pts**
- LUM-015: Work order state workflow (14 states)
- LUM-016: Technician: Start work order (→ "En progreso")
- LUM-017: Technician: Mark work order as executed
- LUM-022: Validation rules for state transitions

**Acceptance Criteria**: OS progresan correctamente por todos los estados; técnicos pueden iniciar y ejecutar

### SPRINT 6 (Week 6) - Rückmeldungen
**Goal**: Reporte de campo completo con fotos y consumo de material
**Stories**: LUM-018 (13 pts) + LUM-019 (5 pts) + LUM-020 (5 pts) = **23 pts**
- LUM-018: Basic Rückmeldung form (description, photos, materials, times)
- LUM-019: Photo upload functionality (Supabase Storage)
- LUM-020: Material consumption tracking

**Acceptance Criteria**: Técnicos envían Rückmeldungen completas con fotos y material consumido

> ### 🎯 MVP ENTREGADO — Fin Semana 6
> El cliente puede usar el sistema para: autenticarse, gestionar OS completas y enviar Rückmeldungen con fotos.

---

### 📋 FASE 2 — CERTIFICACIÓN (Semanas 7–11)
**Objetivo**: Ciclo completo de certificación interna y hacia el cliente

---

### SPRINT 7 (Week 7) - Certification Queue & Audit
**Goal**: Cola de certificación visible, técnicos ven correcciones, auditoría activa
**Stories**: LUM-021 (5 pts) + LUM-023 (8 pts) + LUM-027 (3 pts) + LUM-028 (3 pts) = **19 pts**
- LUM-021: Work order status dashboard (basic)
- LUM-023: Admin: View pending work orders for internal certification
- LUM-027: Technician: View returned work orders and corrections needed
- LUM-028: Internal certification audit trail

**Acceptance Criteria**: Cola de cert visible al admin; técnicos ven correcciones; audit logging activo

### SPRINT 8 (Week 8) - Certification Review Interface
**Goal**: Vista comparativa completa para revisión de certificación
**Stories**: LUM-024 (13 pts) = **13 pts**
- LUM-024: Admin: Compare assigned vs. reported work details

**Acceptance Criteria**: Admin revisa assigned vs. reported con fotos, materiales y tiempos side-by-side

### SPRINT 9 (Week 9) - Certification Approval & Return
**Goal**: Ciclo completo de certificación interna
**Stories**: LUM-025 (8 pts) + LUM-026 (5 pts) + LUM-029 (2 pts) = **15 pts**
- LUM-025: Admin: Approve internal certification (timestamp + hash)
- LUM-026: Admin: Return work order to technician with comments
- LUM-029: Bulk certification operations

**Acceptance Criteria**: Ciclo completo de certificación interna operativo end-to-end

### SPRINT 10 (Week 10) - Client Certification & PDF
**Goal**: Certificación hacia cliente y generación de PDFs profesionales
**Stories**: LUM-030 (5 pts) + LUM-031 (8 pts) + LUM-032 (5 pts) = **18 pts**
- LUM-030: Admin: View internally certified work orders ready for client
- LUM-031: Generate professional certification PDF (with Nexus logo)
- LUM-032: Client certification batch processing

**Acceptance Criteria**: Admin genera PDFs profesionales y envía lotes al cliente

### SPRINT 11 (Week 11) - Client Cycle Complete
**Goal**: Tracking, rechazo, facturación automática y reportes Excel
**Stories**: LUM-033 (5 pts) + LUM-034 (5 pts) + LUM-035 (5 pts) + LUM-036 (5 pts) = **20 pts**
- LUM-033: Track client certification delivery (email/SharePoint)
- LUM-034: Handle client acceptance/rejection with reasons
- LUM-035: Automatic progression to invoicing upon client acceptance
- LUM-036: Excel consolidation reports by period/project/client

**Acceptance Criteria**: Ciclo completo cliente operativo; OS aceptadas avanzan a facturación; Excel exportable

---

### 👥 FASE 3 — PERSONAL (Semanas 12–21)
**Objetivo**: Gestión completa de empleados propios y colaboradores externos

---

### SPRINT 12 (Week 12) - Employee Profiles
**Goal**: Perfiles completos de empleados alemanes con todos los campos de compliance
**Stories**: LUM-037 (13 pts) = **13 pts**
- LUM-037: Employee profile management (personal data, contract details)

**Acceptance Criteria**: Perfiles completos con Steuer-ID, SV-Nummer, IBAN y datos de contrato

### SPRINT 13 (Week 13) - German Payroll Calculation ⚠️
**Goal**: Cálculo Brutto → Netto con todas las deducciones alemanas
**Stories**: LUM-038 (21 pts) = **21 pts** *(stretch sprint — validar con Steuerberaterin Janet antes de go-live)*
- LUM-038: German payroll calculation (Brutto → Netto with all deductions)

**Acceptance Criteria**: Lohnsteuer, Soli, KV, PV, RV, AV calculados correctamente

### SPRINT 14 (Week 14) - Gehaltsabrechnung PDF
**Goal**: Generación de nómina PDF profesional descargable
**Stories**: LUM-039 (13 pts) = **13 pts**
- LUM-039: Gehaltsabrechnung PDF generation

**Acceptance Criteria**: Empleados descargan nóminas mensuales en PDF conforme a normativa alemana

### SPRINT 15 (Week 15) - Vacation Management
**Goal**: Gestión de vacaciones conforme a BUrlG
**Stories**: LUM-040 (13 pts) = **13 pts**
- LUM-040: Vacation management (Urlaubsverwaltung) - BUrlG compliance

**Acceptance Criteria**: Días de vacaciones gestionados con mínimo 20 días y reglas de traslado

### SPRINT 16 (Week 16) - Vacation Request Workflow
**Goal**: Flujo de solicitud y aprobación de vacaciones
**Stories**: LUM-041 (13 pts) = **13 pts**
- LUM-041: Vacation request/approval workflow

**Acceptance Criteria**: Técnicos solicitan vacaciones; admins aprueban/rechazan con notificaciones

### SPRINT 17 (Week 17) - Sick Leave, Hours & Payroll Reports
**Goal**: Bajas, control de horas y reportes mensuales de nómina
**Stories**: LUM-042 (5 pts) + LUM-043 (5 pts) + LUM-044 (5 pts) = **15 pts**
- LUM-042: Sick leave registration (Krankmeldung)
- LUM-043: Working hours tracking from work orders
- LUM-044: Monthly payroll summary reports

**Acceptance Criteria**: Ausencias y horas tracked; reportes mensuales generados

### SPRINT 18 (Week 18) - Contractor Profiles & Expiry Alerts
**Goal**: Perfiles de colaboradores y sistema de alertas de vencimiento de documentos
**Stories**: LUM-045 (5 pts) + LUM-047 (8 pts) = **13 pts**
- LUM-045: External contractor profile management
- LUM-047: Document expiration alerts (30-day warning)

**Acceptance Criteria**: Perfiles de colaboradores creados; alertas de vencimiento 30 días activas

### SPRINT 19 (Week 19) - Document Upload System
**Goal**: Portal de subida de documentación obligatoria para colaboradores
**Stories**: LUM-046 (13 pts) = **13 pts**
- LUM-046: Required documentation upload system (6 document types)

**Acceptance Criteria**: Colaboradores suben los 6 tipos de documento requeridos con fechas de vencimiento

### SPRINT 20 (Week 20) - Assignment Blocking & Contractor Dashboard
**Goal**: Bloqueo automático de asignación y visibilidad del colaborador
**Stories**: LUM-048 (8 pts) + LUM-049 (5 pts) = **13 pts**
- LUM-048: Automatic work order assignment blocking for expired docs
- LUM-049: Contractor visibility dashboard (assignments, certifications, documents)

**Acceptance Criteria**: Colaboradores sin docs válidos bloqueados; dashboard muestra estado completo

### SPRINT 21 (Week 21) - Document Validation & Payment Status
**Goal**: Validación de documentos por admin y visibilidad de pagos del colaborador
**Stories**: LUM-050 (5 pts) + LUM-051 (5 pts) = **10 pts**
- LUM-050: Document validation and approval workflow
- LUM-051: Contractor payment status visibility

**Acceptance Criteria**: Admin valida docs; colaboradores ven en qué punto está su pago

---

### 📦 FASE 4 — MATERIAL & ALERTAS (Semanas 22–25)
**Objetivo**: Control de inventario por equipo y sistema de alertas automáticas

---

### SPRINT 22 (Week 22) - Material Catalog
**Goal**: Catálogo completo de materiales gestionable
**Stories**: LUM-052 (13 pts) = **13 pts**
- LUM-052: Material catalog with units (m, ud, rollo, caja)

**Acceptance Criteria**: Admin gestiona catálogo completo con unidades y stock mínimo

### SPRINT 23 (Week 23) - Stock & Consumption Tracking
**Goal**: Trazabilidad completa del material desde stock hasta consumo
**Stories**: LUM-053 (5 pts) + LUM-054 (5 pts) + LUM-055 (5 pts) + LUM-056 (5 pts) = **20 pts**
- LUM-053: Stock tracking by team/vehicle
- LUM-054: Material assignment to work orders
- LUM-055: Material consumption reporting in Rückmeldungen
- LUM-056: Low stock alerts (< 20% minimum)

**Acceptance Criteria**: Flujo completo de material tracked; alertas de stock bajo activas

### SPRINT 24 (Week 24) - Telegram Webhook
**Goal**: Integración completa con Telegram para notificaciones
**Stories**: LUM-057 (8 pts) = **8 pts**
- LUM-057: Telegram webhook integration

**Acceptance Criteria**: Bot de Telegram configurado y enviando mensajes formateados por tipo de alerta

### SPRINT 25 (Week 25) - All Alert Triggers ⚠️
**Goal**: Los 11 triggers automatizados configurados y funcionando
**Stories**: LUM-058 (21 pts) = **21 pts** *(stretch sprint — 11 triggers con condiciones, destinatarios y plantillas)*
- LUM-058: Configure all 11 automated alert triggers

**Acceptance Criteria**: Cada evento crítico genera la alerta Telegram correcta con la prioridad correcta

---

### 📊 FASE 5 — DASHBOARD & POLISH (Semanas 26–30)
**Objetivo**: Dashboard ejecutivo completo, PWA offline y sistema listo para producción

---

### SPRINT 26 (Week 26) - Alert Recipients & KPI Dashboard
**Goal**: Gestión de destinatarios y dashboard ejecutivo con 8 KPIs
**Stories**: LUM-059 (5 pts) + LUM-060 (8 pts) = **13 pts**
- LUM-059: Alert recipient management (Jarl, Isabelle, technicians)
- LUM-060: Executive KPI dashboard (8 main metrics)

**Acceptance Criteria**: Alertas enrutadas correctamente; dashboard KPI en vivo con 8 métricas

### SPRINT 27 (Week 27) - Traffic Lights, Timeline & Map
**Goal**: Vistas de estado de proyectos y visión geográfica
**Stories**: LUM-061 (5 pts) + LUM-062 (5 pts) + LUM-063 (5 pts) = **15 pts**
- LUM-061: Project traffic light system (green/yellow/red)
- LUM-062: Weekly timeline view by team
- LUM-063: Map view of work orders by city/zone

**Acceptance Criteria**: Admin tiene visibilidad completa con semáforos, timeline y mapa

### SPRINT 28 (Week 28) - Calendars & Contractor Dashboard
**Goal**: Calendario de ausencias y estado de documentación de colaboradores
**Stories**: LUM-064 (5 pts) + LUM-065 (5 pts) = **10 pts**
- LUM-064: Vacation/absence calendar for admin
- LUM-065: Contractor documentation status dashboard

**Acceptance Criteria**: Calendarios funcionales; dashboard de compliance de colaboradores operativo

### SPRINT 29 (Week 29) - PWA Offline & Performance
**Goal**: App funcional offline para técnicos en campo y optimización general
**Stories**: LUM-066 (5 pts) + LUM-067 (5 pts) = **10 pts**
- LUM-066: PWA offline mode implementation
- LUM-067: Performance optimization (code splitting, caching, image optimization)

**Acceptance Criteria**: App funciona offline; tiempos de carga optimizados

### SPRINT 30 (Week 30) - Final Polish & UAT
**Goal**: Sistema production-ready aprobado por Jarl e Isabelle
**Stories**: LUM-068 (5 pts) + LUM-069 (8 pts) = **13 pts**
- LUM-068: Final UX/UI polish
- LUM-069: User acceptance testing

**Acceptance Criteria**: Sistema aprobado por stakeholders y listo para go-live

---

## 📋 DETAILED USER STORIES

### SPRINT 1 STORIES

#### LUM-001: Setup Project Infrastructure
**As a** Developer  
**I want** to setup the project foundation with React 19 + TypeScript + Vite + Tailwind v4  
**So that** we have a modern, performant development environment  

**Acceptance Criteria**:
- [ ] React 19 project created with Vite
- [ ] TypeScript configured with strict mode
- [ ] Tailwind CSS v4 installed and configured
- [ ] ESLint and Prettier configured
- [ ] Project folder structure established
- [ ] Development server runs successfully

**Story Points**: 5  
**Sprint**: 1  

#### LUM-002: Configure Supabase Backend
**As a** Developer  
**I want** to configure Supabase with Auth, PostgreSQL, and Storage  
**So that** we have a complete backend infrastructure  

**Acceptance Criteria**:
- [ ] Supabase project created
- [ ] Database schema designed for all entities
- [ ] Authentication policies configured
- [ ] Storage buckets created for photos
- [ ] Environment variables configured
- [ ] Database connection tested

**Story Points**: 8  
**Sprint**: 1  

#### LUM-003: Admin Authentication System
**As an** Admin (Jarl/Isabelle)
**I want** to login with email and password
**So that** I can access the admin dashboard securely

**Acceptance Criteria**:
- [ ] Login form with email/password fields
- [ ] Supabase Auth integration
- [ ] Session management
- [ ] Admin role verification
- [ ] Redirect to admin dashboard after login
- [ ] Logout functionality
- [ ] Password reset functionality

**Story Points**: 5
**Sprint**: 2

#### LUM-004: Technician PIN Authentication
**As a** Technician
**I want** to login with my PIN number
**So that** I can quickly access my work orders on mobile devices

**Acceptance Criteria**:
- [ ] PIN input interface (numeric keypad)
- [ ] PIN validation against user database
- [ ] Technician role verification
- [ ] Session management for PIN users
- [ ] Quick logout option
- [ ] PIN-specific security measures

**Story Points**: 5
**Sprint**: 2

#### LUM-005: External Contractor Authentication
**As an** External Contractor
**I want** to login with my credentials
**So that** I can access my assigned work orders and upload documentation

**Acceptance Criteria**:
- [ ] Contractor login interface
- [ ] Credential validation
- [ ] Contractor role verification
- [ ] Access control based on contractor status
- [ ] Document upload access
- [ ] Session management

**Story Points**: 3
**Sprint**: 2

### SPRINT 2 STORIES

#### LUM-008: Work Order Data Model
**As a** Developer  
**I want** to create comprehensive work order database schema  
**So that** all work order types and fields are properly stored  

**Acceptance Criteria**:
- [ ] Work order table with all 13 base fields
- [ ] Work type-specific fields (Soplado, Fusión AP/DP, Alta, etc.)
- [ ] Client table (Insyte, Vancom)
- [ ] Project table (HXT, RSD, WCB, QFF, WRZ, EHR)
- [ ] Team table (Rot, Grün, Blau, Gelb)
- [ ] Material catalog table
- [ ] Foreign key relationships established
- [ ] Database indexes for performance

**Story Points**: 8
**Sprint**: 3

#### LUM-009: Create Work Orders (Admin)
**As an** Admin  
**I want** to create new work orders with all required fields  
**So that** I can assign work to technicians and teams  

**Acceptance Criteria**:
- [ ] Work order creation form with all fields
- [ ] Client dropdown (Insyte/Vancom)
- [ ] Operator dropdown (DGF/GFP/UGG)
- [ ] Project dropdown (HXT, RSD, WCB, QFF, WRZ, EHR)
- [ ] Line selection (NE3/NE4)
- [ ] Work type selection with dynamic fields
- [ ] Address input with German postal code validation
- [ ] Date picker for assigned date
- [ ] Team assignment (Rot/Grün/Blau/Gelb)
- [ ] Technician assignment dropdown
- [ ] Material requirements list
- [ ] Priority selection (Normal/Alta/Urgente)
- [ ] Internal notes field
- [ ] Form validation and error handling
- [ ] Work order saved to database

**Story Points**: 13
**Sprint**: 4

#### LUM-010: Assign Work Orders
**As an** Admin  
**I want** to assign work orders to specific teams and technicians  
**So that** work is distributed efficiently  

**Acceptance Criteria**:
- [ ] Team selection dropdown
- [ ] Technician selection filtered by team
- [ ] Assignment date picker
- [ ] Bulk assignment capability
- [ ] Conflict detection (technician availability)
- [ ] Assignment notifications
- [ ] Assignment audit trail
- [ ] Work order status change to "Asignada"

**Story Points**: 8
**Sprint**: 5

### SPRINT 3 STORIES

#### LUM-015: Work Order State Workflow
**As a** System  
**I want** to implement the complete 14-state workflow  
**So that** work orders progress properly through their lifecycle  

**Acceptance Criteria**:
- [ ] State machine implemented for 14 states
- [ ] Valid state transitions defined
- [ ] State change audit logging
- [ ] Automatic state progressions where applicable
- [ ] State validation rules
- [ ] Visual state indicators in UI
- [ ] State-based permissions

**States**:
1. Creada
2. Asignada
3. En progreso
4. Ejecutada
5. Rückmeldung pendiente
6. Rückmeldung enviada
7. Certificada internamente
8. Enviada al cliente
9. Aceptada por cliente
10. Facturada
11. Pagada
12. Requiere corrección
13. Rechazada por cliente

**Story Points**: 13
**Sprint**: 7

#### LUM-018: Basic Rückmeldung Form
**As a** Technician  
**I want** to report work completion with photos and material usage  
**So that** my work can be certified and invoiced  

**Acceptance Criteria**:
- [ ] Work description text area
- [ ] Photo upload (before/during/after)
- [ ] Material consumed item picker with quantities
- [ ] Leftover material reporting
- [ ] Start/end time pickers
- [ ] Problem encountered field (conditional)
- [ ] Deviation explanation field (conditional)
- [ ] Form validation rules
- [ ] Save draft functionality
- [ ] Submit Rückmeldung
- [ ] Work order status change to "Rückmeldung enviada"

**Story Points**: 13
**Sprint**: 9

### SPRINT 4 STORIES

#### LUM-023: Internal Certification Queue
**As an** Admin  
**I want** to view all work orders pending internal certification  
**So that** I can review and certify completed work  

**Acceptance Criteria**:
- [ ] List of work orders in "Rückmeldung enviada" state
- [ ] Filter by technician, team, project, date
- [ ] Sort by completion date, priority
- [ ] Quick view of work order details
- [ ] Bulk selection capability
- [ ] Search functionality
- [ ] Pagination for large lists

**Story Points**: 8
**Sprint**: 11

#### LUM-024: Certification Review Interface
**As an** Admin  
**I want** to compare assigned work vs. reported results  
**So that** I can verify work quality before certification  

**Acceptance Criteria**:
- [ ] Side-by-side comparison view
- [ ] Assigned work details on left
- [ ] Reported results on right
- [ ] Photo gallery with zoom functionality
- [ ] Material comparison (assigned vs. consumed vs. leftover)
- [ ] Time tracking review
- [ ] Quality validation checklist
- [ ] Comments section for review notes

**Story Points**: 13
**Sprint**: 12

#### LUM-025: Internal Certification Approval
**As an** Admin  
**I want** to approve work for internal certification  
**So that** it can proceed to client certification  

**Acceptance Criteria**:
- [ ] Approve button with confirmation
- [ ] Timestamp recording (ISO format)
- [ ] Admin user ID recording
- [ ] Cryptographic hash generation for audit
- [ ] Certification seal creation
- [ ] Work order status change to "Certificada internamente"
- [ ] Notification to relevant parties
- [ ] Audit trail entry

**Story Points**: 8
**Sprint**: 13

### SPRINT 6 STORIES (German Employee Management)

#### LUM-037: Employee Profile Management
**As an** Admin  
**I want** to manage employee profiles with German compliance data  
**So that** I can track all required information for payroll and legal compliance  

**Acceptance Criteria**:
- [ ] Personal data form (name, address, phone, email)
- [ ] German tax ID (Steuer-ID) field with validation
- [ ] Social security number (SV-Nummer) field
- [ ] Contract type (befristet/unbefristet)
- [ ] Contract start/end dates
- [ ] Weekly contracted hours
- [ ] Tax class (Steuerklasse I-VI)
- [ ] Health insurance type (gesetzlich/privat)
- [ ] Bank details (IBAN) for payroll
- [ ] Profile photo upload
- [ ] Document attachments (contract, certificates)
- [ ] Profile audit trail

**Story Points**: 13
**Sprint**: 17

#### LUM-038: German Payroll Calculation
**As an** Admin  
**I want** to calculate German payroll with all legal deductions  
**So that** employees receive accurate net pay calculations  

**Acceptance Criteria**:
- [ ] Gross salary (Brutto) input field
- [ ] Income tax (Lohnsteuer) calculation by tax class
- [ ] Solidarity surcharge (Solidaritätszuschlag) - 5.5%
- [ ] Health insurance (Krankenversicherung) calculation
- [ ] Pension insurance (Rentenversicherung) calculation
- [ ] Unemployment insurance (Arbeitslosenversicherung) calculation
- [ ] Net salary (Netto) calculation
- [ ] Monthly payroll generation
- [ ] Payroll correction functionality
- [ ] Tax rate updates capability
- [ ] Preview before finalization
- [ ] **IMPORTANT**: Validation required with Steuerberaterin Janet Martinez de Peglow

**Story Points**: 21
**Sprint**: 18

#### LUM-039: Gehaltsabrechnung PDF Generation
**As an** Employee  
**I want** to download my monthly payslip as PDF  
**So that** I have official documentation of my earnings  

**Acceptance Criteria**:
- [ ] Professional German payslip template
- [ ] Company header (HMR Nexus Engineering GmbH)
- [ ] Employee personal data
- [ ] Pay period clearly stated
- [ ] Gross salary breakdown
- [ ] All deductions itemized with amounts
- [ ] Net salary highlighted
- [ ] Year-to-date totals
- [ ] Legal compliance statements
- [ ] Digital signature/watermark
- [ ] PDF download functionality
- [ ] Archive of historical payslips

**Story Points**: 13  
**Sprint**: 6  

#### LUM-040: German Vacation Management (Urlaubsverwaltung)
**As an** Admin  
**I want** to manage employee vacation entitlements per German law  
**So that** vacation tracking complies with BUrlG (minimum 20 days)  

**Acceptance Criteria**:
- [ ] Annual vacation entitlement calculation based on contract
- [ ] Minimum 20 days enforcement (BUrlG compliance)
- [ ] Pro-rata calculation for partial years
- [ ] Vacation days available/used/pending tracking
- [ ] Carryover rules implementation (max 1/3 to next year)
- [ ] Expiration date tracking (March 31 following year)
- [ ] Vacation calendar view
- [ ] Team vacation overlap prevention
- [ ] Holiday calendar integration (German public holidays)
- [ ] Reporting for HR compliance

**Story Points**: 13  
**Sprint**: 6  

#### LUM-041: Vacation Request/Approval Workflow
**As a** Technician  
**I want** to request vacation days through the app  
**So that** I can plan time off efficiently  

**As an** Admin  
**I want** to approve or reject vacation requests  
**So that** I can manage team coverage  

**Acceptance Criteria**:
- [ ] Vacation request form with date range picker
- [ ] Reason field (Urlaub/vacation type)
- [ ] Remaining days display
- [ ] Conflict checking with existing requests
- [ ] Request submission with notification to admin
- [ ] Admin approval/rejection interface
- [ ] Rejection reason requirement
- [ ] Email notifications for status changes
- [ ] Calendar integration for approved requests
- [ ] Request history tracking

**Story Points**: 13  
**Sprint**: 6  

### SPRINT 7 STORIES (External Contractor Management)

#### LUM-046: Required Documentation Upload System
**As an** External Contractor  
**I want** to upload my required business documents  
**So that** I can be eligible for work order assignments  

**Acceptance Criteria**:
- [ ] Document upload interface for 6 required types:
  - [ ] Gewerbeanmeldung (business registration)
  - [ ] Haftpflichtversicherung (liability insurance)
  - [ ] Unbedenklichkeitsbescheinigung Finanzamt (tax clearance)
  - [ ] Unbedenklichkeitsbescheinigung Sozialkasse (SOKA-BAU if applicable)
  - [ ] Valid ID/Passport (Ausweis/Reisepass)
  - [ ] Signed subcontractor agreement (Subunternehmervertrag)
- [ ] File type validation (PDF, JPG, PNG)
- [ ] File size limits
- [ ] Expiration date capture for each document
- [ ] Document status tracking (pending/approved/expired)
- [ ] Replace expired documents functionality
- [ ] Document version history

**Story Points**: 13  
**Sprint**: 7  

#### LUM-047: Document Expiration Alert System
**As an** Admin  
**I want** to receive alerts when contractor documents are expiring  
**So that** I can ensure compliance and prevent work assignment blocks  

**Acceptance Criteria**:
- [ ] Automated daily check for documents expiring in < 30 days
- [ ] Email alert to admin (Jarl) for 30-day warning
- [ ] Telegram alert integration
- [ ] Document expiration dashboard view
- [ ] Contractor notification of pending expiration
- [ ] Escalation alerts for expired documents
- [ ] Bulk expiration report generation
- [ ] Alert frequency configuration (daily/weekly)

**Story Points**: 8  
**Sprint**: 7  

#### LUM-048: Automatic Work Assignment Blocking
**As a** System  
**I want** to prevent work order assignment to contractors with expired documents  
**So that** compliance is maintained automatically  

**Acceptance Criteria**:
- [ ] Document validation before assignment
- [ ] Assignment form contractor filtering (only compliant contractors)
- [ ] Clear visual indication of blocked contractors
- [ ] Block reason display (which documents expired)
- [ ] Override capability for admin (with audit log)
- [ ] Automatic unblocking when documents updated
- [ ] Notification to contractor about block status
- [ ] Assignment attempt logging for blocked contractors

**Story Points**: 8  
**Sprint**: 7  

### SPRINT 8 STORIES (Material Control & Alerts)

#### LUM-052: Material Catalog Management
**As an** Admin  
**I want** to manage a catalog of materials with units  
**So that** I can track inventory accurately  

**Acceptance Criteria**:
- [ ] Material catalog CRUD interface
- [ ] Material categories organization
- [ ] Unit types (m, ud, rollo, caja, kg, etc.)
- [ ] Material codes/SKUs
- [ ] Supplier information
- [ ] Cost tracking per unit
- [ ] Minimum stock levels configuration
- [ ] Active/inactive material status
- [ ] Material search and filtering
- [ ] Bulk import capability

**Story Points**: 13  
**Sprint**: 8  

#### LUM-057: Telegram Webhook Integration
**As a** System  
**I want** to send alerts via Telegram webhook  
**So that** key personnel receive immediate notifications  

**Acceptance Criteria**:
- [ ] Telegram bot setup and configuration
- [ ] Webhook endpoint implementation
- [ ] Message formatting for different alert types
- [ ] Recipient group management
- [ ] Alert priority levels (Baja/Media/Alta/Urgente)
- [ ] Message delivery confirmation
- [ ] Retry mechanism for failed sends
- [ ] Alert frequency limits to prevent spam
- [ ] Admin interface for webhook management

**Story Points**: 8  
**Sprint**: 8  

#### LUM-058: Configure All Automated Alert Triggers
**As a** System  
**I want** to implement all 11 automated alert triggers  
**So that** critical events are communicated immediately  

**Acceptance Criteria**:
All 11 triggers implemented:
- [ ] Work order assigned >1 day without Rückmeldung (Jarl + technician, Media)
- [ ] Work order executed >4h without Rückmeldung (Jarl, Alta)
- [ ] Team material below minimum stock (Jarl, Media)
- [ ] Internally certified work order not sent >24h (Jarl, Media)
- [ ] Project deadline <48h (Jarl + Isabelle, Alta)
- [ ] Work order rejected by client (Jarl, Urgente)
- [ ] Contractor document expires <30 days (Jarl, Media)
- [ ] Contractor document expired (Jarl, Urgente + blocking)
- [ ] Pending vacation request from technician (Jarl, Baja)
- [ ] Employee contract expires <60 days (Jarl, Media)

Each trigger includes:
- [ ] Condition monitoring
- [ ] Recipient targeting
- [ ] Priority level assignment
- [ ] Message template
- [ ] Frequency control

**Story Points**: 21  
**Sprint**: 8  

---

## ⚡ TECHNICAL TASKS & SUBTASKS

### Infrastructure Setup
- **Task**: Project initialization
  - Subtask: Create React 19 + Vite project
  - Subtask: Configure TypeScript strict mode
  - Subtask: Setup Tailwind CSS v4
  - Subtask: Configure ESLint + Prettier
  - Subtask: Setup folder structure

- **Task**: Supabase Configuration
  - Subtask: Create Supabase project
  - Subtask: Design database schema
  - Subtask: Setup authentication policies
  - Subtask: Configure storage buckets
  - Subtask: Environment variable setup

### Database Schema Design
```sql
-- Core Tables
- users (admin, technicians, contractors)
- work_orders (main work order entity)
- work_order_types (Soplado, Fusión, etc.)
- clients (Insyte, Vancom)
- projects (HXT, RSD, WCB, QFF, WRZ, EHR)
- teams (Rot, Grün, Blau, Gelb)
- materials (catalog)
- work_order_materials (assignments)
- ruckmeldungen (field reports)
- certifications (internal + external)
- employee_profiles
- contractor_profiles
- contractor_documents
- material_inventory
- alerts_log
```

### Security & Compliance
- **Task**: Authentication & Authorization
  - Subtask: Row-level security policies
  - Subtask: Role-based access control
  - Subtask: PIN authentication for technicians
  - Subtask: Session management

- **Task**: German Compliance
  - Subtask: GDPR compliance measures
  - Subtask: German payroll tax calculations
  - Subtask: Document retention policies
  - Subtask: Audit trail implementation

### Performance & PWA
- **Task**: Progressive Web App
  - Subtask: Service worker implementation
  - Subtask: Offline data synchronization
  - Subtask: App manifest configuration
  - Subtask: Push notifications setup

- **Task**: Performance Optimization
  - Subtask: Code splitting implementation
  - Subtask: Image optimization
  - Subtask: Database query optimization
  - Subtask: Caching strategy

---

## 📊 STORY POINT ESTIMATION

**Total Estimated Points**: 423 points

**Fase 1 — MVP Core (Semanas 1–6)**: 126 pts
- Sprint 1: 19 pts (Foundation)
- Sprint 2: 21 pts (Auth + DB Schema)
- Sprint 3: 21 pts (Work Orders Core)
- Sprint 4: 18 pts (Work Orders Complete)
- Sprint 5: 24 pts (State Machine + Execution)
- Sprint 6: 23 pts (Rückmeldungen)

**Fase 2 — Certificación (Semanas 7–11)**: 85 pts
- Sprint 7: 19 pts (Cert Queue + Audit)
- Sprint 8: 13 pts (Cert Review Interface)
- Sprint 9: 15 pts (Cert Approval + Return)
- Sprint 10: 18 pts (Client Cert + PDF)
- Sprint 11: 20 pts (Client Cycle Complete)

**Fase 3 — Personal (Semanas 12–21)**: 127 pts
- Sprint 12: 13 pts (Employee Profiles)
- Sprint 13: 21 pts (German Payroll) ⚠️
- Sprint 14: 13 pts (Gehaltsabrechnung PDF)
- Sprint 15: 13 pts (Vacation Management)
- Sprint 16: 13 pts (Vacation Workflow)
- Sprint 17: 15 pts (Sick Leave + Hours)
- Sprint 18: 13 pts (Contractor Profiles + Expiry)
- Sprint 19: 13 pts (Document Upload)
- Sprint 20: 13 pts (Blocking + Dashboard)
- Sprint 21: 10 pts (Doc Validation + Payment)

**Fase 4 — Material & Alertas (Semanas 22–25)**: 62 pts
- Sprint 22: 13 pts (Material Catalog)
- Sprint 23: 20 pts (Stock + Consumption + Low Stock)
- Sprint 24: 8 pts (Telegram Webhook)
- Sprint 25: 21 pts (All Alert Triggers) ⚠️

**Fase 5 — Dashboard & Polish (Semanas 26–30)**: 61 pts
- Sprint 26: 13 pts (Recipients + KPI Dashboard)
- Sprint 27: 15 pts (Traffic Lights + Timeline + Map)
- Sprint 28: 10 pts (Calendars + Contractor Dashboard)
- Sprint 29: 10 pts (PWA Offline + Performance)
- Sprint 30: 13 pts (Polish + UAT)

**Velocity Assumption**: 13-21 points per sprint

---

## 🎯 DEFINITION OF DONE

### User Story Level
- [ ] Acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] UI/UX approved by Product Owner
- [ ] German compliance verified (where applicable)
- [ ] Mobile responsive (PWA requirements)
- [ ] Accessibility standards met
- [ ] Documentation updated

### Sprint Level
- [ ] Sprint goal achieved
- [ ] All story points completed
- [ ] Demo prepared and delivered
- [ ] Sprint retrospective completed
- [ ] Backlog refined for next sprint

### Release Level
- [ ] All features tested in staging environment
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Stakeholder acceptance (Jarl, Isabelle)
- [ ] German tax consultant validation (payroll module)
- [ ] Deployment to production
- [ ] User training completed
- [ ] Go-live support plan executed

---

## 🔄 SCRUM CEREMONIES

### Sprint Planning (2 hours every week)
- Review product backlog
- Select stories for sprint
- Break down stories into tasks
- Estimate story points
- Define sprint goal

### Daily Standups (15 minutes daily)
- What did you complete yesterday?
- What will you work on today?
- Any blockers or impediments?

### Sprint Review (1 hour every week)
- Demo completed features
- Gather stakeholder feedback
- Update product backlog based on feedback

### Sprint Retrospective (45 minutes every week)
- What went well?
- What could be improved?
- Action items for next sprint

### Backlog Refinement (1 hour weekly)
- Review upcoming stories
- Break down epics into stories
- Estimate story points
- Clarify requirements

---

## 🚨 RISKS & MITIGATION

### Technical Risks
- **Risk**: German payroll calculation complexity
  - **Mitigation**: Early validation with Steuerberaterin Janet
  - **Mitigation**: Implement in phases with validation checkpoints

- **Risk**: Supabase performance with large datasets
  - **Mitigation**: Database optimization from day 1
  - **Mitigation**: Performance monitoring and caching strategy

- **Risk**: PWA offline functionality complexity
  - **Mitigation**: Implement offline features incrementally
  - **Mitigation**: Test on multiple devices and networks

### Business Risks
- **Risk**: Changing German regulatory requirements
  - **Mitigation**: Regular compliance reviews
  - **Mitigation**: Flexible architecture for rule changes

- **Risk**: Client certification process changes (Vancom, Insyte)
  - **Mitigation**: Regular stakeholder communication
  - **Mitigation**: Configurable certification workflows

### Team Risks
- **Risk**: Team member unavailability
  - **Mitigation**: Knowledge sharing sessions
  - **Mitigation**: Documentation of critical processes

---

## 📈 SUCCESS METRICS

### Development Metrics
- Sprint velocity consistency (±15%)
- Story point completion rate (>90%)
- Bug rate (<5% of story points)
- Code review turnaround (<24 hours)

### Business Metrics
- Work order processing time reduction (target: 50%)
- Rückmeldung completion rate increase (target: >95%)
- Client certification turnaround (target: <48 hours)
- German compliance audit score (target: 100%)
- User adoption rate (target: >90% within 4 weeks)

---

## 🎉 READY FOR JIRA IMPORT

This comprehensive Scrum plan is ready to be imported into Jira with:
- ✅ Complete epic structure (7 epics)
- ✅ Detailed user stories with acceptance criteria (69+ stories)
- ✅ Story point estimates (423 total points)
- ✅ Sprint planning (30 sprints — 5 phases)
- ✅ MVP deliverable at Week 6
- ✅ Technical tasks and subtasks
- ✅ German compliance requirements
- ✅ Risk mitigation strategies
- ✅ Success metrics definition

**Next Steps**:
1. Import epics into Jira
2. Create user stories with acceptance criteria
3. Assign story points and sprint allocation
4. Setup Jira board with proper workflows
5. Begin Sprint 1

**Project Timeline**:
- Start: March 25, 2026
- MVP Go-Live: May 6, 2026 (Week 6)
- Full Platform Go-Live: October 21, 2026 (Week 30)