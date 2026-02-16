import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');
const CLI_ENTRY = join(PROJECT_ROOT, 'src', 'index.ts');
const README_PATH = join(PROJECT_ROOT, 'README.md');

const EXPECTED_COMMANDS = [
	'init',
	'capture',
	'search',
	'get',
	'backlinks',
	'outlinks',
	'open',
	'sync',
	'stats',
	'orphans',
	'config',
	'migrate',
];

async function runCli(
	args: string[],
	cwd: string = PROJECT_ROOT
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn([ 'bun', 'run', CLI_ENTRY, ...args ], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [ stdout, stderr ] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;
	return { exitCode, stdout, stderr };
}

describe('CLI commands', () => {
	it('shows help and lists all commands when run with --help', async () => {
		const { exitCode, stdout } = await runCli([ '--help' ]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain('Commands:');
		for (const name of EXPECTED_COMMANDS) {
			expect(stdout).toContain(name);
		}
	});

	it('each registered command shows help without error', async () => {
		for (const cmd of EXPECTED_COMMANDS) {
			const { exitCode, stderr } = await runCli([ cmd, '--help' ]);
			expect(exitCode, `sb ${cmd} --help should exit 0`).toBe(0);
			expect(stderr, `sb ${cmd} --help should not write to stderr`).toBe('');
		}
	});

	it('README documents all CLI commands', () => {
		const readme = readFileSync(README_PATH, 'utf-8');
		for (const cmd of EXPECTED_COMMANDS) {
			expect(
				readme.includes(`sb ${cmd}`) || readme.includes(` ${cmd} `),
				`README should document 'sb ${cmd}'`
			).toBe(true);
		}
	});
});

describe('CLI integration (init, sync, get, search)', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'sb-cli-int-'));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('init creates .secondbrain and config', async () => {
		const { exitCode, stdout, stderr } = await runCli([ 'init', '-p', tempDir ]);
		expect(exitCode).toBe(0);
		expect(stderr).toBe('');
		expect(stdout).toContain('SecondBrain vault initialized');
		expect(stdout).toContain('Vault path:');
		expect(existsSync(join(tempDir, '.secondbrain', 'config.json'))).toBe(true);
	});

	it('sync indexes notes and get returns note content', async () => {
		await runCli([ 'init', '-p', tempDir ]);
		writeFileSync(join(tempDir, 'hello.md'), '# Hello\n\nWorld.', 'utf-8');

		const syncResult = await runCli([ 'sync' ], tempDir);
		expect(syncResult.exitCode).toBe(0);

		const getResult = await runCli([ 'get', 'hello', '-f', 'json' ], tempDir);
		expect(getResult.exitCode).toBe(0);
		const out = JSON.parse(getResult.stdout);
		expect(out.path).toBe('hello.md');
		expect(out.title).toBe('Hello');
		expect(out.content).toContain('World');
	});

	it('search returns indexed notes', async () => {
		await runCli([ 'init', '-p', tempDir ]);
		writeFileSync(join(tempDir, 'alpha.md'), '# Alpha\n\nContent.', 'utf-8');
		writeFileSync(join(tempDir, 'beta.md'), '# Beta\n\nContent.', 'utf-8');
		await runCli([ 'sync' ], tempDir);

		const { exitCode, stdout } = await runCli([ 'search', 'alpha', '-f', 'json' ], tempDir);
		expect(exitCode).toBe(0);
		const data = JSON.parse(stdout);
		expect(data.results).toBeDefined();
		expect(data.results.length).toBeGreaterThanOrEqual(1);
		expect(data.results.some((r: { basename: string }) => r.basename === 'alpha')).toBe(true);
	});

	it('get by path and by basename both resolve', async () => {
		await runCli([ 'init', '-p', tempDir ]);
		writeFileSync(join(tempDir, 'resolve.md'), '# Resolve\n\nBody.', 'utf-8');
		await runCli([ 'sync' ], tempDir);

		const byPath = await runCli([ 'get', 'resolve.md', '-f', 'text' ], tempDir);
		const byBasename = await runCli([ 'get', 'resolve', '-f', 'text' ], tempDir);
		expect(byPath.exitCode).toBe(0);
		expect(byBasename.exitCode).toBe(0);
		expect(byPath.stdout).toContain('Resolve');
		expect(byBasename.stdout).toContain('Resolve');
	});

	it('init twice reports already initialized', async () => {
		await runCli([ 'init', '-p', tempDir ]);
		const { exitCode, stdout } = await runCli([ 'init', '-p', tempDir ]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain('already initialized');
	});
});
