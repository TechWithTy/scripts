#!/bin/bash

# Robust git push script for main repo and submodules
# Usage: ./git_push_all.sh ["commit message"]

success_count=0
failure_count=0
up_to_date_count=0
total_repos=0
untracked_count=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null)

[ -z "$ROOT_DIR" ] && { echo "Error: Not in git repo" >&2; exit 1; }
cd "$ROOT_DIR" || exit 1

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Use timestamp for unique log filename
LOG_FILE="$SCRIPT_DIR/logs/git_push_all/git_push_$(date +'%Y%m%d_%H%M%S').log"
SUBMODULES_ONLY=false
if [ "$1" = "--submodules-only" ] || [ "$1" = "-s" ]; then
    SUBMODULES_ONLY=true
    shift
fi
COMMIT_MSG="${1:-Auto commit $(date +'%Y-%m-%d %H:%M:%S')}"

echo "=== Git Operations Started $(date) ===" > "$LOG_FILE"
# One-time sync/update all submodules recursively
git submodule sync --recursive 2>&1 | tee -a "$LOG_FILE"
git submodule update --init --recursive 2>&1 | tee -a "$LOG_FILE"

# Git operations function
git_process_repo() {
    # Save original working dir; restore on function exit
    local orig_dir="$PWD"
    trap 'cd "$orig_dir"' RETURN
    local repo_path="$1"
    local repo_type="$2"
    total_repos=$((total_repos+1))
    
    echo -e "\nProcessing $repo_type: $repo_path" | tee -a "$LOG_FILE"
    
    if ! cd "$repo_path" 2>/dev/null; then
        echo "ERROR: Cannot access repo" | tee -a "$LOG_FILE"
        failure_count=$((failure_count+1))
        return 1
    fi

    # Attempt to sync broken submodule via relative path
    local rel_path="${repo_path#$ROOT_DIR/}"
    if [ -d "$repo_path" ] && ! git -C "$repo_path" rev-parse --git-dir > /dev/null 2>&1; then
        echo "INFO: Syncing submodule: $rel_path" | tee -a "$LOG_FILE"
        git -C "$ROOT_DIR" submodule sync -- "$rel_path" 2>&1 | tee -a "$LOG_FILE"
        git -C "$ROOT_DIR" submodule update --init --recursive -- "$rel_path" 2>&1 | tee -a "$LOG_FILE"
    fi

    # Skip paths that are not valid git repos (broken submodules)
    if ! git -C "$repo_path" rev-parse --git-dir > /dev/null 2>&1; then
        echo "Skipping non-git path: $repo_path" | tee -a "$LOG_FILE"
        up_to_date_count=$((up_to_date_count+1))
        return 0
    fi

    # Determine branch or commit for submodule
    local git_ref=$(git symbolic-ref -q HEAD || git rev-parse --short HEAD)

    # Detect submodule-only changes
    all_changes=$(git status --porcelain)
    ignored_changes=$(git status --porcelain --ignore-submodules=dirty)
    if [ -z "$ignored_changes" ] && [ -n "$all_changes" ]; then
        untracked_count=$((untracked_count+1))
        echo "INFO: Auto committing submodule-only changes in $repo_type" | tee -a "$LOG_FILE"
        if git add . && git commit -m "$COMMIT_MSG" && git push origin "${git_ref#refs/heads/}"; then
            success_count=$((success_count+1))
            echo "Successfully auto-updated submodule in $repo_type" | tee -a "$LOG_FILE"
        else
            failure_count=$((failure_count+1))
            echo "ERROR: Auto commit failed in $repo_type" | tee -a "$LOG_FILE"
        fi
        return 0
    fi

    # Check for changes
    if [ -z "$(git status --porcelain --ignore-submodules=dirty)" ]; then
        echo "No changes to commit" | tee -a "$LOG_FILE"
        up_to_date_count=$((up_to_date_count+1))
        return 0
    fi

    # Get branch or commit
    git_ref=$(git symbolic-ref -q HEAD || git rev-parse --short HEAD)
    echo "Git reference: $git_ref" | tee -a "$LOG_FILE"

    # Execute git operations
    if git add . && git commit -m "$COMMIT_MSG" && { [[ "$git_ref" != "HEAD"* ]] && git push origin "${git_ref#refs/heads/}"; }; then
        success_count=$((success_count+1))
        echo "Successfully updated $repo_type" | tee -a "$LOG_FILE"
    else
        failure_count=$((failure_count+1))
        echo "ERROR: Failed to update $repo_type" | tee -a "$LOG_FILE"
    fi
}

# Process main repo
if [ "$SUBMODULES_ONLY" = false ]; then
    git_process_repo "$ROOT_DIR" "main repo"
else
    echo "Skipping main repo due to submodules-only flag" | tee -a "$LOG_FILE"
fi

# Process submodules - robust parsing of .gitmodules
while IFS= read -r sub_path; do
    [ -n "$sub_path" ] && git_process_repo "$ROOT_DIR/$sub_path" "submodule"
done < <(git config --file .gitmodules --get-regexp path | awk '{print $2}')

echo -e "\n=== Git Operations Completed $(date) ===" | tee -a "$LOG_FILE"
echo -e "\n=== Summary ===" | tee -a "$LOG_FILE"
echo "Total repos: $total_repos" | tee -a "$LOG_FILE"
echo "  -Committed/Pushed: $success_count" | tee -a "$LOG_FILE"
echo "  -Up-to-date:       $up_to_date_count" | tee -a "$LOG_FILE"
echo "  -Failures:         $failure_count" | tee -a "$LOG_FILE"
echo "  -Untracked:        $untracked_count" | tee -a "$LOG_FILE"