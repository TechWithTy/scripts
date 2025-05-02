#!/bin/bash

# Script to add, commit and push changes for root repo and all submodules
# Usage: ./git_push_all.sh ["commit message"]

# Get script directory and potential root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# First try current directory, then script directory, then parent of script directory
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || 
           git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || 
           git -C "$(dirname "$SCRIPT_DIR")" rev-parse --show-toplevel 2>/dev/null)

if [ -z "$ROOT_DIR" ]; then
    echo "Error: Not in a git repository or its submodules" >&2
    exit 1
fi

# Change to root directory
cd "$ROOT_DIR" || { echo "Failed to cd to root directory" >&2; exit 1; }

LOG_FILE="$SCRIPT_DIR/git_push_all.log"

# Set default commit message if none provided
COMMIT_MSG="${1:-Auto commit at $(date)}"

echo "=== Starting git operations at $(date) ===" | tee -a "$LOG_FILE"

# Function to handle git operations for a given directory
handle_git_ops() {
    local dir="$1"
    local is_submodule="$2"
    
    echo "\nProcessing $dir" | tee -a "$LOG_FILE"
    cd "$dir" || { echo "Failed to cd to $dir" | tee -a "$LOG_FILE"; return 1; }
    
    # Get current branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    echo "Current branch: $current_branch" | tee -a "$LOG_FILE"
    
    # Add all changes
    git add .
    if [ $? -ne 0 ]; then
        echo "Failed to add changes in $dir" | tee -a "$LOG_FILE"
        return 1
    fi
    
    # Commit changes
    git commit -m "$COMMIT_MSG"
    if [ $? -ne 0 ]; then
        echo "No changes to commit in $dir" | tee -a "$LOG_FILE"
        return 0
    fi
    
    # Push changes
    git push origin "$current_branch"
    if [ $? -ne 0 ]; then
        echo "Failed to push changes in $dir" | tee -a "$LOG_FILE"
        return 1
    fi
    
    echo "Successfully pushed changes for $dir" | tee -a "$LOG_FILE"
}

# Handle root repo
handle_git_ops "$ROOT_DIR" "root"

# Handle submodules
git submodule foreach --recursive 'handle_git_ops "$toplevel/$path" "submodule"'

echo "\n=== Git operations completed at $(date) ===" | tee -a "$LOG_FILE"
