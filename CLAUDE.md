# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LUMEN is a central operational platform for HMR Nexus Engineering GmbH, designed to unify work order management, dual certification processes (internal and client-facing), and personnel management for both internal employees and external collaborators in the German fiber optic (Glasfaser) infrastructure industry.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 (PWA)
- **Backend/Database**: Supabase (Auth + PostgreSQL + Realtime + Storage)  
- **Deployment**: Vercel
- **Notifications**: OpenClaw / Telegram webhook
- **PDF Generation**: jsPDF
- **Excel Exports**: ExcelJS
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

- `npm run dev` — start dev server against real Supabase (needs `.env.development`)
- `npm run dev:demo` — start dev server in demo mode (no credentials, fixtures from `src/lib/demo/fixtures.ts`)
- `npm run build` — production build
- `npm test` — run vitest suite
- `npm run test:watch` — run vitest in watch mode
- `npm run test:coverage` — run vitest with coverage report
- `npm run typecheck` — `tsc -b` (project references mode)
- `npm run lint` / `npm run format`
- `npm run preflight` — run typecheck, lint, and test
- `npm run pre-pr` — run preflight and build
- `npm run basemap:build` — rebuild and publish the self-hosted map basemap (see `scripts/build-basemap.sh`)
- `npm run feature:start <branch>` — create a feature branch from `upstream/develop` with full pre-flight (see `scripts/start-feature.sh`)
- `npm run feature:check` — pre-PR validation (see `scripts/check-pr-ready.sh`)

## Working with the repository

### Who is who

**Alejandro (EsneiderCode)** is the repository owner with full push access to `origin` (`EsneiderCode/Lumen`). He works directly on `develop` and merges to `main` at his discretion. When Claude Code is running on **Alejandro's machine**, it may commit directly to `develop` and push to both `origin/develop` and `origin/main` upon request — no PR required.

**Jarl (jarl9801)** works on a personal fork and submits PRs targeting `origin/develop`.

### Remote topology (Alejandro's machine)

| Remote | URL | Role |
|---|---|---|
| `origin` | `EsneiderCode/Lumen` | **Source of truth.** Direct push access. Has `main` and `develop`. |
| `jarl`   | `jarl9801/Lumen`     | Jarl's personal fork. Receives feature branches via cross-fork PRs. |

### Flow — Alejandro (this machine)

1. Work directly on `develop` (or a feature branch if preferred).
2. Commit with conventional commits — NO `Co-Authored-By` lines.
3. Push to `origin/develop`.
4. When ready to release: merge `develop → main` locally and push `origin/main`.

### Flow — Jarl (fork)

1. **`npm run feature:start feat/<thing>`** — creates branch from `origin/develop`.
2. Make the change. Add tests. Update specs.
3. **`npm run feature:check`** — pre-PR validation.
4. `git push -u jarl feat/<thing>`
5. `gh pr create --repo EsneiderCode/Lumen --base develop --head jarl9801:feat/<thing>`

### Hard rules

- **Migrations**: numbered sequentially. Always check `git ls-tree origin/develop supabase/migrations/` before picking a number. New migrations MUST declare `Depends on:` in their header.
- **Supabase apply**: Alejandro applies migrations in his Supabase project. Only ship the `.sql`.
- **`database.types.ts`**: regenerated after applying the migration. Do not edit by hand.
- **Branches**: `feat/* | fix/* | chore/* | docs/* | refactor/* | test/*` + kebab-case.
- **Commits**: conventional commits, NO `Co-Authored-By` lines.

## Demo mode (offline / no credentials)

Run with `npm run dev:demo`. The Supabase client is replaced by an in-memory mock backed by localStorage. Seeded fixtures (3 users, 6 work orders across all states including a direct order, full state history, photos, certs) live in `src/lib/demo/fixtures.ts`.

