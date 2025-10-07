#!/usr/bin/env node

/**
 * Helper script to run TypeScript files directly with Node.js
 * This script registers ts-node and executes the specified TypeScript file
 */

const { register } = require('ts-node');
const path = require('node:path');

// Register ts-node to handle TypeScript files
register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    allowJs: true,
    moduleResolution: 'node',
  },
});

// Get the TypeScript file to execute from command line arguments
const tsFile = process.argv[2];

if (!tsFile) {
  console.error('❌ Error: No TypeScript file specified');
  console.error('Usage: node run-ts.js <typescript-file>');
  process.exit(1);
}

// Resolve the file path relative to the project root
const projectRoot = path.resolve(__dirname, '..');
const absolutePath = path.isAbsolute(tsFile) ? tsFile : path.resolve(projectRoot, tsFile);

console.log(`🔄 Executing TypeScript file: ${absolutePath}`);

// Execute the TypeScript file by requiring it
try {
  require(absolutePath);
} catch (error) {
  console.error('❌ Error executing TypeScript file:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}
