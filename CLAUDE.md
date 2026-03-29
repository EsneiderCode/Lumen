# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LUMEN is a central operational platform for HMR Nexus Engineering GmbH, designed to unify work order management, dual certification processes (internal and client-facing), and personnel management for both internal employees and external collaborators in the German fiber optic (Glasfaser) infrastructure industry.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 (PWA)
- **Backend/Database**: Supabase (Auth + PostgreSQL + Realtime + Storage)  
- **Deployment**: Vercel
- **Notifications**: OpenClaw / Telegram webhook
- **PDF Generation**: jsPDF + react-pdf
- **Excel Exports**: SheetJS (xlsx)
- **Photo Storage**: Supabase Storage
- **Authentication**: PIN-based for technicians, email/password for admin

## Architecture Overview

The system is built around 7 core modules:

1. **Service Orders (Órdenes de Servicio)** - Complete work order lifecycle management
2. **Field Reports (Rückmeldungen)** - Technician progress and completion reporting
3. **Dual Certification** - Internal certification (Nexus) → External certification (Client)
4. **Personnel Management** - German employees (payroll, vacations) + external contractors (documentation)
5. **Material Control** - Inventory tracking by team/vehicle
6. **Executive Dashboard** - KPIs, project status, team performance
7. **Automated Alerts** - Telegram notifications for critical events

## Development Commands

*Note: This is a new project. Once the codebase is initialized, update this section with:*
- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run test` - Run test suite
- `npm run lint` - Lint code
- `npm run typecheck` - TypeScript type checking

## Key Business Logic

### Work Order States Flow
```
Created → Assigned → In Progress → Executed → Rückmeldung Pending → 
Rückmeldung Sent → Internally Certified → Sent to Client → 
Client Accepted → Invoiced → Paid
```

### Critical Business Rules
- No complete Rückmeldung → cannot certify internally
- No internal certification → cannot send to client  
- No client acceptance → cannot invoice
- External contractor with incomplete/expired documentation → **assignment blocked**

### Work Types and Required Data
- **Soplado (NE3/NE4)**: meters, section, tube diameter, result, photos
- **Fusión AP/DP**: splice count, fiber type, fusion losses (dB), measurement certificate
- **Alta/Installation**: address, access type, equipment installed, before/after photos, client signature
- **NT Installation**: NT type, serial, location, configuration
- **Patchkabel**: connected section, cable length, connector type, test result

## Client Context

- **Primary Clients**: Insyte Deutschland, Vancom IT
- **Field Teams**: Rot, Grün, Blau, Gelb (Red, Green, Blue, Yellow)
- **Projects**: HXT, RSD, WCB, QFF, WRZ, EHR
- **Operators**: DGF, GFP, UGG
- **Lines**: NE3 / NE4

## German Compliance Requirements

### Employee Management (German Law)
- **Payroll (Gehaltsabrechnung)**: Lohnsteuer + Solidaritätszuschlag + health insurance + pension + unemployment
- **Vacation (Urlaubsverwaltung)**: Minimum 20 days per BUrlG
- **Tax Classes (Steuerklasse)**: I-VI classification
- **Social Security Numbers (SV-Nummer)** and Tax IDs (Steuer-ID) required

### External Contractor Documentation
- Gewerbeanmeldung (business registration)
- Haftpflichtversicherung (liability insurance) 
- Unbedenklichkeitsbescheinigung from Finanzamt and Sozialkasse
- Valid ID/passport
- Signed subcontractor agreement
- Auto-alerts for documents expiring <30 days
- **Auto-block** for expired/missing documentation

## Development Phases

**Phase 1 - MVP Core (3 weeks)**
- Authentication system (admin, technician PIN, external contractor)
- Complete CRUD for service orders
- Full state workflow
- Basic field reporting with photos
- Basic dashboard

**Phase 2 - Certification (2 weeks)**  
- Internal certification workflow
- Client certification process
- PDF certificate generation
- Client delivery tracking

**Phase 3 - Personnel (2 weeks)**
- Employee management (payroll, vacations)
- External contractor management with document validation
- Expiration alerts

**Phase 4 - Material & Alerts (1 week)**
- Inventory control by team
- Telegram alert system

**Phase 5 - Reporting & Polish (1 week)**
- Complete executive dashboard
- Excel exports
- PDF payroll statements
- PWA offline capabilities

## Important Notes

- **Tax consultant validation required**: Janet Martinez de Peglow must validate payroll calculations before HR module goes live
- **Client transparency requirement**: Vancom demands full Rückmeldung transparency - this system addresses that exact need
- **Offline capability**: PWA must work offline for field technicians
- **German language**: UI should support German terminology (Rückmeldung, Gehaltsabrechnung, etc.)