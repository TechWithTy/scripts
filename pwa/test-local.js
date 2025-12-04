#!/usr/bin/env node
/**
 * PWA Local Testing Helper
 * 
 * This script helps you test PWA features locally by:
 * 1. Building the app for production
 * 2. Starting the production server
 * 3. Opening the browser with helpful DevTools instructions
 * 
 * Usage: node scripts/pwa/test-local.js
 * Or add to package.json: "test:pwa:local": "node scripts/pwa/test-local.js"
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
	console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
	console.log('\n');
	log(`${'='.repeat(60)}`, colors.cyan);
	log(`  ${title}`, colors.bright + colors.cyan);
	log(`${'='.repeat(60)}`, colors.cyan);
	console.log('');
}

async function runCommand(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		log(`Running: ${command} ${args.join(' ')}`, colors.blue);
		
		const proc = spawn(command, args, {
			stdio: 'inherit',
			shell: true,
			...options,
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Command failed with code ${code}`));
			}
		});

		proc.on('error', reject);
	});
}

function printInstructions() {
	logSection('PWA Testing Instructions');
	
	log('The production server is now running at:', colors.green);
	log('  → http://localhost:3000', colors.bright + colors.green);
	console.log('');
	
	log('How to test PWA features:', colors.yellow);
	console.log('');
	
	log('1️⃣  Test Offline Banner:', colors.magenta);
	log('   • Open DevTools (F12)');
	log('   • Go to Network tab');
	log('   • Check "Offline" checkbox');
	log('   • Banner should appear');
	log('   • Click Dismiss - should hide for 5 minutes');
	log('   • Uncheck "Offline" - banner auto-hides');
	console.log('');
	
	log('2️⃣  Test Service Worker:', colors.magenta);
	log('   • DevTools → Application tab');
	log('   • Click "Service Workers" in sidebar');
	log('   • Should see registered worker');
	log('   • Check "Offline" and navigate - pages should cache');
	console.log('');
	
	log('3️⃣  Test Install Prompt:', colors.magenta);
	log('   • After 3 visits or engagement');
	log('   • Install banner should appear');
	log('   • Click to install as PWA');
	console.log('');
	
	log('4️⃣  Test localStorage Persistence:', colors.magenta);
	log('   • DevTools → Application → Local Storage');
	log('   • Look for "offline-banner-dismissed"');
	log('   • Dismiss banner and verify key appears');
	console.log('');
	
	log('📚 Full guide at: _docs/pwa/LOCAL_TESTING_GUIDE.md', colors.cyan);
	console.log('');
	log('Press Ctrl+C to stop the server', colors.yellow);
	console.log('');
}

async function main() {
	try {
		logSection('Building Production Bundle');
		log('This will take a minute...', colors.yellow);
		await runCommand('pnpm', ['build']);
		
		log('\n✅ Build complete!', colors.green);
		
		logSection('Starting Production Server');
		log('Server will start on port 3000...', colors.yellow);
		
		// Print instructions before starting server (since server blocks)
		printInstructions();
		
		// Start the server (this will block until Ctrl+C)
		await runCommand('pnpm', ['start']);
		
	} catch (error) {
		log(`\n❌ Error: ${error.message}`, colors.red);
		process.exit(1);
	}
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
	log('\n\n👋 Shutting down...', colors.yellow);
	process.exit(0);
});

main();

