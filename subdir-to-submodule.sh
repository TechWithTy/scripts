#!/bin/bash
set -e

# Get parameters
while getopts "u:d:" opt; do
  case $opt in
    u) GITHUB_USER="$OPTARG" ;;
    d) TARGET_DIR="$OPTARG" ;;
    *) echo "Usage: $0 -u github_username -d target_directory" >&2
       exit 1 ;;
  esac
done

if [ -z "$GITHUB_USER" ] || [ -z "$TARGET_DIR" ]; then
  echo "Both username (-u) and target directory (-d) must be specified"
  exit 1
fi

# Get the subdirectory name
SUBDIR=$(basename "$TARGET_DIR")
PARENTDIR=$(dirname "$TARGET_DIR")

# Navigate to target directory
cd "$TARGET_DIR" || { echo "Could not navigate to $TARGET_DIR"; exit 1; }
OLDPWD=$PWD

# Initialize Git if not already a repository
if [ ! -d .git ]; then
  git init
  git add .
  git commit -m "Initial commit before submodule conversion"
fi

# Create or use existing GitHub repo
if ! gh repo view "$SUBDIR" >/dev/null 2>&1; then
  gh repo create "$SUBDIR" --public --source=. --remote=origin --push
else
  echo "Using existing repository $SUBDIR"
  git remote add origin "https://github.com/$GITHUB_USER/$SUBDIR.git" || true
fi

# Remove any existing .git in the subdir
rm -rf .git

# Re-init, add, and push to the new repo
git init
git remote add origin "https://github.com/$GITHUB_USER/$SUBDIR.git"
git add .
git commit -m "Initial commit for submodule"
git branch -M main
git push -uf origin main

# Go to parent and add as submodule
cd "$OLDPWD" || { echo "Could not navigate back to project root"; exit 1; }
git submodule add "https://github.com/$GITHUB_USER/$SUBDIR.git" "$TARGET_DIR"
git commit -am "Add $SUBDIR as submodule"

echo "Successfully converted $SUBDIR to a submodule"

export HOME="/c/Users/tyriq" && ./subdir-to-submodule.sh -u your_github_username -d ../backend/app/core/celery
