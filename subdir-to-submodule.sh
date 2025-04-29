#!/bin/bash
set -e

SUBDIR=$(basename "$PWD")
PARENTDIR=$(dirname "$PWD")

rm -rf .git
git init
git add .
git commit -m "Initial commit for submodule"
git branch -M main

# Check if repo exists on GitHub
if gh repo view "TechWithTy/$SUBDIR" > /dev/null 2>&1; then
  echo "Repo TechWithTy/$SUBDIR already exists. Skipping creation."
else
  gh repo create "$SUBDIR" --public --source=. --remote=origin --push
fi

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/TechWithTy/$SUBDIR.git"
git push -u origin main

cd "$PARENTDIR"
git submodule add "https://github.com/TechWithTy/$SUBDIR.git" "$SUBDIR"
git commit -am "Add $SUBDIR as submodule"