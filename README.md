# Lumen

Operational platform for HMR Nexus Engineering GmbH — fiber-optic work-order management, dual certification, billing pipeline, technician field reports.

React 19 + TypeScript + Vite + Tailwind v4 · Supabase (Postgres + Auth + Storage) · Vercel.

---

## Quick start

```bash
git clone <this repo>
cd Lumen-esneider
npm install
```

### Two ways to run

| Mode | Command | When to use |
|---|---|---|
| **Demo** (no credentials) | `npm run dev:demo` | First-time exploration, screen reviews, UI work that doesn't need a real backend |
| **Real backend** | `npm run dev` | Connect to the actual Supabase. Requires `.env.development` with the project URL + anon key — ask Alejandro |

Open `http://localhost:5173`.

---

## Demo mode

`npm run dev:demo` starts the app against an in-memory mock backed by localStorage. No Supabase, no credentials, no Docker.

**Seeded login** (password is `demo123` for all):
- `admin@demo.lumen` — Admin, full access
- `tech@demo.lumen` — Technician (team Rot)
- `contractor@demo.lumen` — Contractor (read-only)

**What's seeded** (`src/lib/demo/fixtures.ts`):
- 6 work orders covering the full pipeline — `created`, `in_progress`, `rueckmeldung_sent`, `internally_certified` (direct), `paid`, `client_rejected`
- Insyte + Vancom + 1 direct (no client) order
- Service-items catalog with 5 sample rates
- Photos as placeholder URLs
- Certification audits, state history, billing lines

**Reset state**:
```js
localStorage.removeItem('lumen-demo-store-v1')
// then reload
```

**Limits**: the mock implements only what the app currently calls. If you add a new chain method or RPC, extend `src/lib/demo/supabase-mock.ts`.

---

## Working on Lumen — git flow

This repo lives across three remotes:

- **`upstream`** → `EsneiderCode/Lumen` (Alejandro, source of truth)
- **`origin`** → `HMR-Nexus/Lumen` (organization mirror)
- **`fork`** → `jarl9801/Lumen` (personal fork — push branches here)

PRs always target `upstream/develop`. Alejandro merges `develop → main`.

### Per-feature flow

```bash
# 1. Pre-flight (validates remotes, syncs main, prunes zombies, creates branch)
npm run feature:start feat/your-thing

# 2. Code, test, commit

# 3. Pre-PR validation (rebase, tests, typecheck, migration sanity)
npm run feature:check

# 4. Push to your fork
git push -u fork feat/your-thing

# 5. Open cross-fork PR
gh pr create --repo EsneiderCode/Lumen --base develop --head jarl9801:feat/your-thing
```

Convenciones:
- Branches: `feat|fix|chore|docs|refactor|test/<kebab-case>`
- Commits: conventional, **no** `Co-Authored-By` lines
- Migrations: number must be unique vs `upstream/develop`. New migrations MUST declare `Depends on:` in the header.

---

## Standards

- **Design system**: NEXUS.OS pure from `/Users/jarl/Desktop/📦 Archives/Nexus.zip`. No generic Tailwind colors, shadows, blur, gradients, `rounded-xl+`, or solid semantic status buttons.
- **State machine**: never write to `work_orders.status` directly. Always go through `transitionWorkOrderStatus()` in `src/services/workOrderService.ts`. The SQL trigger `validate_work_order_status_transition()` in `rls_policies.sql` enforces the same — keep both in sync.
- **DB writes from this machine**: never apply migrations directly. Ship `.sql`, Alejandro applies in his Supabase, regenerates `src/types/database.types.ts`, ships in his merge.

---

## Repository layout

```
src/
  components/     # UI components (layout, ui kit, NEXUS.OS components)
  pages/          # admin/technician/contractor/auth screens
  services/       # business logic + Supabase calls
  lib/
    supabase.ts   # client factory — switches to mock when VITE_DEMO=true
    demo/         # fixtures + in-memory store + Supabase mock for demo mode
  types/          # database.types.ts + enums + work-type interfaces
  __tests__/      # vitest suite
supabase/
  migrations/     # numbered .sql files — apply in order
  rls_policies.sql # RLS + state-machine trigger (idempotent, re-runnable)
scripts/
  start-feature.sh    # pre-flight before new work
  check-pr-ready.sh   # pre-PR validation
.github/
  pull_request_template.md
```

See `CLAUDE.md` for the full Claude Code playbook + business rules.
