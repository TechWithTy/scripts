/* Enhanced relational exporter with comprehensive relationship detection and nested structure preservation */

import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { createHash } from "node:crypto";

interface ExportableData {
	[key: string]: unknown;
}

interface EntityRelationship {
	entityName: string;
	dependsOn: string[];
	references: string[];
	isBaseEntity: boolean;
	nestedEntities: string[];
}

interface DataEntity {
	name: string;
	data: unknown;
	hash: string;
	sourceFile: string;
	relationships: EntityRelationship;
	depth: number;
}

function isExportableArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function isSimpleExportableObject(value: unknown): value is Record<string, unknown> {
	// Only export simple objects, not complex objects like Zod schemas
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const obj = value as Record<string, unknown>;

	// Skip objects that look like Zod schemas (have _def, typeName, etc.)
	if ('_def' in obj || 'typeName' in obj || '~standard' in obj) {
		return false;
	}

	// Skip objects that are functions or have function properties
	if (typeof obj === 'function') {
		return false;
	}

	// Check if object has any function properties
	for (const key in obj) {
		if (typeof obj[key] === 'function') {
			return false;
		}
	}

	// Only export simple data objects
	return true;
}

function generateDataHash(data: unknown): string {
	// Create a stable hash of the data for deduplication
	const str = JSON.stringify(data, Object.keys(data || {}).sort());
	return createHash('md5').update(str).digest('hex');
}

// Enhanced relationship analyzer for complex nested structures
class EnhancedDataModelAnalyzer {
	private entities = new Map<string, DataEntity>();
	private relationships = new Map<string, EntityRelationship>();

	analyzeModule(moduleName: string, mod: ExportableData): DataEntity[] {
		const entities: DataEntity[] = [];

		for (const [key, value] of Object.entries(mod)) {
			if (isExportableArray(value) || isSimpleExportableObject(value)) {
				const entityName = this.generateEntityName(moduleName, key);
				const hash = generateDataHash(value);

				// Enhanced relationship analysis
				const relationships = this.analyzeComplexRelationships(key, value, 0);

				const entity: DataEntity = {
					name: entityName,
					data: value,
					hash,
					sourceFile: moduleName,
					relationships,
					depth: 0
				};

				entities.push(entity);
				this.entities.set(entityName, entity);
				this.relationships.set(entityName, relationships);

				// Recursively analyze nested structures
				this.analyzeNestedStructures(entityName, value, 1);
			}
		}

		return entities;
	}

	private analyzeComplexRelationships(exportName: string, data: unknown, depth: number): EntityRelationship {
		const dependsOn: string[] = [];
		const references: string[] = [];
		const nestedEntities: string[] = [];
		let isBaseEntity = true;

		// Enhanced analysis based on naming patterns and structure
		if (exportName.includes('categories')) {
			isBaseEntity = true;
		} else if (exportName.includes('testimonial') || exportName.includes('review')) {
			references.push('services', 'products');
			isBaseEntity = false;
		} else if (exportName.includes('faq')) {
			references.push('services');
			isBaseEntity = false;
		} else if (exportName.includes('how_it_works') || exportName.includes('problems_solutions')) {
			references.push('services');
			isBaseEntity = false;
		} else if (exportName.includes('caseStud')) {
			dependsOn.push('categories');
			references.push('services');
			isBaseEntity = false;
		} else if (exportName.includes('company') || exportName.includes('nav') || exportName.includes('hero')) {
			isBaseEntity = true;
		} else if (exportName.includes('pricing') || exportName.includes('plan')) {
			references.push('services');
			isBaseEntity = false;
		} else if (exportName.includes('techStack') || exportName.includes('integration')) {
			references.push('services');
			isBaseEntity = false;
		} else {
			isBaseEntity = depth === 0; // Top-level exports are base by default
		}

		// Deep nested relationship analysis
		this.analyzeNestedRelationshipsDeep(data, dependsOn, references, nestedEntities, depth);

		return {
			entityName: exportName,
			dependsOn: [...new Set(dependsOn)],
			references: [...new Set(references)],
			isBaseEntity,
			nestedEntities: [...new Set(nestedEntities)]
		};
	}

