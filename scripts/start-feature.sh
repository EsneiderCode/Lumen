#!/usr/bin/env bash
# start-feature.sh — Pre-flight checklist before starting new work on Lumen.
#
# Usage:
#   ./scripts/start-feature.sh feat/your-feature-name
#
# Does (in order):
#   1. Fetches all remotes (upstream, origin, fork)
#   2. Verifies upstream + fork remotes are configured
#   3. Reports remote divergence state
#   4. Fast-forwards local main if it's just behind upstream/main
#   5. Prunes local branches already merged into upstream/main
#   6. Creates the new branch from upstream/develop
#   7. Reports the next available migration number
#   8. Runs baseline tests + typecheck
#
# Conventions:
#   - Branch names: feat/* | fix/* | chore/* | docs/* | refactor/* | test/*
#   - PRs always target upstream/develop (Alejandro's flow: develop → main)

set -euo pipefail

BRANCH_NAME="${1:-}"

if [[ -z "$BRANCH_NAME" ]]; then
  cat <<EOF
Usage: $0 <branch-name>

Examples:
  $0 feat/billing-preview-modal
  $0 fix/datev-export-encoding
  $0 chore/update-deps

Branch must match: (feat|fix|chore|docs|refactor|test)/<kebab-case>
EOF
  exit 1
fi

if ! [[ "$BRANCH_NAME" =~ ^(feat|fix|chore|docs|refactor|test)/[a-z0-9][a-z0-9-]*$ ]]; then
  echo "❌ Branch name must match: feat|fix|chore|docs|refactor|test / kebab-case"
  echo "   Got: $BRANCH_NAME"
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "❌ Branch '$BRANCH_NAME' already exists locally"
  echo "   Either pick another name or: git branch -D $BRANCH_NAME"
  exit 1
fi

# ── Step 1-2: Fetch + verify remotes ─────────────────────────────────────────
echo "🔎 Fetching all remotes..."
git fetch --all --prune --quiet

for remote in upstream fork; do
  if ! git remote get-url "$remote" >/dev/null 2>&1; then
    echo "❌ Required remote '$remote' is not configured."
    case "$remote" in
      upstream) echo "   git remote add upstream https://github.com/EsneiderCode/Lumen.git" ;;
      fork)     echo "   git remote add fork https://github.com/jarl9801/Lumen.git" ;;
    esac
    exit 1
  fi
done

# ── Step 3: Report remote state ──────────────────────────────────────────────
BEHIND_UPSTREAM_MAIN=$(git rev-list main..upstream/main --count 2>/dev/null || echo "?")
DEVELOP_AHEAD=$(git rev-list upstream/main..upstream/develop --count 2>/dev/null || echo "?")
ORIGIN_ONLY=$(git rev-list upstream/main..main --count 2>/dev/null || echo "0")

echo ""
echo "📊 Remote state:"
echo "   local main is $BEHIND_UPSTREAM_MAIN commits behind upstream/main"
echo "   upstream/develop is $DEVELOP_AHEAD commits ahead of upstream/main"

if [[ "$ORIGIN_ONLY" -gt 0 ]]; then
  echo ""
  echo "⚠️  Your local main has $ORIGIN_ONLY commits NOT in upstream/main."
  echo "   Likely HMR-Nexus internal work not yet pushed to Alejandro."
  echo "   These will be preserved — sync them with Alejandro out of band."
fi

# ── Step 4: Fast-forward local main if safe ──────────────────────────────────
if [[ "$ORIGIN_ONLY" -eq 0 && "$BEHIND_UPSTREAM_MAIN" != "?" && "$BEHIND_UPSTREAM_MAIN" -gt 0 ]]; then
  echo ""
  echo "🔄 Fast-forwarding local main to upstream/main..."
  CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
  git checkout main --quiet
  git merge --ff-only upstream/main --quiet
  git checkout "$CURRENT_BRANCH" --quiet
  echo "   done."
fi

# ── Step 5: Prune merged branches (zombies) ──────────────────────────────────
echo ""
echo "🧹 Pruning branches already merged in upstream/main..."
PROTECTED="^(main|develop|HEAD)$"
PRUNED=0
while IFS= read -r branch; do
  branch=$(echo "$branch" | xargs)  # trim whitespace
  [[ -z "$branch" ]] && continue
  [[ "$branch" =~ ^\* ]] && continue
  [[ "$branch" =~ $PROTECTED ]] && continue
  [[ "$branch" == "$BRANCH_NAME" ]] && continue
  if git branch -d "$branch" 2>/dev/null; then
    echo "   deleted $branch"
    PRUNED=$((PRUNED + 1))
  fi
done < <(git branch --merged upstream/main --format='%(refname:short)')
[[ "$PRUNED" -eq 0 ]] && echo "   nothing to prune."

# ── Step 6: Create new branch ────────────────────────────────────────────────
echo ""
echo "🌱 Creating $BRANCH_NAME from upstream/develop..."
git checkout -b "$BRANCH_NAME" upstream/develop --quiet

# ── Step 7: Next migration number ────────────────────────────────────────────
if [[ -d supabase/migrations ]]; then
  LAST_MIGRATION=$(ls supabase/migrations/ | grep -E '^[0-9]+_' | sort -V | tail -1 | awk -F_ '{print $1}')
  if [[ -n "$LAST_MIGRATION" ]]; then
    NEXT=$(printf "%03d" $((10#$LAST_MIGRATION + 1)))
    echo ""
    echo "🗃️  Last migration: $LAST_MIGRATION → next number: $NEXT"
    echo "   Filename pattern: supabase/migrations/${NEXT}_<your_name>.sql"
  fi
fi

# ── Step 8: Baseline checks ──────────────────────────────────────────────────
echo ""
echo "🧪 Baseline checks (skip with --skip-tests if needed)..."
if npm test --silent -- --run >/dev/null 2>&1; then
  echo "   ✅ tests pass"
else
  echo "   ❌ tests failing on baseline — fix this before changing anything"
  echo "      run: npm test"
  exit 1
fi

if npm run typecheck >/dev/null 2>&1; then
  echo "   ✅ typecheck clean"
else
  echo "   ❌ typecheck failing on baseline — fix this before changing anything"
  echo "      run: npm run typecheck"
  exit 1
fi

# ── Done ─────────────────────────────────────────────────────────────────────
cat <<EOF

✅ Ready to work on $BRANCH_NAME

Next steps:
  1. Make your changes
  2. Run ./scripts/check-pr-ready.sh before pushing
  3. git push -u fork $BRANCH_NAME
  4. gh pr create --repo EsneiderCode/Lumen \\
       --base develop --head jarl9801:$BRANCH_NAME
EOF
