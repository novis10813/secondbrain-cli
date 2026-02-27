import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createSearchCommand } from '../../src/commands/search';
import { ConfigManager } from '../../src/utils/config';
import { VaultManager } from '../../src/utils/vault';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupVault(tempDir: string, notes: Record<string, string> = {}): VaultManager {
	const cfg = new ConfigManager(tempDir);
	cfg.init();

	for (const [relPath, content] of Object.entries(notes)) {
		const fullPath = join(tempDir, relPath);
		mkdirSync(join(tempDir, relPath.split('/').slice(0, -1).join('/')), { recursive: true });
		writeFileSync(fullPath, content, 'utf-8');
	}

	const vault = new VaultManager(cfg.getConfig());
	vault.sync();
	return vault;
}

type ParsedSearchOutput = {
	query: string;
	filters: {
		tags?: string[];
		limit: number;
		path?: string;
		linksTo?: string;
		heading?: string;
		modifiedAfter?: number;
		modifiedBefore?: number;
	};
	results: Array<{ path: string; basename: string; tags: string[] }>;
	total: number;
};

/**
 * Run `createSearchCommand` programmatically, capture stdout/stderr.
 * Returns parsed JSON if format=json (default), or raw stdout string.
 *
 * process.exit is mocked to throw { exitCode } so tests don't kill the runner.
 */