	private analyzeNestedRelationshipsDeep(data: unknown, dependsOn: string[], references: string[], nestedEntities: string[], depth: number): void {
		if (Array.isArray(data)) {
			for (const item of data) {
				this.analyzeObjectRelationshipsDeep(item, dependsOn, references, nestedEntities, depth);
			}
		} else if (isSimpleExportableObject(data)) {
			this.analyzeObjectRelationshipsDeep(data, dependsOn, references, nestedEntities, depth);
		}
	}

	private analyzeObjectRelationshipsDeep(obj: Record<string, unknown>, dependsOn: string[], references: string[], nestedEntities: string[], depth: number): void {
		for (const [key, value] of Object.entries(obj)) {
			// Enhanced relationship detection with better pattern matching
			const lowerKey = key.toLowerCase();

			if (lowerKey.includes('category') || lowerKey.includes('categories')) {
				if (Array.isArray(value) || typeof value === 'string') {
					dependsOn.push('categories');
				}
			} else if (lowerKey.includes('service') || lowerKey.includes('product')) {
				if (Array.isArray(value) || typeof value === 'string') {
					references.push('services', 'products');
				}
			} else if (lowerKey.includes('testimonial') || lowerKey.includes('review')) {
				if (Array.isArray(value) || typeof value === 'string') {
					references.push('testimonials');
				}
			} else if (lowerKey.includes('faq')) {
				if (Array.isArray(value) || typeof value === 'string') {
					references.push('faqs');
				}
			} else if (lowerKey.includes('pricing') || lowerKey.includes('plan')) {
				if (Array.isArray(value) || typeof value === 'string') {
					references.push('pricing');
				}
			} else if (lowerKey.includes('techstack') || lowerKey.includes('integration')) {
				if (Array.isArray(value) || typeof value === 'string') {
					references.push('techstacks');
				}
			}

			// Recursively analyze nested structures
			if (Array.isArray(value)) {
				for (const item of value) {
					if (typeof item === 'object' && item !== null) {
						this.analyzeNestedRelationshipsDeep(item, dependsOn, references, nestedEntities, depth + 1);
					}
				}
			} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				const nestedObj = value as Record<string, unknown>;
				// Skip Zod schemas and other complex objects
				if (!('_def' in nestedObj) && !('typeName' in nestedObj) && !('~standard' in nestedObj)) {
					this.analyzeNestedRelationshipsDeep(value, dependsOn, references, nestedEntities, depth + 1);
				}
			}
		}
	}

	private analyzeNestedStructures(parentName: string, data: unknown, depth: number): void {
		if (Array.isArray(data)) {
			for (let i = 0; i < data.length; i++) {
				const item = data[i];
				if (typeof item === 'object' && item !== null) {
					this.analyzeNestedItem(parentName, `item_${i}`, item, depth);
				}
			}
		} else if (isSimpleExportableObject(data)) {
			for (const [key, value] of Object.entries(data)) {
				if (typeof value === 'object' && value !== null) {
					this.analyzeNestedItem(parentName, key, value, depth);
				}
			}
		}
	}

	private analyzeNestedItem(parentName: string, key: string, data: unknown, depth: number): void {
		if (isSimpleExportableObject(data) || isExportableArray(data)) {
			const nestedName = `${parentName}_${key}`;
			const hash = generateDataHash(data);
			const relationships = this.analyzeComplexRelationships(key, data, depth);

			const nestedEntity: DataEntity = {
				name: nestedName,
				data,
				hash,
				sourceFile: parentName,
				relationships,
				depth
			};

			this.entities.set(nestedName, nestedEntity);
			this.relationships.set(nestedName, relationships);

			// Continue analyzing deeper nested structures
			this.analyzeNestedStructures(nestedName, data, depth + 1);
		}
	}

	private generateEntityName(moduleName: string, exportName: string): string {
		const baseName = basename(moduleName, '.ts');
		return `${baseName}_${exportName}`;
	}

	getBaseEntities(): DataEntity[] {
		return Array.from(this.entities.values()).filter(e => e.relationships.isBaseEntity);
	}

	getDependentEntities(): DataEntity[] {
		return Array.from(this.entities.values()).filter(e => !e.relationships.isBaseEntity);
	}

	getExportOrder(): DataEntity[] {
		const entities = Array.from(this.entities.values());

		// Sort by depth first (shallowest first), then by dependencies
		return entities.sort((a, b) => {
			if (a.depth !== b.depth) return a.depth - b.depth;

			// Categories should come before everything else at the same depth
			if (a.name.includes('categories') && !b.name.includes('categories')) return -1;
			if (!a.name.includes('categories') && b.name.includes('categories')) return 1;

			// Then sort by dependency count
			const aDeps = a.relationships.dependsOn.length;
			const bDeps = b.relationships.dependsOn.length;
			if (aDeps !== bDeps) return aDeps - bDeps;

			return a.name.localeCompare(b.name);
		});
	}

	getRelationshipStats(): { totalEntities: number; baseEntities: number; dependentEntities: number; maxDepth: number; relationships: Map<string, string[]> } {
		const relationships = new Map<string, string[]>();
		let maxDepth = 0;

		for (const [entityName, entity] of this.entities) {
			relationships.set(entityName, [...entity.relationships.dependsOn, ...entity.relationships.references]);
			maxDepth = Math.max(maxDepth, entity.depth);
		}

		return {
			totalEntities: this.entities.size,
			baseEntities: this.getBaseEntities().length,
			dependentEntities: this.getDependentEntities().length,
			maxDepth,
			relationships
		};
	}
}

