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

## Design System — Nothing Design System (Normative)

> Source: [nothing-design-skill](https://github.com/dominikmartn/nothing-design-skill)
> Philosophy: **"Subtract, don't add. Every element must earn its pixel."**

All new UI MUST follow this system. All tokens live in `src/index.css @theme`.

### Fonts
| Token | Family | Use |
|---|---|---|
| `font-sans` | Space Grotesk 300/400/500/700 | Body, UI text, labels, inputs |
| `font-display` | Doto 400/700 | Display, hero headings, page titles |
| `font-mono` | Space Mono 400/700 | Data labels, numeric values, small caps |

### Color Tokens (`gf-*` prefix)
| Token | Value | Use |
|---|---|---|
| `gf-base` | #000000 | Absolute black |
| `gf-surface` | #111111 | Page / app background |
| `gf-base-light` | #1A1A1A | Sidebars, raised panels |
| `gf-card` | #1A1A1A | Card / modal background |
| `gf-border` | #333333 | Visible border |
| `gf-text` | #E8E8E8 | Primary text |
| `gf-text-muted` | #999999 | Secondary / supporting |
| `gf-text-inverse` | #FFFFFF | Display / max contrast |
| `gf-text-label` | #999999 | Metadata, nav labels |
| `gf-text-placeholder` | #666666 | Disabled / placeholder |
| `gf-primary` | #5B9BF6 | Interactive (buttons, links, focus) |
| `gf-accent` | #D71921 | **Interrupt signal only** — urgent/critical UI |
| `gf-accent-light` | rgba(215,25,33,0.15) | Red subtle backgrounds |
| `gf-success` | #4A9E5C | Positive / confirmed status |
| `gf-danger` | #D71921 | Error / destructive actions |
| `gf-warning` | #D4A843 | Caution |

### Border Radius (Nothing: sharp or pill, max 16px on cards)
| Token | Value | Use |
|---|---|---|
| `rounded-full` | 9999px | Badges, status pills, team dots |
| `rounded-gf-btn` | 0px | Buttons, inputs — sharp mechanical style |
| `rounded-gf-card` | 12px | Cards, panels, alerts, modals |
| `rounded-gf-card-lg` | 16px | Large cards (system maximum) |

**No `rounded-lg`, `rounded-xl`, `rounded-2xl`. Never exceed 16px on cards.**

### Shadows
Nothing system: **NO shadows.** Use `border border-gf-border` instead.
`shadow-gf-sm`, `shadow-gf-md`, `shadow-gf-modal` resolve to `none`.

### Background
- All layout pages use `.nexus-bg` — flat `background-color: var(--color-gf-surface)` (no gradients)
- **No gradients anywhere** — anti-pattern in Nothing system

### Transitions
- Micro interactions: `150–250ms cubic-bezier(0.25, 0.1, 0.25, 1)`
- Page fades: `150ms` — use `.page-fade-in` on `<Outlet>` wrappers
- Interactive cards: `.card-lift` → `translateY(-1px)` at 200ms

### Hard Rules — Never Violate
- No hardcoded hex values in components — always `var(--color-gf-*)` or Tailwind `gf-*` utilities
- No generic Tailwind colors (`bg-gray-50`, `text-gray-900`, `bg-blue-500`)
- No gradients
- No `box-shadow` (except `shadow-gf-*` tokens which resolve to `none`)
- No blur or backdrop-filter effects
- No skeleton loaders (use `[LOADING]` text or hardware-style spinner)
- No toast notifications
- No filled icons (use outline/stroke icons only — 1.5px monoline, 24×24px)
- No parallax
- No border-radius > 16px on cards
- No zebra striping in tables
- Max 2 font families per screen
- Max 3 font sizes per screen
- Red (`gf-accent`) ONLY for urgent/critical interrupt signals — not for branding

### Spacing
Tailwind 4px base scale only: `p-1`(4px), `p-2`(8px), `p-3`(12px), `p-4`(16px), etc.
No arbitrary values like `p-[18px]`.

---

## Important Notes

- **Tax consultant validation required**: Janet Martinez de Peglow must validate payroll calculations before HR module goes live
- **Client transparency requirement**: Vancom demands full Rückmeldung transparency - this system addresses that exact need
- **Offline capability**: PWA must work offline for field technicians
- **German language**: UI should support German terminology (Rückmeldung, Gehaltsabrechnung, etc.)