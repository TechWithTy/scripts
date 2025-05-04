#!/bin/bash
set -eo pipefail

# Create logs directory if it doesn't exist
LOG_DIR="$(dirname "$0")/logs/subdir_to_submodule"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/submodule-conversion-$(date +%Y%m%d-%H%M%S).log"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "Logging output to $LOG_FILE"

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
  echo "Usage: $0 -u github_username -d target_directory [-r repository_name] [-p description] [-t tag1,tag2,...] [-w website_url] [-H show_homepage] [-R show_releases] [-P show_packages] [-D show_deployments] [-s private_repo]" | tee -a "$LOG_FILE"
  echo "Max 20 tags allowed" | tee -a "$LOG_FILE"
  exit 1
fi

# Truncate description to 200 characters if needed
if [[ -n "$PROJECT_DESC" ]]; then
  echo "Truncating project description from ${#PROJECT_DESC} characters to 200"
  PROJECT_DESC="${PROJECT_DESC:0:200}"
  echo "Truncated description: $PROJECT_DESC"
fi

# Validate boolean parameters
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
WEBSITE_URL="${WEBSITE_URL:-https://www.cybershoptech.com}"

# Optimized error handling
handle_error() {
  local lineno=$1
  echo "Error at line $lineno. Attempting cleanup..." | tee -a "$LOG_FILE"
  cd "$PROJECT_ROOT" || exit 1
  exit 1
}

trap 'handle_error $LINENO' ERR

# Updated repository configuration with feature flags and privacy
configure_repo() {
  local repo="$1"
  
  if [[ "$PRIVATE_REPO" ]]; then
    echo "✨ Updating repository configuration for $repo"
    
    # Basic settings
    echo "🚀 Setting basic repository settings"
    gh repo edit "$repo" \
      ${WEBSITE_URL:+--homepage "$WEBSITE_URL"} \
      ${PROJECT_DESC:+--description "$PROJECT_DESC"} \
      --enable-discussions \
      --enable-wiki
    
    # Releases requires API call
    echo "🚀 Configuring releases via API"
    gh api -X PATCH "repos/$repo" -f has_releases=true
    
    echo "✅ Repository features enabled:"
    echo "   - 📦 Releases (via API)"
    echo "   - 💬 Discussions"
    echo "   - 📚 Wiki"
  else
    echo "⏭️  Skipping repository configuration (PRIVATE_REPO not set)"
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
    
    # Force push to master branch
    git branch -M master
    git push -u origin master --force
    
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
    
    # Ensure we're using master branch
    git branch -M master 2>/dev/null || true
    git push -u origin master --force
    
    # Delete main branch if it exists
    if git show-ref --quiet refs/heads/main; then
      echo "🧹 Cleaning up main branch"
      git push origin --delete main 2>/dev/null || true
      git branch -D main 2>/dev/null || true
      
      # Update default branch on GitHub
      gh api -X PATCH "repos/$GITHUB_USER/$REPO_NAME" \
        -f default_branch="master"
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
  git branch -M master
  git push -uf origin master >/dev/null

  # Return and add submodule
  cd "$PROJECT_ROOT"
  if git ls-files --error-unmatch "$TARGET_DIR" &>/dev/null; then
    echo "↪ Directory exists in Git index - removing..."
    git rm -r --cached "$TARGET_DIR"
    git commit -m "Remove existing $TARGET_DIR before submodule conversion" --quiet
  fi

  git submodule add --force "https://github.com/$GITHUB_USER/$REPO_NAME.git" "$TARGET_DIR"
  
  # Verify update
  [[ -f .gitmodules ]] && git add .gitmodules
  git commit -m "Add $REPO_NAME submodule" --quiet
  
  echo " ✅ Successfully converted to submodule (${REPO_NAME})"
}

# Execute
convert_to_submodule

# Final debug output
repo_url="https://github.com/$GITHUB_USER/$REPO_NAME"
echo "🔍 Repository Details:"
echo "   🔗 URL: $repo_url"
echo "   👁️  Visibility: $(gh repo view $GITHUB_USER/$REPO_NAME --json visibility -q '.visibility' 2>/dev/null || echo '[unavailable]')"
echo "   🌿 Branch: $(git -C "$TARGET_DIR" branch --show-current 2>/dev/null || echo '[unavailable]')"
echo "   📌 Description: $(gh repo view $GITHUB_USER/$REPO_NAME --json description -q '.description' 2>/dev/null || echo '[unavailable]')"
echo "   🏷️  Topics: $(gh repo view $GITHUB_USER/$REPO_NAME --json repositoryTopics -q '.repositoryTopics[].name' 2>/dev/null | tr '\n' ' ' || echo '[unavailable]')"
echo "   🛠️  Features:"
echo "     - 💬 Discussions: $(gh repo view $GITHUB_USER/$REPO_NAME --json hasDiscussionsEnabled -q '.hasDiscussionsEnabled' 2>/dev/null || echo '[unavailable]')"
echo "     - 📚 Wiki: $(gh repo view $GITHUB_USER/$REPO_NAME --json hasWikiEnabled -q '.hasWikiEnabled' 2>/dev/null || echo '[unavailable]')"

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


./util_scripts/subdir-to-submodule.sh \
  -u TechWithTy \
  -d backend/app/core/telemetry \
  -r telemetry-utils \
  -p "Application telemetry and monitoring utilities" \
  -t "telemetry,monitoring,metrics,logging" \
  -w "" \
  -H true -R true -P false -D false \
  -s false