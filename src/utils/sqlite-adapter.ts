/**
 * SQLite driver adapter: uses bun:sqlite under Bun and better-sqlite3 under Node
 * so that npm install users can run the CLI with Node.js.
 */
import type Database from 'better-sqlite3';

export type SqliteDatabase = InstanceType<typeof Database>;

export function createDatabase(path: string): SqliteDatabase {
	if (typeof (globalThis as typeof globalThis & { Bun?: unknown }).Bun !== 'undefined') {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Database } = require('bun:sqlite');
		return new Database(path) as unknown as SqliteDatabase;
	}
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const DatabaseConstructor = require('better-sqlite3') as typeof Database;
	return new DatabaseConstructor(path);
}
