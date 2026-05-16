#!/usr/bin/env bash
# check-pr-ready.sh — Validate the current branch is ready to be opened as a PR.
#
# Usage:
#   ./scripts/check-pr-ready.sh
#
# Exits non-zero on any failure, prints a clear list of what to fix.

set -uo pipefail

EXIT_CODE=0
fail() {
  echo "❌ $*"
  EXIT_CODE=1
}
ok() { echo "✅ $*"; }

CURRENT=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

# ── 1. Branch is a feature branch ────────────────────────────────────────────
if [[ -z "$CURRENT" ]]; then
  fail "Detached HEAD — checkout a feature branch first."
elif [[ "$CURRENT" =~ ^(main|develop)$ ]]; then
  fail "On '$CURRENT' — checkout a feature branch first."
elif ! [[ "$CURRENT" =~ ^(feat|fix|chore|docs|refactor|test)/[a-z0-9][a-z0-9-]*$ ]]; then
  fail "Branch name '$CURRENT' doesn't match: feat|fix|chore|docs|refactor|test / kebab-case"
else
  ok "Branch name OK: $CURRENT"
fi

# ── 2. Working tree clean ────────────────────────────────────────────────────
if [[ -n "$(git status --porcelain)" ]]; then
  fail "Uncommitted changes — commit or stash before pushing."
  git status --short | sed 's/^/      /'
else
  ok "Working tree clean"
fi

# ── 3. Up to date with upstream/develop ──────────────────────────────────────
echo "🔎 Fetching upstream..."
git fetch upstream --quiet 2>/dev/null || fail "Could not fetch upstream — check your remote."

BEHIND=$(git rev-list HEAD..upstream/develop --count 2>/dev/null || echo "?")
if [[ "$BEHIND" == "?" ]]; then
  fail "Cannot compare against upstream/develop"
elif [[ "$BEHIND" -gt 0 ]]; then
  fail "$BEHIND commits behind upstream/develop — rebase first:"
  echo "      git rebase upstream/develop"
else
  ok "Up to date with upstream/develop"
fi

# ── 4. Tests green ───────────────────────────────────────────────────────────
echo "🧪 Running tests..."
if npm test --silent -- --run >/dev/null 2>&1; then
  ok "Tests passing"
else
  fail "Tests failing — run 'npm test' to see which"
fi

# ── 5. Typecheck clean ───────────────────────────────────────────────────────
echo "🧪 Running typecheck..."
if npm run typecheck >/dev/null 2>&1; then
  ok "Typecheck clean"
else
  fail "Typecheck failing — run 'npm run typecheck'"
fi

# ── 6. No duplicate migration numbers ────────────────────────────────────────
if [[ -d supabase/migrations ]]; then
  DUPES=$(ls supabase/migrations/ | grep -E '^[0-9]+_' | awk -F_ '{print $1}' | sort | uniq -d)
  if [[ -n "$DUPES" ]]; then
    fail "Duplicate migration numbers detected: $DUPES"
  else
    ok "No duplicate migration numbers"
  fi
fi

# ── 7. New migrations declare their dependencies ─────────────────────────────
NEW_MIGRATIONS=$(git diff --name-only upstream/develop...HEAD -- 'supabase/migrations/*.sql' || true)
if [[ -n "$NEW_MIGRATIONS" ]]; then
  echo "🔎 Checking new migrations declare their dependencies..."
  while IFS= read -r mig; do
    [[ -z "$mig" ]] && continue
    if ! grep -q -i 'depends on' "$mig"; then
      fail "$mig does not declare 'Depends on:' in its header"
    else
      ok "$mig declares dependencies"
    fi
  done <<< "$NEW_MIGRATIONS"
fi

# ── 8. No accidental .env commits ────────────────────────────────────────────
if git diff upstream/develop...HEAD --name-only | grep -E '^\.env(\.|$)' | grep -v '\.env\.example\|\.env\.demo$'; then
  fail "Real .env file committed — remove it (only .env.example and .env.demo allowed)"
else
  ok "No real .env files committed"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [[ "$EXIT_CODE" -eq 0 ]]; then
  cat <<EOF
✅ Branch '$CURRENT' is PR-ready.

Push and open PR:
  git push -u fork $CURRENT
  gh pr create --repo EsneiderCode/Lumen \\
    --base develop --head jarl9801:$CURRENT
EOF
else
  echo "❌ Fix the issues above before pushing."
fi

exit $EXIT_CODE
