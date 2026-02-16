import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import type { Config, FileInfo } from '../../src/types/index';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function createTestFile(path: string): FileInfo {
	return {
		path,
		name: path.split('/').pop() ?? 'note.md',
		basename: path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'note',
		extension: 'md',
		parent: path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : null,
		stat: { ctime: 1000, mtime: 2000, size: 42 }
	};
}

describe('Database files performance', () => {
	const fileCount = 200;
	let db: DatabaseManager;
	let tempDir: string;

	beforeAll(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'secondbrain-files-perf-'));
		const dbPath = join(tempDir, 'test.db');
		const config: Config = {
			vaultPath: tempDir,
			dbPath,
			dailyNotesFolder: 'daily',
			templatesFolder: 'templates'
		};
		db = new DatabaseManager(config);
		const files = Array.from({ length: fileCount }, (_, i) => ({
			file: createTestFile(`folder/note-${i}.md`),
			contentHash: `hash-${i}`
		}));
		db.upsertFilesBatch(files);
	});

	afterAll(() => {
		db.close();
		rmSync(tempDir, { recursive: true });
	});

	it('upsertFilesBatch(200) completes within acceptable time', () => {
		const tempDir2 = mkdtempSync(join(tmpdir(), 'secondbrain-files-perf2-'));
		const dbPath = join(tempDir2, 'test.db');
		const config: Config = {
			vaultPath: tempDir2,
			dbPath,
			dailyNotesFolder: 'daily',
			templatesFolder: 'templates'
		};
		const db2 = new DatabaseManager(config);
		const files = Array.from({ length: fileCount }, (_, i) => ({
			file: createTestFile(`folder/note-${i}.md`),
			contentHash: `hash-${i}`
		}));
		const start = performance.now();
		db2.upsertFilesBatch(files);
		const elapsed = performance.now() - start;
		db2.close();
		rmSync(tempDir2, { recursive: true });
		expect(elapsed).toBeLessThan(500);
	});

	it('searchFiles over 200 files completes within acceptable time', () => {
		const start = performance.now();
		const results = db.searchFiles('note', undefined, 50);
		const elapsed = performance.now() - start;
		expect(results.length).toBeGreaterThan(0);
		expect(elapsed).toBeLessThan(150);
	});
});
