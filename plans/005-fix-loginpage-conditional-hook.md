# Plan 005: Fix the conditional hook in LoginPage so `npm run lint` (and preflight) pass again

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 020ff8a..HEAD -- src/pages/auth/LoginPage.tsx`
> plus `git status --short src/pages/auth/LoginPage.tsx` (must be unmodified).
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code; on a mismatch, STOP.

## Status

- **Priority**: P1 (blocks `npm run preflight` for EVERY branch in the repo)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `020ff8a`, 2026-06-11 (note: the working tree may carry
  unrelated uncommitted changes from plan 002 — LoginPage.tsx is NOT among them)

## Why this matters

`src/pages/auth/LoginPage.tsx` returns early (`if (user) return <Navigate/>`)
BEFORE a `useEffect` is declared. React hooks must run unconditionally in the
same order on every render, so eslint's `react-hooks/rules-of-hooks` reports an
ERROR (not a warning) at line 73. Because `npm run lint` is part of
`npm run preflight` and `npm run pre-pr`, every branch in this repo currently
fails its quality gates for a reason unrelated to its own changes (this blocked
plan 002's done criteria, for example). One small move fixes the repo-wide gate.

## Current state

Repo: `/Users/jarl/Dev/Lumen-esneider` — React 19 + TypeScript + Vite. The file
came from the upstream sync (commit `a9e499a`, "feat(login): support keyboard
input for team PIN entry").

`src/pages/auth/LoginPage.tsx` (at commit `020ff8a`):

```tsx
// lines 58-60 — the early return, ABOVE the hook:
  if (user) {
    return <Navigate to={ROLE_ROUTES[user.role]} replace />
  }
  // ... switchMode const ...
// lines 72-82 — the hook that becomes conditional:
  // ── Keyboard input for PIN ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'pin' || pinStep !== 'enter' || loadingTeam) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) handleNumpad(e.key)
      else if (e.key === 'Backspace') handleNumpad('⌫')
      else if (e.key === 'Enter' && pin.length === 6) void handlePinSubmit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, pinStep, pin, loadingTeam])
```

Lint evidence: `npm run lint` →
`src/pages/auth/LoginPage.tsx 73:3 error React Hook "useEffect" is called conditionally ... react-hooks/rules-of-hooks`
(plus 5 unrelated warnings elsewhere in the repo — those are OUT of scope).

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Lint      | `npm run lint`       | exit 0 — **0 errors** (warnings may remain) |
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm test`           | all pass            |

## Scope

**In scope**:
- `src/pages/auth/LoginPage.tsx` — ONLY moving the early-return guard.

**Out of scope** (do NOT touch):
- The 5 `react-hooks/exhaustive-deps` WARNINGS elsewhere (and any deps-array
  tuning in this same effect) — warnings don't block the gate; changing deps
  changes behavior and needs its own review.
- The PIN/numpad logic, `handleNumpad`, `handlePinSubmit`, auth flow, i18n.
- Any other file.

## Git workflow

- Branch: this is a repo-wide gate fix; create `fix/loginpage-conditional-hook`
  from the EsneiderCode develop branch if working standalone, or apply it on the
  branch the operator names. Conventional commit, e.g.
  `fix(login): move auth redirect below hooks to satisfy rules-of-hooks`.
  NO `Co-Authored-By`. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Move the early return below all hooks

In `src/pages/auth/LoginPage.tsx`, cut the three lines:

```tsx
  if (user) {
    return <Navigate to={ROLE_ROUTES[user.role]} replace />
  }
```

and paste them immediately BEFORE the component's final `return (` (the one
rendering the login layout JSX), so every hook above runs unconditionally.
Keep the blank-line spacing consistent with the file.

Behavior note (expected, not a regression): for an already-logged-in user the
keyboard `useEffect` now mounts for one render before `<Navigate/>` unmounts
the page — harmless, the listener is removed by its cleanup.

**Verify**: `rg -n "if \(user\)" src/pages/auth/LoginPage.tsx` → the guard now
appears AFTER the `useEffect` block (compare line numbers).

### Step 2: Gates

**Verify**:
1. `npm run lint` → exit 0, output contains NO `error` lines (`npm run lint 2>&1 | rg -c "error"` → exit 1 / zero matches).
2. `npm run typecheck` → exit 0.
3. `npm test` → all pass (166 expected at planning time; report the actual count).

### Step 3: Manual smoke (demo mode)

`npm run dev:demo` → log in as `admin@demo.lumen` / `demo123` → you are
redirected to the admin dashboard. Reload `/` while logged in → redirected
again (the guard still works from its new position). Log out if the UI offers
it. Stop the dev server.

**Verify**: both redirects observed.

## Test plan

No new tests — this is a hook-order fix with no logic change; the existing
suite plus the lint rule itself are the regression net (the lint error IS the
machine-checkable regression detector).

## Done criteria

- [ ] `npm run lint` exits 0 with zero errors
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` passes
- [ ] `npm run preflight` exits 0 end-to-end (this is the point of the plan)
- [ ] `git diff --stat` shows ONLY `src/pages/auth/LoginPage.tsx` modified
- [ ] Demo-mode smoke: logged-in redirect works
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The excerpt above doesn't match the file (someone fixed or changed it already).
- After the move, eslint reports a DIFFERENT error in this file (e.g.
  `exhaustive-deps` escalated to error by config) — report it; do not start
  tuning dependency arrays.
- `npm run preflight` still fails after Steps 1-2 for a reason outside
  LoginPage — report the failing file instead of fixing it.

## Maintenance notes

- Anyone adding hooks to LoginPage must keep them ABOVE the `if (user)` guard —
  a one-line review check.
- This file diverges from upstream's LoginPage (Jarl's fork redesigned the PIN
  UX earlier); when syncing from upstream, watch this guard's position in merges.
- Deferred on purpose: the `exhaustive-deps` warnings repo-wide (5 at planning
  time) — separate, behavior-affecting cleanup.
