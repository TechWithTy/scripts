#!/bin/bash
set -e

# Get the current subdirectory name
SUBDIR=$(basename \"$PWD\")
PARENTDIR=$(dirname \"$PWD\")

# Create a new public GitHub repo (assumes you want the same name as the folder)
gh repo create \"$SUBDIR\" --public --source=. --remote=origin --push

# Remove any existing .git in the subdir
rm -rf .git

# Re-init, add, and push to the new repo
git init
git remote add origin \"https://github.com/YOUR_GITHUB_USERNAME/$SUBDIR.git\"
git add .
git commit -m \"Initial commit for submodule\"
git branch -M main
git push -u origin main

# Go to parent and add as submodule
cd \"$PARENTDIR\"
git submodule add \"https://github.com/YOUR_GITHUB_USERNAME/$SUBDIR.git\" \"$SUBDIR\"
git commit -am \"Add $SUBDIR as submodule\"

# Example
# ./util_scripts/subdir-to-submodule.sh -u "TechWithTy" -d "backend/utils"