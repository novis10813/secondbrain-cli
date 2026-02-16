import { describe, it, expect } from 'bun:test';
import { join } from 'path';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');
const CLI_ENTRY = join(PROJECT_ROOT, 'src', 'index.ts');

const EXPECTED_COMMANDS = [
	'init',
	'capture',
	'search',
	'get',
	'backlinks',
	'sync',
	'stats',
	'orphans',
	'config',
];

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn([ 'bun', 'run', CLI_ENTRY, ...args ], {
		cwd: PROJECT_ROOT,
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
});