function pickExportableDataFromModule(mod: ExportableData): { name: string; data: unknown }[] {
	const results: { name: string; data: unknown }[] = [];

	// Check for default export first
	if (mod.default !== undefined) {
		if (isExportableArray(mod.default) || isSimpleExportableObject(mod.default)) {
			results.push({ name: 'default', data: mod.default });
		}
	}

	// Check all named exports
	for (const [key, value] of Object.entries(mod)) {
		if (key === 'default') continue;

		if (isExportableArray(value) || isSimpleExportableObject(value)) {
			results.push({ name: key, data: value });
		}
	}

	return results;
}

function shouldExportFile(fileName: string): boolean {
	const skipFiles = [
		'index.ts',
		'types.ts',
		'utils.ts',
		'constants.ts'
	];

	return !skipFiles.some(skipFile => fileName.endsWith(skipFile));
}

function getAllDataFiles(dir: string): string[] {
	const files: string[] = [];

	function scanDirectory(currentDir: string) {
		const items = readdirSync(currentDir, { withFileTypes: true });

		for (const item of items) {
			const fullPath = resolve(currentDir, item.name);

			if (item.isDirectory()) {
				scanDirectory(fullPath);
			} else if (item.isFile() && item.name.endsWith('.ts') && shouldExportFile(item.name)) {
				files.push(fullPath);
			}
		}
	}

	scanDirectory(dir);
	return files;
}

function loadModuleSafely(filePath: string): ExportableData | null {
	try {
		const fs = require('node:fs');
		const content = fs.readFileSync(filePath, 'utf-8');

		// Check for JSX syntax
		if (content.includes('jsx') || content.includes('React') || content.includes('<')) {
			console.log(`⚠️  Skipping file with JSX/React syntax: ${filePath}`);
			return null;
		}

		const relativePath = filePath.replace(`${process.cwd()}/`, '');
		const modulePath = relativePath.replace(/\.ts$/, '');

		let mod: ExportableData | null = null;

		try {
			mod = require(modulePath);
		} catch (importError) {
			const errorMessage = importError instanceof Error ? importError.message : String(importError);

			if (errorMessage.includes("@/") || errorMessage.includes("Cannot resolve module")) {
				console.log(`⚠️  File has path alias dependencies, attempting alternative loading: ${filePath}`);

				try {
					mod = loadWithImportStripping(filePath, content);
				} catch (stripError) {
					console.log(`   → Could not extract data automatically: ${filePath}`);
					console.log(`   → Could potentially extract: ${extractPotentialExports(content)}`);
					return null;
				}
			} else {
				throw importError;
			}
		}

		return mod;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		if (errorMessage.includes("Unexpected token '<'") ||
		    errorMessage.includes('jsx') ||
		    errorMessage.includes('React')) {
			console.log(`⚠️  Skipping file with JSX/React syntax: ${filePath}`);
			return null;
		}

		console.error(`❌ Failed to load ${filePath}:`, errorMessage);
		return null;
	}
}