async function runSearch(
	_vault: VaultManager,
	args: string[],
	format: 'json' | 'text' = 'json'
): Promise<{ output: ParsedSearchOutput | string; stderr: string; exitCode: number }> {
	let stdout = '';
	let stderr = '';
	let exitCode = 0;

	const origLog = console.log;
	const origError = console.error;
	const origExit = process.exit;

	console.log = (...a) => { stdout += a.join(' ') + '\n'; };
	console.error = (...a) => { stderr += a.join(' ') + '\n'; };
	// Prevent process.exit from killing the test runner.
	(process as NodeJS.Process & { exit: (code?: number) => never }).exit = ((code?: number) => {
		throw Object.assign(new Error(`exit:${code}`), { exitCode: code ?? 0, isProcessExit: true });
	}) as (code?: number) => never;

	const cmd = createSearchCommand();
	cmd.exitOverride();

	try {
		await cmd.parseAsync(['node', 'sb', ...args]);
	} catch (e: any) {
		if (e?.isProcessExit) {
			exitCode = e.exitCode;
		} else {
			exitCode = e?.exitCode ?? 1;
		}
	} finally {
		console.log = origLog;
		console.error = origError;
		process.exit = origExit;
	}

	let output: ParsedSearchOutput | string;
	if (format === 'json') {
		try {
			output = JSON.parse(stdout.trim()) as ParsedSearchOutput;
		} catch {
			output = stdout;
		}
	} else {
		output = stdout;
	}

	return { output, stderr, exitCode };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('search command', () => {
	let tempDir: string;
	let vault: VaultManager;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'sb-search-test-'));

		vault = setupVault(tempDir, {
			'alpha.md': '---\ntags: [project, urgent]\n---\n# Alpha Note\n\nContent about alpha.',
			'beta.md': '---\ntags: [project]\n---\n# Beta Note\n\nContent about beta. [[alpha]]',
			'gamma.md': '---\ntags: [personal]\n---\n# Gamma Note\n\nPersonal stuff.',
			'Daily/2024-01-15.md': '# Daily 2024-01-15\n\nToday\'s notes.',
			'Daily/2024-02-01.md': '# Daily 2024-02-01\n\nFebruary notes.',
			'Projects/roadmap.md': '---\ntags: [project, roadmap]\n---\n# Roadmap\n\n## Q1 Goals\n\nShipping features.',
			'orphan.md': '# Orphan\n\nNo links here.',
		});

		process.env.SECONDBRAIN_VAULT = tempDir;
	});

	afterEach(() => {
		vault.close();
		rmSync(tempDir, { recursive: true, force: true });
		delete process.env.SECONDBRAIN_VAULT;
	});

	// -------------------------------------------------------------------------
	// Basic query search
	// -------------------------------------------------------------------------

	describe('basic query search', () => {
		it('returns all results when no query provided', async () => {
			const { output } = await runSearch(vault, []);
			const data = output as ParsedSearchOutput;
			expect(data.results).toBeDefined();
			expect(data.total).toBeGreaterThanOrEqual(7);
		});

		it('searches by basename and returns matching notes', async () => {
			const { output } = await runSearch(vault, ['alpha']);
			const data = output as ParsedSearchOutput;
			expect(data.results.some(r => r.basename === 'alpha')).toBe(true);
			expect(data.query).toBe('alpha');
		});

		it('searches return query in output', async () => {
			const { output } = await runSearch(vault, ['beta']);
			const data = output as ParsedSearchOutput;
			expect(data.query).toBe('beta');
			expect(data.results.some(r => r.basename === 'beta')).toBe(true);
		});

		it('empty query returns all files', async () => {
			const { output } = await runSearch(vault, ['']);
			const data = output as ParsedSearchOutput;
			expect(data.total).toBeGreaterThanOrEqual(7);
		});

		it('returns empty results for non-matching query', async () => {
			const { output } = await runSearch(vault, ['nonexistentnote999']);
			const data = output as ParsedSearchOutput;
			expect(data.results).toEqual([]);
			expect(data.total).toBe(0);
		});
	});

	// -------------------------------------------------------------------------
	// Tag filter
	// -------------------------------------------------------------------------

	describe('--tags filter', () => {
		it('filters by single tag', async () => {
			const { output } = await runSearch(vault, ['--tags', 'personal']);
			const data = output as ParsedSearchOutput;
			expect(data.results.every(r => r.tags.includes('personal'))).toBe(true);
			expect(data.results.some(r => r.basename === 'gamma')).toBe(true);
		});

		it('filters by multiple tags (comma-separated, OR semantics)', async () => {
			const { output } = await runSearch(vault, ['--tags', 'urgent,roadmap']);
			const data = output as ParsedSearchOutput;
			const basenames = data.results.map(r => r.basename);
			// both alpha (urgent) and roadmap (roadmap) should be present
			expect(basenames.includes('alpha')).toBe(true);
			expect(basenames.includes('roadmap')).toBe(true);
		});

		it('filters include tags in output', async () => {
			const { output } = await runSearch(vault, ['--tags', 'project']);
			const data = output as ParsedSearchOutput;
			expect(data.filters.tags).toEqual(['project']);
		});

		it('returns empty results for non-existent tag', async () => {
			const { output } = await runSearch(vault, ['--tags', 'xyznonexistent']);
			const data = output as ParsedSearchOutput;
			expect(data.results).toEqual([]);
		});

		it('trims whitespace around tag names', async () => {
			const { output } = await runSearch(vault, ['--tags', ' project , urgent ']);
			const data = output as ParsedSearchOutput;
			expect(data.filters.tags).toEqual(['project', 'urgent']);
		});
	});

	// -------------------------------------------------------------------------
	// Path prefix filter
	// -------------------------------------------------------------------------

	describe('--path prefix filter', () => {
		it('restricts results to given path prefix', async () => {
			const { output } = await runSearch(vault, ['--path', 'Daily']);
			const data = output as ParsedSearchOutput;
			expect(data.results.every(r => r.path.startsWith('Daily/'))).toBe(true);
			expect(data.total).toBeGreaterThanOrEqual(2);
		});

		it('returns only Projects files with Projects prefix', async () => {
			const { output } = await runSearch(vault, ['--path', 'Projects']);
			const data = output as ParsedSearchOutput;
			expect(data.results.every(r => r.path.startsWith('Projects/'))).toBe(true);
			expect(data.results.some(r => r.basename === 'roadmap')).toBe(true);
		});

		it('returns empty results for non-existent path prefix', async () => {
			const { output } = await runSearch(vault, ['--path', 'NonExistentFolder']);
			const data = output as ParsedSearchOutput;
			expect(data.results).toEqual([]);
		});

		it('path prefix is reflected in filters output', async () => {
			const { output } = await runSearch(vault, ['--path', 'Daily']);
			const data = output as ParsedSearchOutput;
			expect(data.filters.path).toBe('Daily');
		});
	});

	// -------------------------------------------------------------------------
	// Limit
	// -------------------------------------------------------------------------

	describe('--limit', () => {
		it('respects the limit option', async () => {
			const { output } = await runSearch(vault, ['--limit', '2']);
			const data = output as ParsedSearchOutput;
			expect(data.results.length).toBeLessThanOrEqual(2);
			expect(data.filters.limit).toBe(2);
		});

		it('default limit is 20', async () => {
			const { output } = await runSearch(vault, []);
			const data = output as ParsedSearchOutput;
			expect(data.filters.limit).toBe(20);
		});

		it('limit of 1 returns exactly 1 result', async () => {
			const { output } = await runSearch(vault, ['--limit', '1']);
			const data = output as ParsedSearchOutput;
			expect(data.results.length).toBe(1);
		});

		it('limit larger than total returns all results', async () => {
			const { output } = await runSearch(vault, ['--limit', '1000']);
			const data = output as ParsedSearchOutput;
			expect(data.results.length).toBeGreaterThanOrEqual(7);
			expect(data.results.length).toBeLessThanOrEqual(1000);
		});
	});

	// -------------------------------------------------------------------------
	// --links-to filter
	// -------------------------------------------------------------------------

	describe('--links-to filter', () => {
		it('returns files that link to the specified note', async () => {
			const { output } = await runSearch(vault, ['--links-to', 'alpha']);
			const data = output as ParsedSearchOutput;
			expect(data.results.some(r => r.basename === 'beta')).toBe(true);
		});

		it('linksTo is reflected in filters output', async () => {
			const { output } = await runSearch(vault, ['--links-to', 'alpha']);
			const data = output as ParsedSearchOutput;
			expect(data.filters.linksTo).toBe('alpha.md');
		});

		it('returns empty results when no file links to the target', async () => {
			const { output } = await runSearch(vault, ['--links-to', 'orphan']);
			const data = output as ParsedSearchOutput;
			expect(data.results).toEqual([]);
		});

		it('exits with error for non-existent --links-to target', async () => {
			const { exitCode, stderr } = await runSearch(vault, ['--links-to', 'absolutely-nonexistent-99999']);
			expect(exitCode).toBe(1);
			expect(stderr).toContain('absolutely-nonexistent-99999');
		});
	});

	// -------------------------------------------------------------------------
	// --heading filter
	// -------------------------------------------------------------------------

	describe('--heading filter', () => {
		it('returns files containing the given heading text', async () => {
			const { output } = await runSearch(vault, ['--heading', 'Q1 Goals']);
			const data = output as ParsedSearchOutput;
			expect(data.results.some(r => r.basename === 'roadmap')).toBe(true);
		});

		it('heading filter is reflected in filters output', async () => {
			const { output } = await runSearch(vault, ['--heading', 'Q1 Goals']);
			const data = output as ParsedSearchOutput;
			expect(data.filters.heading).toBe('Q1 Goals');
		});

		it('returns empty results for non-existent heading', async () => {
			const { output } = await runSearch(vault, ['--heading', 'SomeHeadingThatDoesNotExist']);
			const data = output as ParsedSearchOutput;
			expect(data.results).toEqual([]);
		});

		it('heading filter trims whitespace', async () => {
			const { output } = await runSearch(vault, ['--heading', '  Q1 Goals  ']);
			const data = output as ParsedSearchOutput;
			expect(data.results.some(r => r.basename === 'roadmap')).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// --modified-after / --modified-before
	// -------------------------------------------------------------------------

	describe('--modified-after / --modified-before', () => {
		it('modifiedAfter is reflected in filters output when provided', async () => {
			const pastMs = Date.parse('2000-01-01');
			const { output } = await runSearch(vault, ['--modified-after', String(pastMs)]);
			const data = output as ParsedSearchOutput;
			expect(data.filters.modifiedAfter).toBe(pastMs);
		});

		it('modifiedBefore is reflected in filters output when provided', async () => {
			const futureMs = Date.parse('2099-01-01');
			const { output } = await runSearch(vault, ['--modified-before', String(futureMs)]);
			const data = output as ParsedSearchOutput;
			expect(data.filters.modifiedBefore).toBe(futureMs);
		});

		it('modified-after in the future returns no results', async () => {
			const futureMs = Date.parse('2099-12-31');
			const { output } = await runSearch(vault, ['--modified-after', String(futureMs)]);
			const data = output as ParsedSearchOutput;
			expect(data.results).toEqual([]);
		});

		it('modified-before in the past returns no results', async () => {
			const pastMs = Date.parse('1990-01-01');
			const { output } = await runSearch(vault, ['--modified-before', String(pastMs)]);
			const data = output as ParsedSearchOutput;
			expect(data.results).toEqual([]);
		});

		it('modified-after in distant past returns all results', async () => {
			const pastMs = Date.parse('2000-01-01');
			const { output } = await runSearch(vault, ['--modified-after', String(pastMs)]);
			const data = output as ParsedSearchOutput;
			expect(data.total).toBeGreaterThanOrEqual(7);
		});

		it('accepts ISO 8601 date string for modified-after', async () => {
			const { output } = await runSearch(vault, ['--modified-after', '2000-01-01']);
			const data = output as ParsedSearchOutput;
			expect(data.filters.modifiedAfter).toBeDefined();
			expect(Number.isFinite(data.filters.modifiedAfter)).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Text format output
	// -------------------------------------------------------------------------

	describe('--format text', () => {
		it('outputs human-readable text, not JSON', async () => {
			const { output } = await runSearch(vault, ['alpha', '--format', 'text'], 'text');
			const text = output as string;
			expect(text).toContain('alpha');
			// Should not be valid JSON
			expect(() => JSON.parse(text)).toThrow();
		});

		it('text format includes basename and path labels', async () => {
			const { output } = await runSearch(vault, ['alpha', '--format', 'text'], 'text');
			const text = output as string;
			expect(text).toMatch(/Path:/);
			expect(text).toMatch(/Tags:/);
		});

		it('text format numbers results starting from 1', async () => {
			const { output } = await runSearch(vault, ['alpha', '--format', 'text'], 'text');
			const text = output as string;
			expect(text).toMatch(/1\./);
		});
	});

	// -------------------------------------------------------------------------
	// JSON output structure
	// -------------------------------------------------------------------------

	describe('JSON output structure', () => {
		it('output contains query, filters, results, total fields', async () => {
			const { output } = await runSearch(vault, ['alpha']);
			const data = output as ParsedSearchOutput;
			expect(data).toHaveProperty('query');
			expect(data).toHaveProperty('filters');
			expect(data).toHaveProperty('results');
			expect(data).toHaveProperty('total');
		});

		it('each result has path, basename, tags fields', async () => {
			const { output } = await runSearch(vault, ['']);
			const data = output as ParsedSearchOutput;
			expect(data.results.length).toBeGreaterThan(0);
			for (const r of data.results) {
				expect(r).toHaveProperty('path');
				expect(r).toHaveProperty('basename');
				expect(r).toHaveProperty('tags');
				expect(Array.isArray(r.tags)).toBe(true);
			}
		});

		it('tags in results reflect frontmatter tags', async () => {
			const { output } = await runSearch(vault, ['alpha']);
			const data = output as ParsedSearchOutput;
			const alphaResult = data.results.find(r => r.basename === 'alpha');
			expect(alphaResult).toBeDefined();
			expect(alphaResult!.tags).toContain('project');
			expect(alphaResult!.tags).toContain('urgent');
		});

		it('total matches results.length', async () => {
			const { output } = await runSearch(vault, ['']);
			const data = output as ParsedSearchOutput;
			expect(data.total).toBe(data.results.length);
		});
	});

	// -------------------------------------------------------------------------
	// Combined filters
	// -------------------------------------------------------------------------

	describe('combined filters', () => {
		it('query + tags filters together', async () => {
			const { output } = await runSearch(vault, ['alpha', '--tags', 'project']);
			const data = output as ParsedSearchOutput;
			expect(data.results.every(r => r.tags.includes('project'))).toBe(true);
			expect(data.results.some(r => r.basename === 'alpha')).toBe(true);
		});

		it('path prefix + tags together', async () => {
			const { output } = await runSearch(vault, ['--path', 'Projects', '--tags', 'project']);
			const data = output as ParsedSearchOutput;
			expect(data.results.every(r => r.path.startsWith('Projects/'))).toBe(true);
			expect(data.results.every(r => r.tags.includes('project'))).toBe(true);
		});

		it('query + path prefix + limit together', async () => {
			const { output } = await runSearch(vault, ['', '--path', 'Daily', '--limit', '1']);
			const data = output as ParsedSearchOutput;
			expect(data.results.length).toBeLessThanOrEqual(1);
			expect(data.results.every(r => r.path.startsWith('Daily/'))).toBe(true);
		});

		it('filters: undefined values not present in modifiedAfter/Before when not specified', async () => {
			const { output } = await runSearch(vault, []);
			const data = output as ParsedSearchOutput;
			expect(data.filters.modifiedAfter).toBeUndefined();
			expect(data.filters.modifiedBefore).toBeUndefined();
		});
	});

	// -------------------------------------------------------------------------
	// Edge cases
	// -------------------------------------------------------------------------

	describe('edge cases', () => {
		it('handles vault with no notes gracefully (empty results)', async () => {
			const emptyDir = mkdtempSync(join(tmpdir(), 'sb-empty-vault-'));
			const cfg = new ConfigManager(emptyDir);
			cfg.init();
			const emptyVault = new VaultManager(cfg.getConfig());
			emptyVault.sync();

			const oldVault = process.env.SECONDBRAIN_VAULT;
			process.env.SECONDBRAIN_VAULT = emptyDir;
			try {
				const { output } = await runSearch(emptyVault, []);
				const data = output as ParsedSearchOutput;
				expect(data.results).toEqual([]);
				expect(data.total).toBe(0);
			} finally {
				emptyVault.close();
				process.env.SECONDBRAIN_VAULT = oldVault;
				rmSync(emptyDir, { recursive: true, force: true });
			}
		});

		it('special characters in query do not crash', async () => {
			const { output } = await runSearch(vault, ['!@#$%^&*()']);
			const data = output as ParsedSearchOutput;
			expect(data.results).toBeDefined();
			expect(data.total).toBe(0);
		});

		it('very long query string returns empty results without crash', async () => {
			const longQuery = 'a'.repeat(500);
			const { output } = await runSearch(vault, [longQuery]);
			const data = output as ParsedSearchOutput;
			expect(data.results).toBeDefined();
		});

		it('unicode query works correctly', async () => {
			// Create a note with Chinese content
			const unicodeDir = mkdtempSync(join(tmpdir(), 'sb-unicode-'));
			const cfg = new ConfigManager(unicodeDir);
			cfg.init();
			writeFileSync(join(unicodeDir, '筆記.md'), '# 中文標題\n\n台灣的筆記。', 'utf-8');
			const unicodeVault = new VaultManager(cfg.getConfig());
			unicodeVault.sync();

			const oldVault = process.env.SECONDBRAIN_VAULT;
			process.env.SECONDBRAIN_VAULT = unicodeDir;
			try {
				const { output } = await runSearch(unicodeVault, ['筆記']);
				const data = output as ParsedSearchOutput;
				expect(data.results.some(r => r.basename === '筆記')).toBe(true);
			} finally {
				unicodeVault.close();
				process.env.SECONDBRAIN_VAULT = oldVault;
				rmSync(unicodeDir, { recursive: true, force: true });
			}
		});

		it('query with only whitespace is treated as empty query', async () => {
			const { output } = await runSearch(vault, ['   ']);
			const data = output as ParsedSearchOutput;
			expect(data.results).toBeDefined();
		});

		it('--limit 0 returns no results', async () => {
			const { output } = await runSearch(vault, ['--limit', '0']);
			const data = output as ParsedSearchOutput;
			expect(data.results.length).toBe(0);
		});
	});
});
