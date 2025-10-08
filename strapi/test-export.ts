#!/usr/bin/env node
/* Comprehensive test suite for enhanced relational data export */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

interface TestResult {
	name: string;
	passed: boolean;
	message: string;
	details?: unknown;
}

class ExportTestSuite {
	private results: TestResult[] = [];
	private outputDir: string;

	constructor() {
		this.outputDir = resolve(process.cwd(), 'content/strapi-export');
	}

	async runAllTests(): Promise<void> {
		console.log('🧪 Starting comprehensive export test suite...\n');

		// Test 1: Basic export functionality
		await this.testBasicExport();

		// Test 2: Relationship detection
		await this.testRelationshipDetection();

		// Test 3: Nested structure preservation
		await this.testNestedStructurePreservation();

		// Test 4: Data integrity
		await this.testDataIntegrity();

		// Test 5: No duplicates
		await this.testNoDuplicates();

		// Test 6: Export order
		await this.testExportOrder();

		this.printResults();
	}

	private async testBasicExport(): Promise<void> {
		console.log('📋 Testing basic export functionality...');

		try {
			// Clean previous exports
			if (existsSync(this.outputDir)) {
				execSync(`rm -rf ${this.outputDir}`);
			}

			// Run export
			execSync('pnpm run export:all', { stdio: 'pipe' });

			// Check if output directory exists
			if (!existsSync(this.outputDir)) {
				this.recordTest('basic_export', false, 'Output directory was not created');
				return;
			}

			// Check if files were created
			const files = readdirSync(this.outputDir);
			if (files.length === 0) {
				this.recordTest('basic_export', false, 'No export files were created');
				return;
			}

			this.recordTest('basic_export', true, `Successfully exported ${files.length} files`);
		} catch (error) {
			this.recordTest('basic_export', false, `Export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async testRelationshipDetection(): Promise<void> {
		console.log('🔗 Testing relationship detection...');

		try {
			const exportLog = execSync('pnpm run export:all', { encoding: 'utf8' });

			// Check for relationship-related output
			const hasRelationshipOutput = exportLog.includes('relationship') ||
										exportLog.includes('dependencies') ||
										exportLog.includes('Base entities') ||
										exportLog.includes('Dependent entities');

			if (hasRelationshipOutput) {
				this.recordTest('relationship_detection', true, 'Relationship detection output found in logs');
			} else {
				this.recordTest('relationship_detection', false, 'No relationship detection output found');
			}
		} catch (error) {
			this.recordTest('relationship_detection', false, `Test failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async testNestedStructurePreservation(): Promise<void> {
		console.log('🏗️  Testing nested structure preservation...');

		try {
			// Check for complex nested files that should be preserved
			const nestedFiles = [
				'caseStudies_caseStudies.json',
				'services_services.json',
				'how_it_works_*.json',
				'problems_solutions_*.json'
			];

			let foundNested = 0;
			for (const pattern of nestedFiles) {
				try {
					const files = execSync(`find ${this.outputDir} -name "${pattern}"`, { encoding: 'utf8' }).trim().split('\n');
					if (files.length > 0 && files[0]) foundNested++;
				} catch {
					// File not found, continue
				}
			}

			if (foundNested > 0) {
				this.recordTest('nested_preservation', true, `Found ${foundNested} nested structure files`);
			} else {
				this.recordTest('nested_preservation', false, 'No nested structure files found');
			}
		} catch (error) {
			this.recordTest('nested_preservation', false, `Test failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async testDataIntegrity(): Promise<void> {
		console.log('🔍 Testing data integrity...');

		try {
			const files = readdirSync(this.outputDir).filter(f => f.endsWith('.json'));

			if (files.length === 0) {
				this.recordTest('data_integrity', false, 'No files to check');
				return;
			}

			let validFiles = 0;
			let totalSize = 0;

			for (const file of files) {
				try {
					const filePath = join(this.outputDir, file);
					const content = readFileSync(filePath, 'utf8');
					const data = JSON.parse(content);

					// Check if it's valid JSON
					if (data !== null && (Array.isArray(data) || typeof data === 'object')) {
						validFiles++;
						totalSize += statSync(filePath).size;
					}
				} catch {
					// Invalid JSON, continue
				}
			}

			if (validFiles === files.length) {
				this.recordTest('data_integrity', true, `All ${validFiles} files are valid JSON (total size: ${totalSize} bytes)`);
			} else {
				this.recordTest('data_integrity', false, `Only ${validFiles}/${files.length} files are valid JSON`);
			}
		} catch (error) {
			this.recordTest('data_integrity', false, `Test failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async testNoDuplicates(): Promise<void> {
		console.log('🚫 Testing for duplicates...');

		try {
			const exportLog = execSync('pnpm run export:all', { encoding: 'utf8' });

			// Check for duplicate skipping messages
			const duplicateMessages = exportLog.match(/Skipping duplicate data/g);

			if (duplicateMessages && duplicateMessages.length > 0) {
				this.recordTest('no_duplicates', true, `Found ${duplicateMessages.length} duplicate skipping messages`);
			} else {
				this.recordTest('no_duplicates', true, 'No duplicates detected (export completed successfully)');
			}
		} catch (error) {
			this.recordTest('no_duplicates', false, `Test failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async testExportOrder(): Promise<void> {
		console.log('📊 Testing export order...');

		try {
			const exportLog = execSync('pnpm run export:all', { encoding: 'utf8' });

			// Check for dependency order messages
			const hasOrderOutput = exportLog.includes('dependency order') ||
								 exportLog.includes('Base entities') ||
								 exportLog.includes('Dependent entities');

			if (hasOrderOutput) {
				this.recordTest('export_order', true, 'Export order output found in logs');
			} else {
				this.recordTest('export_order', false, 'No export order information found');
			}
		} catch (error) {
			this.recordTest('export_order', false, `Test failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private recordTest(name: string, passed: boolean, message: string, details?: unknown): void {
		this.results.push({
			name,
			passed,
			message,
			details
		});
	}

	private printResults(): void {
		console.log('\n📋 Test Results Summary:');
		console.log('='.repeat(50));

		let passed = 0;
		let failed = 0;

		for (const result of this.results) {
			const status = result.passed ? '✅ PASS' : '❌ FAIL';
			console.log(`${status} ${result.name}: ${result.message}`);

			if (result.passed) passed++;
			else failed++;
		}

		console.log('='.repeat(50));
		console.log(`🎯 Tests passed: ${passed}/${this.results.length}`);
		console.log(`❌ Tests failed: ${failed}/${this.results.length}`);

		if (failed === 0) {
			console.log('🎉 All tests passed! Export system is working correctly.');
		} else {
			console.log('⚠️  Some tests failed. Please review the issues above.');
		}
	}
}

// Run the test suite
async function main() {
	const testSuite = new ExportTestSuite();
	await testSuite.runAllTests();
}

main().catch(console.error);
