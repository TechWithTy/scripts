// Lightweight ts-node bootstrapper to run TS scripts reliably on Windows
const path = require('node:path');
const { register } = require('ts-node');

const project = path.resolve(__dirname, 'tsconfig.scripts.json');
register({
  project,
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/run-ts.js <script.ts> [args...]');
  process.exit(1);
}

require(path.resolve(process.cwd(), target));
