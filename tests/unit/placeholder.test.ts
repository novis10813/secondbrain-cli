import { describe, it, expect } from 'bun:test';
import { parseDatePlaceholder, parseTimePlaceholder, processPlaceholders } from '../../src/utils/placeholder';

// Fixed reference date: 2026-02-27 14:30:00 (Friday)
const fixedDate = new Date(2026, 1, 27, 14, 30, 0);

describe('parseDatePlaceholder', () => {
    it('should resolve DATE to YYYY-MM-DD by default', () => {
        expect(parseDatePlaceholder('DATE', fixedDate)).toBe('2026-02-27');
    });

    it('should resolve DATE:YYYY/MM/DD with custom format', () => {
        expect(parseDatePlaceholder('DATE:YYYY/MM/DD', fixedDate)).toBe('2026/02/27');
    });

    it('should resolve DATE+3 to 3 days later', () => {
        expect(parseDatePlaceholder('DATE+3', fixedDate)).toBe('2026-03-02');
    });

    it('should resolve DATE-7 to 7 days earlier', () => {
        expect(parseDatePlaceholder('DATE-7', fixedDate)).toBe('2026-02-20');
    });

    it('should resolve DATE:YYYY/MM/DD+3 with custom format and positive offset', () => {
        expect(parseDatePlaceholder('DATE:YYYY/MM/DD+3', fixedDate)).toBe('2026/03/02');
    });

    it('should resolve DATE:YYYY/MM/DD-1 with custom format and negative offset', () => {
        expect(parseDatePlaceholder('DATE:YYYY/MM/DD-1', fixedDate)).toBe('2026/02/26');
    });

    it('should support moment format tokens like dddd', () => {
        expect(parseDatePlaceholder('DATE:dddd', fixedDate)).toBe('Friday');
    });

    it('should support moment format tokens like ddd', () => {
        expect(parseDatePlaceholder('DATE:ddd', fixedDate)).toBe('Fri');
    });
});

describe('parseTimePlaceholder', () => {
    it('should resolve TIME to HH:mm by default', () => {
        expect(parseTimePlaceholder('TIME', fixedDate)).toBe('14:30');
    });

    it('should resolve TIME:HH:mm:ss with custom format', () => {
        expect(parseTimePlaceholder('TIME:HH:mm:ss', fixedDate)).toBe('14:30:00');
    });

    it('should support H:m format without padding', () => {
        const earlyTime = new Date(2026, 1, 27, 9, 5, 0);
        expect(parseTimePlaceholder('TIME:H:m', earlyTime)).toBe('9:5');
    });
});

describe('processPlaceholders', () => {
    it('should replace {{DATE}} in template', () => {
        const result = processPlaceholders('Today is {{DATE}}', { date: fixedDate });
        expect(result).toBe('Today is 2026-02-27');
    });

    it('should replace {{DATE:YYYY/MM/DD}} in template', () => {
        const result = processPlaceholders('Date: {{DATE:YYYY/MM/DD}}', { date: fixedDate });
        expect(result).toBe('Date: 2026/02/27');
    });

    it('should replace {{DATE+3}} in template', () => {
        const result = processPlaceholders('Due: {{DATE+3}}', { date: fixedDate });
        expect(result).toBe('Due: 2026-03-02');
    });

    it('should replace {{TIME}} in template', () => {
        const result = processPlaceholders('Now is {{TIME}}', { date: fixedDate });
        expect(result).toBe('Now is 14:30');
    });

    it('should replace {{TIME:HH:mm:ss}} in template', () => {
        const result = processPlaceholders('Time: {{TIME:HH:mm:ss}}', { date: fixedDate });
        expect(result).toBe('Time: 14:30:00');
    });

    it('should replace {{TITLE}}', () => {
        const result = processPlaceholders('# {{TITLE}}', { title: 'My Note' });
        expect(result).toBe('# My Note');
    });

    it('should replace {{VAULT}}', () => {
        const result = processPlaceholders('Vault: {{VAULT}}', { vault: 'my-vault' });
        expect(result).toBe('Vault: my-vault');
    });

    it('should replace {{UUID}} with a valid UUID v4 format', () => {
        const result = processPlaceholders('ID: {{UUID}}', {});
        expect(result).toMatch(/^ID: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate unique UUIDs for multiple {{UUID}} in same template', () => {
        const result = processPlaceholders('{{UUID}} vs {{UUID}}', {});
        const parts = result.split(' vs ');
        expect(parts.length).toBe(2);
        expect(parts[0]).not.toBe(parts[1]);
    });

    it('should handle multiple different built-in placeholders', () => {
        const result = processPlaceholders('{{DATE}} at {{TIME}} — {{TITLE}}', {
            date: fixedDate,
            title: 'Notes',
        });
        expect(result).toBe('2026-02-27 at 14:30 — Notes');
    });

    it('should NOT touch user-defined lowercase {{variable}} placeholders', () => {
        const result = processPlaceholders('{{name}} on {{DATE}}', { date: fixedDate });
        expect(result).toBe('{{name}} on 2026-02-27');
    });

    it('should handle mixed built-in and user variables, preserving user variable', () => {
        const result = processPlaceholders('Created: {{DATE}} by {{author}}', { date: fixedDate });
        expect(result).toBe('Created: 2026-02-27 by {{author}}');
    });

    it('should leave {{TITLE}} as-is when context.title is not provided', () => {
        const result = processPlaceholders('# {{TITLE}}', {});
        expect(result).toBe('# {{TITLE}}');
    });

    it('should leave {{VAULT}} as-is when context.vault is not provided', () => {
        const result = processPlaceholders('Vault: {{VAULT}}', {});
        expect(result).toBe('Vault: {{VAULT}}');
    });
});
