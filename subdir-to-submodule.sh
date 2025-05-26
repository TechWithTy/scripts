#!/bin/bash
set -eo pipefail

# * LOGGING & ENV SETUP
LOG_DIR="$(dirname "$0")/logs/subdir_to_submodule"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/submodule-conversion-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Logging output to $LOG_FILE"

# * PARAMETER PARSING & VALIDATION
print_usage() {
  cat << 'EOF'
Usage: $0 -u github_username -d target_directory[,target_directory2,...] [-r repository_name] [-p description] [-t tag1,tag2,...] [-w website_url] [-H show_homepage] [-R show_releases] [-P show_packages] [-D show_deployments] [-s private_repo] [-z]
Max 20 tags allowed
-z : Enable parallel submodule conversion for multiple target directories (comma-separated)
EOF
}

while getopts ":u:d:r:p:t:w:H:R:P:D:s:z" opt; do
  case $opt in
    u) GITHUB_USER="$OPTARG" ;;
    d) IFS=',' read -ra DIR_ARRAY <<< "$OPTARG" ;;
    r) REPO_NAME="$OPTARG" ;;
    p) PROJECT_DESC="$OPTARG" ;;
    t)
      IFS=',' read -ra TAG_ARRAY <<< "$OPTARG"
      TAGS=("${TAG_ARRAY[@]:0:20}")
      ;;
    w) WEBSITE_URL="$OPTARG" ;;
    H) SHOW_HOMEPAGE="$OPTARG" ;;
    R) SHOW_RELEASES="$OPTARG" ;;
    P) SHOW_PACKAGES="$OPTARG" ;;
    D) SHOW_DEPLOYMENTS="$OPTARG" ;;
    s) PRIVATE_REPO="$OPTARG" ;;
    z) PARALLELIZE="$OPTARG" ;;
    \?) echo "Invalid option: -$OPTARG" >&2; print_usage; exit 1 ;;
    :) echo "Option -$OPTARG requires an argument." >&2; print_usage; exit 1 ;;
  esac
done

if [[ -z "$GITHUB_USER" || -z "${DIR_ARRAY[*]}" ]]; then
  print_usage
  exit 1
fi

if [[ -n "$PROJECT_DESC" ]]; then
  echo "Truncating project description from ${#PROJECT_DESC} characters to 200"
  PROJECT_DESC="${PROJECT_DESC:0:200}"
  echo "Truncated description: $PROJECT_DESC"
fi

# * UTILITY FUNCTIONS
validate_boolean() {
  local value="$1"
  local name="$2"
  if [[ ! "$value" =~ ^(true|false)$ ]]; then
    echo "! Error: $name must be 'true' or 'false'" >&2
    exit 1
  fi
}

log_and_exit() {
  local msg="$1"
  echo "! $msg" | tee -a "$LOG_FILE"
  exit 1
}