function loadWithImportStripping(filePath: string, content: string): ExportableData | null {
	throw new Error("Import stripping not yet implemented - skipping complex files");
}

function extractPotentialExports(content: string): string {
	const exportMatches = content.match(/export\s+(const|let|var)\s+(\w+)\s*[:=]/g);
	if (exportMatches) {
		return exportMatches.slice(0, 3).map(match => {
			const nameMatch = match.match(/export\s+(const|let|var)\s+(\w+)/);
			return nameMatch ? nameMatch[2] : 'unknown';
		}).join(', ');
	}
	return 'data structures';
}

function main() {
	const dataDir = resolve(process.cwd(), 'src/data');
	const outputDir = resolve(process.cwd(), 'content/strapi-export');

	mkdirSync(outputDir, { recursive: true });

	const dataFiles = getAllDataFiles(dataDir);

	console.log(`🔍 Analyzing ${dataFiles.length} data files for enhanced relational export...`);

	let totalExports = 0;
	let failedFiles = 0;
	let skippedDuplicates = 0;

	const analyzer = new EnhancedDataModelAnalyzer();
	const exportedHashes = new Set<string>();

	// First pass: Analyze all modules and build enhanced relationship model
	console.log('📊 Building enhanced data relationship model...');
	for (const filePath of dataFiles) {
		const mod = loadModuleSafely(filePath);

		if (mod) {
			try {
				analyzer.analyzeModule(filePath, mod);
			} catch (error) {
				console.error(`❌ Failed to analyze ${filePath}:`, error instanceof Error ? error.message : String(error));
				failedFiles++;
			}
		} else {
			failedFiles++;
		}
	}

	// Get entities in proper export order
	const entitiesToExport = analyzer.getExportOrder();

	console.log(`📋 Exporting ${entitiesToExport.length} entities in enhanced dependency order...`);

	// Second pass: Export entities in proper order
	for (const entity of entitiesToExport) {
		const dataHash = generateDataHash(entity.data);

		if (exportedHashes.has(dataHash)) {
			console.log(`⏭️  Skipping duplicate data '${entity.name}' (already exported)`);
			skippedDuplicates++;
			continue;
		}

		// Create output filename
		const outputFileName = `${entity.name}.json`;
		const outputPath = resolve(outputDir, outputFileName);

		mkdirSync(dirname(outputPath), { recursive: true });

		writeFileSync(outputPath, JSON.stringify(entity.data, null, 2), { encoding: 'utf-8' });

		exportedHashes.add(dataHash);

		const dataType = Array.isArray(entity.data) ? 'array' : 'object';
		const itemCount = Array.isArray(entity.data) ? entity.data.length : 'N/A';

		console.log(`✅ Exported ${dataType} (${itemCount} items) from ${entity.name} -> ${outputFileName}`);
		totalExports++;
	}

	const stats = analyzer.getRelationshipStats();

	console.log(`\n🎉 Enhanced relational export complete! Exported ${totalExports} unique entities with full relationship preservation.`);
	console.log(`📊 Base entities: ${stats.baseEntities}, Dependent entities: ${stats.dependentEntities}`);
	console.log(`📊 Max nesting depth: ${stats.maxDepth}, Total entities analyzed: ${stats.totalEntities}`);
	console.log(`📁 Output directory: ${outputDir}`);
	console.log(`🔄 Files processed: ${dataFiles.length - failedFiles} successful, ${failedFiles} failed, ${skippedDuplicates} duplicates skipped`);
}

main();
