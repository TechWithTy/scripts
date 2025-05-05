#!/bin/bash
# Advanced Git Commit Safeguard Script
# Features: dry-run mode, backup of all changed files before pushing, robust logging, safety checks, and parallelization.
#
# --- Usage Examples ---
#
# 1. Dry run (no changes made, just show what would happen):
#     bash util_scripts/git_commit_safeguard.sh --dry-run
#
# 2. Commit with custom message and backup:
#     bash util_scripts/git_commit_safeguard.sh -m "my safe commit"
#
# 3. Custom backup directory:
#     bash util_scripts/git_commit_safeguard.sh --backup-dir /tmp/my_git_backups
#
# 4. Skip parent directory, only commit subdirectories:
#     bash util_scripts/git_commit_safeguard.sh --skip-parent --subdirs backend/app/core/valkey backend/app/core/redis
#
# 5. All options combined:
#     bash util_scripts/git_commit_safeguard.sh --dry-run -m "test commit" --backup-dir /tmp/backups --skip-parent --subdirs sub1 sub2
#
# 6. Parallel mode (run subdir commits in background for speed):
#     bash util_scripts/git_commit_safeguard.sh --skip-parent --subdirs sub1 sub2 --parallel
#
# 7. Full combo (all features, parallel):
#     bash util_scripts/git_commit_safeguard.sh --dry-run --skip-parent --subdirs backend/app/core/valkey backend/app/core/redis --parallel -m "batch commit" --backup-dir /tmp/batch_backups
#
# You can enable parallel mode with --parallel. This will run subdir commits in background jobs.
# Example:
#   bash util_scripts/git_commit_safeguard.sh --skip-parent --subdirs sub1 sub2 --parallel
# Or use GNU parallel for more advanced control.
#   parallel git_commit_safeguard.sh ::: submodule1 submodule2
#
# [WARN] In parallel mode, summary counts may be inaccurate due to concurrency.

# --- Summary ---
# - Backs up all changed files before any commit/push.
# - Supports dry-run mode for safe preview.
# - Logs all actions to a unique log file.
# - Circuit breaker: aborts if more than 3 consecutive git push failures (prevents repeated errors).
# - Parallel mode: use --parallel for faster subdir commits (summary counts may be inaccurate).
# - Can be extended for advanced parallelization (see notes at end).

set -euo pipefail

