import { describe, it, expect } from 'bun:test';
import { parseDateOption } from '../../src/commands/search';

describe('search parseDateOption', () => {
	it('returns undefined for undefined', () => {
		expect(parseDateOption(undefined)).toBeUndefined();
	});

	it('returns undefined for empty string', () => {
		expect(parseDateOption('')).toBeUndefined();
	});

	it('parses numeric string as unix ms', () => {
		const ms = 1704067200000; // 2024-01-01 00:00:00 UTC
		expect(parseDateOption(String(ms))).toBe(ms);
	});

	it('parses ISO 8601 date string', () => {
		const result = parseDateOption('2024-01-15');
		expect(result).toBeDefined();
		expect(Number.isFinite(result)).toBe(true);
		expect(result).toBe(Date.parse('2024-01-15'));
	});

	it('trims whitespace', () => {
		const result = parseDateOption('  2024-06-01  ');
		expect(result).toBeDefined();
		expect(result).toBe(Date.parse('2024-06-01'));
	});

	it('returns undefined for invalid numeric string', () => {
		expect(parseDateOption('not-a-number')).toBeUndefined();
	});

	it('returns undefined for invalid date string', () => {
		expect(parseDateOption('not-a-date')).toBeUndefined();
	});
});
