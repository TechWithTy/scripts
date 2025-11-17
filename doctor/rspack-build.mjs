#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  process.env.RS_DOCTOR = '1';
  // Prefer dedicated doctor config for rsbuild to ensure plugin + clean dist
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const doctorConfig = resolve(__dirname, '../../tools/rspack-preview/rsbuild.doctor.config.ts');
  try {
    await run('pnpm', ['dlx', '@rsbuild/core', 'build', '-c', doctorConfig]);
  } catch (e) {
    // Fallback: try project script, then generic rsbuild
    try {
      const pkgPath = resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const hasScript = pkg.scripts && pkg.scripts['build:rspack'];
      if (hasScript) {
        await run('pnpm', ['run', 'build:rspack']);
      } else {
        await run('pnpm', ['dlx', '@rsbuild/core', 'build']);
      }
    } catch {
      await run('pnpm', ['dlx', '@rsbuild/core', 'build']);
    }
  }
  await run('npx', ['@rsdoctor/cli', 'start', '--open']);
}

main().catch((e) => {
  console.error('[doctor:rspack] Failed:', e.message);
  process.exit(1);
});