add_topics() {
  local repo="$1"
  local tags=("${@:2}")
  if [[ ${#tags[@]} -gt 0 ]]; then
    echo "* Adding repository topics: ${tags[*]}"
    gh repo edit "$repo" $(printf -- '--add-topic "%s" ' "${tags[@]}") \
      || echo "! Failed to add some topics (may need manual addition)"
  fi
}

cleanup_branches() {
  # Remove main branch if exists, set master as default
  local repo="$1"
  if git show-ref --quiet refs/heads/main; then
    echo "🧹 Cleaning up main branch"
    git push origin --delete main 2>/dev/null || true
    git branch -D main 2>/dev/null || true
    gh api -X PATCH "repos/$repo" -f default_branch="master"
  fi
}

setup_repo_metadata() {
  local repo="$1"
  [[ -n "$PROJECT_DESC" ]] && gh repo edit "$repo" --description "$PROJECT_DESC"
  [[ -n "$WEBSITE_URL" ]] && gh repo edit "$repo" --homepage "$WEBSITE_URL"
}

configure_repo_features() {
  local repo="$1"
  if [[ "$PRIVATE_REPO" ]]; then
    echo "✨ Updating repository configuration for $repo"
    gh repo edit "$repo" \
      ${WEBSITE_URL:+--homepage "$WEBSITE_URL"} \
      ${PROJECT_DESC:+--description "$PROJECT_DESC"} \
      --enable-discussions \
      --enable-wiki
    gh api -X PATCH "repos/$repo" -f has_releases=true
    echo "✅ Repository features enabled: Releases, Discussions, Wiki"
  else
    echo "⏭️  Skipping repository configuration (PRIVATE_REPO not set)"
  fi
}

# Validate booleans
[[ -n "$SHOW_HOMEPAGE" ]] && validate_boolean "$SHOW_HOMEPAGE" "Homepage"
[[ -n "$SHOW_RELEASES" ]] && validate_boolean "$SHOW_RELEASES" "Releases"
[[ -n "$SHOW_PACKAGES" ]] && validate_boolean "$SHOW_PACKAGES" "Packages"
[[ -n "$SHOW_DEPLOYMENTS" ]] && validate_boolean "$SHOW_DEPLOYMENTS" "Deployments"
[[ -n "$PRIVATE_REPO" ]] && validate_boolean "$PRIVATE_REPO" "Private"

# Set defaults
REPO_NAME="${REPO_NAME:-$(basename "${DIR_ARRAY[0]}")}"
PROJECT_ROOT="$(pwd)"
WEBSITE_URL="${WEBSITE_URL:-https://www.cybershoptech.com}"

# Optimized error handling
handle_error() {
  local lineno=$1
  echo "! Error at line $lineno. Attempting cleanup..." | tee -a "$LOG_FILE"
  cd "$PROJECT_ROOT" || exit 1
  exit 1
}
trap 'handle_error $LINENO' ERR

# * MAIN: convert_to_submodule
convert_to_submodule() {
  echo " Converting $TARGET_DIR to submodule $REPO_NAME"
  cd "$TARGET_DIR" || log_and_exit "Could not cd to $TARGET_DIR"
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
    git branch -M master
    git push -u origin master --force
    setup_repo_metadata "$GITHUB_USER/$REPO_NAME"
    add_topics "$GITHUB_USER/$REPO_NAME" "${TAGS[@]}"
    configure_repo_features "$GITHUB_USER/$REPO_NAME"
  else
    echo "⚡ Creating new repository"
    gh repo create "$GITHUB_USER/$REPO_NAME" \
      --public \
      --source=. \
      --remote=origin \
      --push
    git branch -M master 2>/dev/null || true
    git push -u origin master --force
    cleanup_branches "$GITHUB_USER/$REPO_NAME"
    setup_repo_metadata "$GITHUB_USER/$REPO_NAME"
    add_topics "$GITHUB_USER/$REPO_NAME" "${TAGS[@]}"
    configure_repo_features "$GITHUB_USER/$REPO_NAME"
  fi
  # Optimized cleanup and push
  rm -rf .git
  git init --quiet
  git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
  git add . >/dev/null
  git commit -m "Initial submodule commit" --quiet
  git branch -M master
  git push -uf origin master >/dev/null
  cd "$PROJECT_ROOT"
  if git ls-files --error-unmatch "$TARGET_DIR" &>/dev/null; then
    echo "↪ Directory exists in Git index - removing..."
    git rm -r --cached "$TARGET_DIR"
    git commit -m "Remove existing $TARGET_DIR before submodule conversion" --quiet
  fi
  git submodule add --force "https://github.com/$GITHUB_USER/$REPO_NAME.git" "$TARGET_DIR"
  [[ -f .gitmodules ]] && git add .gitmodules
  git commit -m "Add $REPO_NAME submodule" --quiet
  echo " ✅ Successfully converted to submodule (${REPO_NAME})"
}

# * EXECUTE
if [[ "$PARALLELIZE" == true && ${#DIR_ARRAY[@]} -gt 1 ]]; then
  echo "* Running submodule conversions in parallel for: ${DIR_ARRAY[*]}"
  pids=()
  for dir in "${DIR_ARRAY[@]}"; do
    (
      TARGET_DIR="$dir"
      REPO_NAME="${REPO_NAME:-$(basename "$dir")}"
      convert_to_submodule
    ) &
    pids+=("$!")
  done
  # Wait for all background jobs
  fail=0
  for pid in "${pids[@]}"; do
    wait "$pid" || fail=1
  done
  if [[ $fail -eq 1 ]]; then
    echo "! One or more parallel conversions failed. Check logs for details."
    exit 1
  else
    echo "* All parallel submodule conversions completed successfully."
  fi
else
  for dir in "${DIR_ARRAY[@]}"; do
    TARGET_DIR="$dir"
    REPO_NAME="${REPO_NAME:-$(basename "$dir")}"
    convert_to_submodule
  done
fi

# * FINAL OUTPUT/USAGE EXAMPLES
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

cat << 'EOF'

EOF

# USAGE EXAMPLES:
# # 1. Basic public submodule
# ./subdir-to-submodule.sh -u techwithty -d path/to/dir
# # 2. Private repository with website
# ./subdir-to-submodule.sh -u techwithty -d path/to/dir -s true -w "https://example.com"
# # 3. Full featured private repo
# ./subdir-to-submodule.sh -u techwithty -d path/to/dir -r custom-name -p "Project description" -t "python,database,utils" -w "https://example.com" -H true -R true -P false -D true -s true
# # 4. Existing repo with updated settings
# ./subdir-to-submodule.sh -u techwithty -d path/to/dir -H false -R false -s false
# # 5. Parallel submodule conversion for multiple directories
# ./subdir-to-submodule.sh -u techwithty -d path/to/dir1,path/to/dir2 -z

# ./util_scripts/subdir-to-submodule.sh \
#   -u techwithty \
#   -d backend/app/core/tempo \
#   -s false \
#   -p "Tempo integration and tracing utilities for Python/FastAPI (Grafana Tempo, OpenTelemetry). Production-ready observability, mocking, and test scaffolding." \
#   -w "https://www.cybershoptech.com" \
#   -t "tracing,observability,opentelemetry,tempo,fastapi,python,distributed-tracing,monitoring,ci-cd,production-ready"