- **Login**: any seeded email + password `demo123`. Three accounts: `admin@demo.lumen`, `tech@demo.lumen`, `contractor@demo.lumen`.
- **Reset state**: `localStorage.removeItem('lumen-demo-store-v1')` then reload, OR delete and reseed by reloading after clearing.
- **Photos**: served as placeholder URLs (https://placehold.co/...). No real Storage round-trips.
- **Limits**: the mock implements only what the existing app uses. If a query returns weird empty data, check `src/lib/demo/supabase-mock.ts` — extend the chain method or filter handling there.

When adding a new feature that touches Supabase, **also extend the demo store** (fixtures + any new chain method) so Jarl can demo it without credentials. Mark the PR template's "Demo-mode coverage" checkbox.

## Map basemap (self-hosted)

The trench map does **not** use a third-party tile service. The basemap is a
single PMTiles archive in the public `basemap` bucket of our own Supabase
project, built by `npm run basemap:build`.

- **Adding a work area**: add a bbox to `ZONES` in `scripts/build-basemap.sh`
  and re-run it. Roßdorf + Höxter together are 6.1 MB; never ship all of Germany.
- **Schema**: the style in `src/lib/mapStyle.ts` is written against the
  **Protomaps basemaps v4** schema (`roads`/`kind`), not OpenMapTiles
  (`transportation`/`class`). Pointing `VITE_MAP_TILES_URL` at an OpenMapTiles
  endpoint renders a blank map until that file is remapped.
- **Never let a tile failure be silent.** A basemap that does not load is
  indistinguishable from an empty field: `NexusMap` listens on `map.on('error')`
  and shows `[KARTE OFFLINE]` over the pins. That listener is the whole reason
  the failure is diagnosable.

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

- **Primary Clients**: Insyte Deutschland, Vancom IT, FNS Infrastruktur
- **Field Teams** (12): Rot, Grün, Blau, Gelb, Weiß, Grau, Braun, Violett, Türkis, Schwarz, Orange, Rosa
- **Projects**: HXT, RSD, WCB, QFF, WRZ, EHR
- **Operators**: DGF, GFP, UGG, Telekom
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

## Design System — NEXUS Brand System (Normative)

All new UI MUST follow the NEXUS Brand System. All tokens live in `src/index.css @theme`.

### Color Tokens

**Surface Scale (dark-first)**
| Token | Value | Use |
|---|---|---|
| `--color-bg-0` | #07080A | Page / app background |
| `--color-bg-1` | #0E1014 | Cards, modals, sidebars, panels |
| `--color-bg-2` | #161920 | Hover, raised secondary |
| `--color-bg-3` | #1D2029 | Highlighted / pressed |
| `--color-bg-4` | #262A34 | Selected / strong contrast surface |

**Foreground Scale**
| Token | Value | Use |
|---|---|---|
| `--color-fg-1` | #F5F3EE | Primary text |
| `--color-fg-2` | #B9BAB4 | Secondary |
| `--color-fg-3` | #7B7D7A | Tertiary, labels, metadata |
| `--color-fg-4` | #4A4C50 | Disabled, placeholder |

**Lines / Borders**
| Token | Value |
|---|---|
| `--color-line` | #222630 |
| `--color-line-s` | #2E3440 (emphasized border) |

**Semantic Colors**
| Token | Value | Use |
|---|---|---|
| `--color-accent` | #FF4D2E | Interactive, focus, interrupt signal |
| `--color-ok` | #4ADE80 | Success / positive status |
| `--color-warn` | #FFB020 | Caution / warning |
| `--color-info` | #6BA6FF | Informational |

**Print Metaphor**
| Token | Value |
|---|---|
| `--color-paper` | #F5F3EE |
| `--color-ink` | #0A0B0D |

**Team Colors** (12 teams)
| Token | Value |
|---|---|
| `--color-team-rot` | #ef4444 |
| `--color-team-gruen` | #22c55e |
| `--color-team-blau` | #6BA6FF |
| `--color-team-gelb` | #eab308 |
| `--color-team-weiss` | var(--color-paper) |
| `--color-team-grau` | #9ca3af |
| `--color-team-braun` | #b45309 |
| `--color-team-violett` | #a855f7 |
| `--color-team-tuerkis` | #2dd4bf |
| `--color-team-schwarz` | #52525b (visible-on-dark "black") |
| `--color-team-orange` | #f97316 |
| `--color-team-rosa` | #ec4899 |

### Typography

| Family | Weights | Use |
|---|---|---|
| Space Grotesk | 300/400/500/700 | Display, hero, page titles (h1–h3) |
| Inter | 400/500/600 | Body, UI, labels, inputs |
| JetBrains Mono | 400/500 | Data, numbers, micro-labels |

### Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius-s` | 4px | Small UI elements |
| `--radius-m` | 6px | Buttons, inputs, badges |
| `--radius-l` | 10px | Cards, panels, modals |

### Transition Standards

- Micro interactions: `150–250ms cubic-bezier(0.25, 0.1, 0.25, 1)`
- Page entry: use `.page-fade-in` (150ms)
- Interactive cards: `.card-lift` → `translateY(-1px)` at 200ms

### Hard Rules — Never Violate

- No hardcoded hex values in components — always use CSS custom properties
- No generic Tailwind colors
- No gradients
- No `box-shadow`
- No blur or backdrop-filter effects
- No skeleton loaders (use `[LOADING]` text)
- No toast notifications
- No filled icons (outline/stroke only — 1.5px monoline, 24×24px)
- No parallax
- No zebra striping in tables
- Max 2 font families per screen
- Max 3 font sizes per screen

## Environment Setup

- `npm run dev` requires `.env.development` — copy `.env.example` and fill in
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Demo mode uses `.env.demo` (`VITE_DEMO=true`) — no credentials needed.
  Detection lives in `src/lib/supabase.ts`.

## Testing

- Tests are centralized in `src/__tests__/*.test.ts` (Vitest), focused on
  services and business logic — not component rendering.

## i18n

- UI strings go through i18next — never hardcode user-facing text.
- Translations live in `src/i18n/locales/` (`de.json`, `es.json`); shared
  label maps in `src/i18n/labels.ts`.

---

## Important Notes

- **Tax consultant validation required**: Janet Martinez de Peglow must validate payroll calculations before HR module goes live
- **Client transparency requirement**: Vancom demands full Rückmeldung transparency - this system addresses that exact need
- **Offline capability**: PWA must work offline for field technicians
- **German language**: UI should support German terminology (Rückmeldung, Gehaltsabrechnung, etc.)
