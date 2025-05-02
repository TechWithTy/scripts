#!/bin/bash
set -eo pipefail

# Enhanced parameter handling with feature flags and privacy option
while getopts ":u:d:r:p:t:w:H:R:P:D:s:" opt; do
  case $opt in
    u) GITHUB_USER="$OPTARG" ;;
    d) TARGET_DIR="$OPTARG" ;;
    r) REPO_NAME="$OPTARG" ;;
    p) PROJECT_DESC="$OPTARG" ;;
    t) 
      IFS=',' read -ra TAG_ARRAY <<< "$OPTARG"
      TAGS="${TAG_ARRAY[*]:0:20}"
      ;;
    w) WEBSITE_URL="$OPTARG" ;;
    H) SHOW_HOMEPAGE="$OPTARG" ;;
    R) SHOW_RELEASES="$OPTARG" ;;
    P) SHOW_PACKAGES="$OPTARG" ;;
    D) SHOW_DEPLOYMENTS="$OPTARG" ;;
    s) PRIVATE_REPO="$OPTARG" ;;
    \?) echo "Invalid option: -$OPTARG" >&2; exit 1 ;;
    :) echo "Option -$OPTARG requires an argument." >&2; exit 1 ;;
  esac
done

# Validate required params
if [[ -z "$GITHUB_USER" || -z "$TARGET_DIR" ]]; then
  echo "Usage: $0 -u github_username -d target_directory [-r repository_name] [-p description] [-t tag1,tag2,...] [-w website_url] [-H show_homepage] [-R show_releases] [-P show_packages] [-D show_deployments] [-s private_repo]"
  echo "Max 20 tags allowed"
  exit 1
fi

# Validate boolean flags
validate_boolean() {
  local value="$1"
  local name="$2"
  if [[ ! "$value" =~ ^(true|false)$ ]]; then
    echo "Error: $name must be 'true' or 'false'" >&2
    exit 1
  fi
}

[[ -n "$SHOW_HOMEPAGE" ]] && validate_boolean "$SHOW_HOMEPAGE" "Homepage"
[[ -n "$SHOW_RELEASES" ]] && validate_boolean "$SHOW_RELEASES" "Releases"
[[ -n "$SHOW_PACKAGES" ]] && validate_boolean "$SHOW_PACKAGES" "Packages"
[[ -n "$SHOW_DEPLOYMENTS" ]] && validate_boolean "$SHOW_DEPLOYMENTS" "Deployments"
[[ -n "$PRIVATE_REPO" ]] && validate_boolean "$PRIVATE_REPO" "Private"

# Set defaults
REPO_NAME="${REPO_NAME:-$(basename "$TARGET_DIR")}"
PROJECT_ROOT="$(pwd)"

# Optimized error handling
handle_error() {
  local lineno=$1
  echo "Error at line $lineno. Attempting cleanup..."
  cd "$PROJECT_ROOT" || exit 1
  exit 1
}

trap 'handle_error $LINENO' ERR

# Updated repository configuration with feature flags and privacy
configure_repo() {
  local repo="$1"
  
  # Skip visibility changes for existing repos to avoid confirmation
  if [[ "$PRIVATE_REPO" ]]; then
    local cmd="gh repo edit $repo"
    [[ -n "$WEBSITE_URL" ]] && cmd+=" --homepage \"$WEBSITE_URL\""
    
    # Only modify supported features
    [[ "$SHOW_RELEASES" == "false" ]] && cmd+=" --enable-issues=false"
    [[ "$SHOW_PACKAGES" == "false" ]] && cmd+=" --enable-projects=false"
    [[ "$SHOW_DEPLOYMENTS" == "false" ]] && cmd+=" --enable-wiki=false"
    
    echo " Configuring repository features"
    eval "$cmd"
  fi
}

# Main conversion function
convert_to_submodule() {
  echo " Converting $TARGET_DIR to submodule $REPO_NAME"
  
  # Navigate to target
  cd "$TARGET_DIR" || return 1
  
  # Initialize if needed
  if [[ ! -d .git ]]; then
    git init --quiet
    git add . >/dev/null
    git commit -m "Initial commit before submodule conversion" --quiet
  fi

  # Handle existing repo
  if gh repo view "$GITHUB_USER/$REPO_NAME" &>/dev/null; then
    echo " Using existing repository $REPO_NAME"
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
    
    # Force push to main branch
    git branch -M main
    git push -u origin main --force
    
    # Update metadata
    if [[ -n "$WEBSITE_URL" ]]; then
      echo " Updating repository website to: $WEBSITE_URL"
      gh repo edit "$GITHUB_USER/$REPO_NAME" --homepage "$WEBSITE_URL"
    fi
    
    # Add topics reliably
    if [[ -n "$TAGS" ]]; then
      echo " Adding repository topics"
      gh repo edit "$GITHUB_USER/$REPO_NAME" \
        $(printf -- '--add-topic "%s" ' ${TAGS[@]}) \
        || echo " Failed to add some topics (may need manual addition)"
    fi
    
    configure_repo "$GITHUB_USER/$REPO_NAME"
  else
    echo "⚡ Creating new repository"
    gh repo create "$GITHUB_USER/$REPO_NAME" \
      --public \
      --source=. \
      --remote=origin \
      --push
    
    # Ensure main branch exists and delete master if present
    git branch -M main 2>/dev/null || true
    git push -u origin main --force
    if git show-ref --verify --quiet refs/heads/master; then
      git push origin --delete master
      git branch -D master
    fi
    
    # Set metadata
    [[ -n "$PROJECT_DESC" ]] && \
      gh repo edit "$GITHUB_USER/$REPO_NAME" --description "$PROJECT_DESC"
    
    # Add topics
    if [[ -n "$TAGS" ]]; then
      echo " Adding repository topics"
      gh repo edit "$GITHUB_USER/$REPO_NAME" \
        $(printf -- '--add-topic "%s" ' ${TAGS[@]}) \
        || echo " Failed to add some topics (may need manual addition)"
    fi
    
    configure_repo "$GITHUB_USER/$REPO_NAME"
  fi

  # Optimized cleanup and push
  rm -rf .git
  git init --quiet
  git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
  git add . >/dev/null
  git commit -m "Initial submodule commit" --quiet
  git branch -M main
  git push -uf origin main >/dev/null

  # Return and add submodule
  cd "$PROJECT_ROOT"
  git submodule add --force "https://github.com/$GITHUB_USER/$REPO_NAME.git" "$TARGET_DIR"
  
  # Verify update
  [[ -f .gitmodules ]] && git add .gitmodules
  git commit -m "Add $REPO_NAME submodule" --quiet
  
  echo " Successfully converted to submodule (${REPO_NAME})"
}

# Execute
convert_to_submodule
exit 0

# Add comprehensive usage examples
cat << 'EOF'

# USAGE EXAMPLES:

# 1. Basic public submodule
./subdir-to-submodule.sh -u techwithty -d path/to/dir

# 2. Private repository with website
./subdir-to-submodule.sh -u techwithty -d path/to/dir \
  -s true -w "https://example.com"

# 3. Full featured private repo
./subdir-to-submodule.sh -u techwithty -d path/to/dir \
  -r custom-name -p "Project description" \
  -t "python,database,utils" -w "https://example.com" \
  -H true -R true -P false -D true -s true

# 4. Existing repo with updated settings
./subdir-to-submodule.sh -u techwithty -d path/to/dir \
  -H false -R false -s false
EOF