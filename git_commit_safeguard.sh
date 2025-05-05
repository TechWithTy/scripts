#!/bin/bash
# Advanced Git Commit Safeguard Script
# Features: dry-run mode, backup of all changed files before pushing, robust logging, and safety checks.

set -euo pipefail

# --- CONFIG ---
DRY_RUN=false
BACKUP_DIR="$HOME/git_commit_backups/$(date +'%Y%m%d_%H%M%S')"
LOG_FILE="$(pwd)/git_commit_safeguard_$(date +'%Y%m%d_%H%M%S').log"
COMMIT_MSG="Auto commit $(date +'%Y-%m-%d %H:%M:%S')"

# --- PARSE ARGS ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    -m|--message)
      COMMIT_MSG="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

mkdir -p "$BACKUP_DIR"
echo "[INFO] Log file: $LOG_FILE" | tee "$LOG_FILE"
echo "[INFO] Backup directory: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "[INFO] Dry-run mode: $DRY_RUN" | tee -a "$LOG_FILE"

git status --short | tee -a "$LOG_FILE"

# --- BACKUP CHANGED FILES ---
changed_files=$(git diff --name-only)
cached_files=$(git diff --cached --name-only)
all_files=$(echo -e "$changed_files\n$cached_files" | sort | uniq)

if [[ -n "$all_files" ]]; then
  echo "[INFO] Backing up changed files..." | tee -a "$LOG_FILE"
  while read -r file; do
    if [[ -f "$file" ]]; then
      backup_path="$BACKUP_DIR/$file"
      mkdir -p "$(dirname "$backup_path")"
      cp "$file" "$backup_path"
      echo "[BACKUP] $file -> $backup_path" | tee -a "$LOG_FILE"
    fi
  done <<< "$all_files"
else
  echo "[INFO] No changed files to backup." | tee -a "$LOG_FILE"
fi

# --- DRY RUN ---
if $DRY_RUN; then
  echo "[DRY RUN] Would stage, commit, and push the following files:" | tee -a "$LOG_FILE"
  echo "$all_files" | tee -a "$LOG_FILE"
  exit 0
fi

# --- COMMIT & PUSH ---
if [[ -n "$all_files" ]]; then
  git add .
  git commit -m "$COMMIT_MSG"
  git push
  echo "[SUCCESS] Changes committed and pushed." | tee -a "$LOG_FILE"
else
  echo "[INFO] No changes to commit." | tee -a "$LOG_FILE"
fi

echo "[DONE] See log: $LOG_FILE"
