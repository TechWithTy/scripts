#!/usr/bin/env bash
# Script to fix and re-register a Git submodule
set -o pipefail
set +e
set +u

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <submodule-path> <repo-url> [branch-name]"
  echo "Example: $0 backend/app/core/grafana https://github.com/TechWithTy/grafana-client-utils.git main"
  exit 1
fi

# Assign variables
SUBMODULE_PATH="$1"
REPO_URL="$2"
BRANCH_NAME="${3:-master}"

echo "Fixing submodule: $SUBMODULE_PATH"

# 1) Deinit & remove any broken submodule data
git submodule deinit -f "$SUBMODULE_PATH" 2>/dev/null || echo "Warning: could not deinit $SUBMODULE_PATH"
rm -rf ".git/modules/$SUBMODULE_PATH" || echo "Warning: could not remove modules dir for $SUBMODULE_PATH"
git rm -f "$SUBMODULE_PATH" 2>/dev/null || echo "Warning: could not git rm $SUBMODULE_PATH"

# 2) Remove its section from .gitmodules
git config -f .gitmodules --remove-section "submodule.$SUBMODULE_PATH" || echo "Warning: no .gitmodules entry for $SUBMODULE_PATH"
git add .gitmodules
git commit -m "chore: remove broken $SUBMODULE_PATH submodule" || echo "Warning: no broken-submodule entry removed"

# 3) Backup your existing code
if mv "$SUBMODULE_PATH" "${SUBMODULE_PATH}.backup" 2>/dev/null; then
  echo "Backed up $SUBMODULE_PATH to ${SUBMODULE_PATH}.backup"
else
  echo "Permission denied on mv; copying $SUBMODULE_PATH to backup"
  cp -R "$SUBMODULE_PATH" "${SUBMODULE_PATH}.backup" 2>/dev/null && echo "Copied to ${SUBMODULE_PATH}.backup" || echo "Warning: copy backup failed"
  rm -rf "$SUBMODULE_PATH" 2>/dev/null || echo "Warning: could not remove original $SUBMODULE_PATH"
fi

# 4) Push that backup into its own remote repo
pushd "${SUBMODULE_PATH}.backup" >/dev/null
git init
git remote add origin "$REPO_URL"
git add .
git commit -m "chore: initial import for ${SUBMODULE_PATH} submodule" || echo "Warning: no initial import commit made"
git push -u origin "$BRANCH_NAME"
popd >/dev/null

# 5) Re-add as an actual submodule
rm -rf "$SUBMODULE_PATH" 2>/dev/null || true
if git submodule add "$REPO_URL" "$SUBMODULE_PATH"; then
  echo "Added submodule $SUBMODULE_PATH"
else
  echo "Warning: git submodule add failed for $SUBMODULE_PATH, using fallback"
  git config -f .gitmodules submodule."$SUBMODULE_PATH".path "$SUBMODULE_PATH"
  git config -f .gitmodules submodule."$SUBMODULE_PATH".url "$REPO_URL"
  git add .gitmodules
  rm -rf "$SUBMODULE_PATH"
  git clone "$REPO_URL" "$SUBMODULE_PATH"
fi
git submodule update --init "$SUBMODULE_PATH"

# 6) Copy your files back in, commit, and push
cp -R "${SUBMODULE_PATH}.backup/"* "${SUBMODULE_PATH}/"
pushd "$SUBMODULE_PATH" >/dev/null
git add .
git commit -m "chore: migrate existing code into submodule"
git push
popd >/dev/null

# 7) Finalize in main repo
git add .gitmodules "$SUBMODULE_PATH"
git commit -m "chore: register $SUBMODULE_PATH submodule"
git submodule status

echo "Submodule $SUBMODULE_PATH successfully fixed and registered"