#!/bin/bash

# Robust git push script for main repo and submodules
# Usage: ./git_push_all.sh ["commit message"]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null)

[ -z "$ROOT_DIR" ] && { echo "Error: Not in git repo" >&2; exit 1; }
cd "$ROOT_DIR" || exit 1

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Use timestamp for unique log filename
LOG_FILE="$SCRIPT_DIR/logs/git_push_$(date +'%Y%m%d_%H%M%S').log"
COMMIT_MSG="${1:-Auto commit $(date +'%Y-%m-%d %H:%M:%S')}"

echo "=== Git Operations Started $(date) ===" > "$LOG_FILE"

# Git operations function
git_process_repo() {
    local repo_path="$1"
    local repo_type="$2"
    
    echo -e "\nProcessing $repo_type: $repo_path" | tee -a "$LOG_FILE"
    
    if ! cd "$repo_path" 2>/dev/null; then
        echo "ERROR: Cannot access repo" | tee -a "$LOG_FILE"
        return 1
    fi

    # Check for changes
    if [ -z "$(git status --porcelain)" ]; then
        echo "No changes to commit" | tee -a "$LOG_FILE"
        return 0
    fi

    # Get branch or commit
    local git_ref=$(git symbolic-ref -q HEAD || git rev-parse --short HEAD)
    echo "Git reference: $git_ref" | tee -a "$LOG_FILE"

    # Execute git operations
    git add . && \
    git commit -m "$COMMIT_MSG" && \
    { [[ "$git_ref" != "HEAD"* ]] && git push origin "${git_ref#refs/heads/}"; true; } && \
    echo "Successfully updated $repo_type" | tee -a "$LOG_FILE"
}

# Process main repo
git_process_repo "$ROOT_DIR" "main repo"

# Process submodules - robust parsing of .gitmodules
while IFS= read -r sub_path; do
    [ -n "$sub_path" ] && git_process_repo "$ROOT_DIR/$sub_path" "submodule"
done < <(git config --file .gitmodules --get-regexp path | awk '{print $2}')

echo -e "\n=== Git Operations Completed $(date) ===" | tee -a "$LOG_FILE"