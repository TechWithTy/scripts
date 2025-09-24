#!/usr/bin/env node
/*
 Recursively remove nested node_modules folders inside external/**
 Useful after removing submodules or vendor projects to stop pnpm warnings
 like: "Moving typescript that was installed by a different package manager to node_modules/.ignored"
*/
const { existsSync, rmSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

const EXTERNAL_DIR = path.join(process.cwd(), 'external');

function removeNestedNodeModules(dir) {
  if (!existsSync(dir)) return 0;
  let removed = 0;
  const entries = readdirSync(dir);
  for (const name of entries) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules') {
        try {
          rmSync(p, { recursive: true, force: true });
          console.log(`[clean:external] removed ${p}`);
          removed += 1;
          continue;
        } catch (e) {
          console.warn(`[clean:external] failed to remove ${p}:`, e?.message || e);
        }
      }
      removed += removeNestedNodeModules(p);
    }
  }
  return removed;
}

(function main() {
  if (!existsSync(EXTERNAL_DIR)) {
    console.log('[clean:external] no external/ directory found, nothing to do.');
    return;
  }
  const total = removeNestedNodeModules(EXTERNAL_DIR);
  console.log(`[clean:external] done. Removed ${total} nested node_modules folder(s).`);
})();
