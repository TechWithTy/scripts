#!/bin/bash
set -e

# Get parameters
while getopts "u:d:r:" opt; do
  case $opt in
    u) GITHUB_USER="$OPTARG" ;;
    d) TARGET_DIR="$OPTARG" ;;
    r) REPO_NAME="$OPTARG" ;;
    *) echo "Usage: $0 -u github_username -d target_directory [-r repository_name]" >&2
       exit 1 ;;
  esac
done

if [ -z "$GITHUB_USER" ] || [ -z "$TARGET_DIR" ]; then
  echo "Both username (-u) and target directory (-d) must be specified"
  exit 1
fi

# Use provided repo name or default to subdirectory name
REPO_NAME=${REPO_NAME:-$(basename "$TARGET_DIR")}
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
if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
  echo "Using existing repository $REPO_NAME"
  # Just add as submodule without reinitializing
  cd "$OLDPWD" || { echo "Could not navigate back to project root"; exit 1; }
  git submodule add "https://github.com/$GITHUB_USER/$REPO_NAME.git" "$TARGET_DIR"
  git commit -am "Add existing $REPO_NAME as submodule"
  echo "Successfully added existing repository $REPO_NAME as submodule"
  exit 0
fi

# Create new GitHub repo
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push

# Remove any existing .git in the subdir
rm -rf .git

# Re-init, add, and push to the new repo
git init
git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
git add .
git commit -m "Initial commit for submodule"
git branch -M main
git push -uf origin main

# Go to parent and add as submodule
cd "$OLDPWD" || { echo "Could not navigate back to project root"; exit 1; }

# Get absolute path to project root
PROJECT_ROOT="$PWD"

# Add submodule to root project
git submodule add "https://github.com/$GITHUB_USER/$REPO_NAME.git" "$TARGET_DIR"

# After adding submodule, verify and update root .gitmodules
ROOT_GITMODULES="$OLDPWD/.gitmodules"
if [ ! -f "$ROOT_GITMODULES" ]; then
  echo "Error: Root project's .gitmodules not found at $ROOT_GITMODULES"
  exit 1
fi

echo "Verifying submodule added to root project's .gitmodules:"
cat "$ROOT_GITMODULES"

git commit -am "Add $SUBDIR as submodule (repo: $REPO_NAME)"

echo "Successfully converted $SUBDIR to a submodule (repository: $REPO_NAME)"

# Removed self-execution line that was causing issues