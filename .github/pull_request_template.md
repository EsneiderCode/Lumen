<!--
Thanks for contributing to Lumen. Fill in every section below; delete what doesn't apply.
PRs target `develop`, never `main` directly.
-->

## Summary

<!-- One paragraph: what this PR does and why. -->

## Changes

<!-- Bullet list of what's new/changed/removed. Group by area. -->

- 

## Schema impact

<!-- Delete this section if no DB changes. -->

- New migration: `supabase/migrations/<NNN>_<name>.sql`
- Depends on: `<NNN>_<name>.sql` (if any)
- Run order: must be applied AFTER `<NNN>` and BEFORE deploy
- TS types regenerated? `[ ]` Yes — Alejandro runs `supabase gen types typescript`

## Test plan

- [ ] `npm test` — `<XX>/<XX>` passing
- [ ] `npm run typecheck` — clean
- [ ] `./scripts/check-pr-ready.sh` — green
- [ ] Manual smoke (describe what you clicked through):
  - 

## Demo-mode coverage

<!-- Did you add fixtures or paths that demo mode should exercise? -->

- [ ] No — change is only relevant with real DB
- [ ] Yes — fixtures updated in `src/lib/demo/fixtures.ts`

## Standards

- [ ] Follows NEXUS.OS rules in `BRIEF.md` (no `bg-gray-*`, no shadows, no rounded-xl, accent only for CTAs/active/.OS)
- [ ] No `Co-Authored-By` lines in commits
- [ ] No real `.env` file committed
- [ ] No new `console.log` in committed code (except intentional diagnostics)

## Out of scope / follow-ups

<!-- What deliberately wasn't done in this PR and why. Linked issue numbers if any. -->

- 