# --- CONFIG ---
DRY_RUN=false
BACKUP_TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_DIR="$HOME/git_commit_backups/$BACKUP_TIMESTAMP"
OVERWRITE_BACKUP=false
LOG_FILE="$(pwd)/git_commit_safeguard_$(date +'%Y%m%d_%H%M%S').log"
COMMIT_MSG="Auto commit $(date +'%Y-%m-%d %H:%M:%S')"
CIRCUIT_BREAKER_LIMIT=3
circuit_breaker_count=0
SKIP_PARENT=false
SUBDIRS=()
PARALLEL=false

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
    --overwrite)
      OVERWRITE_BACKUP=true
      shift
      ;;
    -m|--message)
      COMMIT_MSG="$2"
      shift 2
      ;;
    --skip-parent)
      SKIP_PARENT=true
      shift
      ;;
    --subdirs)
      shift
      while [[ $# -gt 0 && ! $1 =~ ^- ]]; do
        SUBDIRS+=("$1")
        shift
      done
      ;;
    --parallel)
      PARALLEL=true
      shift
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
echo "[INFO] Skip parent: $SKIP_PARENT" | tee -a "$LOG_FILE"
echo "[INFO] Subdirs: ${SUBDIRS[*]}" | tee -a "$LOG_FILE"
echo "[INFO] Parallel mode: $PARALLEL" | tee -a "$LOG_FILE"

# --- FUNCTION: Commit and push a directory ---
commit_and_push_dir() {
  local dir="$1"
  pushd "$dir" > /dev/null
  local changed_files cached_files all_files
  changed_files=$(git diff --name-only)
  cached_files=$(git diff --cached --name-only)
  all_files=$(echo -e "$changed_files\n$cached_files" | sort | uniq)

  # --- Backup logic ---
  local backup_base
  if $OVERWRITE_BACKUP; then
    # Use subdir name only, so backup is always overwritten
    if [[ "$dir" == "." ]]; then
      backup_base="$HOME/git_commit_backups/parent"
    else
      backup_base="$HOME/git_commit_backups/$(basename "$dir")"
    fi
  else
    # Use subdir name + timestamp for unique backups
    if [[ "$dir" == "." ]]; then
      backup_base="$HOME/git_commit_backups/parent_$BACKUP_TIMESTAMP"
    else
      backup_base="$HOME/git_commit_backups/$(basename "$dir")_$BACKUP_TIMESTAMP"
    fi
  fi
  mkdir -p "$backup_base"

  if [[ -n "$all_files" ]]; then
    echo "[INFO] Backing up changed files in $dir..." | tee -a "$LOG_FILE"
    for file in $all_files; do
      if [[ -f "$file" ]]; then
        backup_path="$backup_base/$file"
        mkdir -p "$(dirname "$backup_path")"
        cp -r "$file" "$backup_path"
        echo "[BACKUP] $file -> $backup_path" | tee -a "$LOG_FILE"
      elif [[ -d "$file" ]]; then
        backup_path="$backup_base/$file"
        mkdir -p "$(dirname "$backup_path")"
        cp -r "$file" "$backup_path"
        echo "[BACKUP] $file/ -> $backup_path/ (directory)" | tee -a "$LOG_FILE"
      fi
    done
  else
    echo "[INFO] No changed files to backup in $dir." | tee -a "$LOG_FILE"
  fi

  # Dry run
  if $DRY_RUN; then
    echo "[DRY RUN] Would stage, commit, and push the following files in $dir:" | tee -a "$LOG_FILE"
    echo "$all_files" | tee -a "$LOG_FILE"
    popd > /dev/null
    return 0
  fi

  # Commit & Push
  if [[ -n "$all_files" ]]; then
    git add .
    local msg="$COMMIT_MSG"
    # If this is a subdir commit, append the dir name
    if [[ "$dir" != "." ]]; then
      msg="$msg ($dir)"
    fi
    git commit -m "$msg"
    for attempt in {1..$CIRCUIT_BREAKER_LIMIT}; do
      if git push; then
        echo "[SUCCESS] Changes committed and pushed for $dir." | tee -a "$LOG_FILE"
        break
      else
        circuit_breaker_count=$((circuit_breaker_count+1))
        echo "[ERROR] git push failed (attempt $attempt) for $dir." | tee -a "$LOG_FILE"
        if [[ $circuit_breaker_count -ge $CIRCUIT_BREAKER_LIMIT ]]; then
          echo "[CIRCUIT BREAKER] Too many push failures for $dir. Aborting further attempts." | tee -a "$LOG_FILE"
          popd > /dev/null
          exit 1
        fi
        sleep 2
      fi
    done
  else
    echo "[INFO] No changes to commit in $dir." | tee -a "$LOG_FILE"
  fi
  popd > /dev/null
}

# --- MAIN LOGIC ---
if $SKIP_PARENT; then
  if [[ ${#SUBDIRS[@]} -eq 0 ]]; then
    echo "[ERROR] --skip-parent specified but no --subdirs given!" | tee -a "$LOG_FILE"
    exit 1
  fi
  if [[ "$PARALLEL" == "true" ]]; then
    echo "[WARN] Parallel mode enabled: commit/push operations will run in background. Summary counts may be inaccurate due to concurrency." | tee -a "$LOG_FILE"
    pids=()
    for subdir in "${SUBDIRS[@]}"; do
      if [[ -d "$subdir/.git" ]]; then
        commit_and_push_dir "$subdir" &
        pids+=("$!")
      else
        echo "[WARN] $subdir is not a git repo, skipping." | tee -a "$LOG_FILE"
      fi
    done
    # Wait for all background jobs
    for pid in "${pids[@]}"; do
      wait "$pid"
    done
  else
    for subdir in "${SUBDIRS[@]}"; do
      if [[ -d "$subdir/.git" ]]; then
        commit_and_push_dir "$subdir"
      else
        echo "[WARN] $subdir is not a git repo, skipping." | tee -a "$LOG_FILE"
      fi
    done
  fi
else
  # Parent directory
  commit_and_push_dir "."
fi

echo "[DONE] See log: $LOG_FILE"
