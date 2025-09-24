#!/usr/bin/env node
/*
 Optional submodule guard.
 This script will NO-OP unless a .gitmodules file exists at repo root.
 If present, it will run `git submodule sync --recursive` and
 `git submodule update --init --recursive`.
*/
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

try {
  if (!existsSync('.gitmodules')) {
    // No submodules configured; nothing to do.
    process.exit(0);
  }
  console.log('[postinstall] .gitmodules detected -> syncing/updating submodules');
  const sync = spawnSync('git', ['submodule', 'sync', '--recursive'], { stdio: 'inherit' });
  if (sync.status !== 0) {
    console.warn('[postinstall] git submodule sync failed (continuing)');
  }
  const update = spawnSync('git', ['submodule', 'update', '--init', '--recursive'], { stdio: 'inherit' });
  if (update.status !== 0) {
    console.warn('[postinstall] git submodule update failed (continuing)');
  }
} catch (err) {
  console.warn('[postinstall] submodule step skipped due to error:', err?.message || err);
  // Continue without failing installation
  process.exit(0);
}
