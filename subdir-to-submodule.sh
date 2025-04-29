#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <github-username>"
  exit 1
fi

GITHUB_USER="$1"
SUBDIR=$(basename "$PWD")
PARENTDIR=$(dirname "$PWD")

rm -rf .git
git init
git add .
git commit -m "Initial commit for submodule"
git branch -M main

# Check if repo exists on GitHub
if gh repo view "$GITHUB_USER/$SUBDIR" > /dev/null 2>&1; then
  echo "Repo $GITHUB_USER/$SUBDIR already exists. Skipping creation."
else
  gh repo create "$SUBDIR" --public --source=. --remote=origin --push --owner "$GITHUB_USER"
fi

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$GITHUB_USER/$SUBDIR.git"
git push -u origin main

cd "$PARENTDIR"
git submodule add "https://github.com/$GITHUB_USER/$SUBDIR.git" "$SUBDIR"
git commit -am "Add $SUBDIR as submodule"

How to use the new script:

# !How to use bash
# CopyInsert in Terminal
# bash ../../scripts/subdir-to-submodule.sh YOUR_GITHUB_USERNAME
