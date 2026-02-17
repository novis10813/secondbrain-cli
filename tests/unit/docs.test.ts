import { describe, it, expect } from 'bun:test';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');
const DOCS_DIR = join(PROJECT_ROOT, 'docs');

const DETAIL_DOCS = [
	{ file: 'README.md', mustContain: 'Documentation' },
	{ file: 'architecture.md', mustContain: 'Directory structure' },
	{ file: 'modules.md', mustContain: 'Utils' },
	{ file: 'database-schema.md', mustContain: 'files' },
];

describe('Documentation', () => {
	it('detail doc files exist and have expected content', () => {
		for (const { file, mustContain } of DETAIL_DOCS) {
			const path = join(DOCS_DIR, file);
			expect(existsSync(path), `${file} should exist`).toBe(true);
			const content = readFileSync(path, 'utf-8');
			expect(content.length, `${file} should be non-empty`).toBeGreaterThan(0);
			expect(content, `${file} should contain "${mustContain}"`).toContain(mustContain);
		}
	});
});
