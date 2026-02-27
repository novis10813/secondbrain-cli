import moment from 'moment';
import type { PlaceholderContext } from '../types/index.js';

/**
 * Parse a DATE placeholder token and return the formatted date string.
 *
 * Supported formats:
 *   DATE             → default 'YYYY-MM-DD'
 *   DATE:format      → custom moment format
 *   DATE+N / DATE-N  → offset by N days, default format
 *   DATE:format+N    → custom format + day offset
 */
export function parseDatePlaceholder(token: string, baseDate: Date): string {
    // Strip leading 'DATE'
    const rest = token.slice(4); // e.g. '', ':YYYY/MM/DD', '+3', ':YYYY/MM/DD+3'

    let fmt = 'YYYY-MM-DD';
    let offset = 0;

    if (rest === '') {
        // plain {{DATE}}
    } else if (rest.startsWith(':')) {
        // has custom format; offset may follow after the format as +N or -N
        // We need to find if there's an offset at the end: match trailing [+-]\d+
        const offsetMatch = rest.match(/([+-]\d+)$/);
        if (offsetMatch) {
            offset = parseInt(offsetMatch[1], 10);
            fmt = rest.slice(1, rest.length - offsetMatch[1].length);
        } else {
            fmt = rest.slice(1);
        }
    } else {
        // no custom format, just offset: +N or -N
        offset = parseInt(rest, 10);
    }

    const m = moment(baseDate).add(offset, 'days');
    return m.format(fmt);
}

/**
 * Parse a TIME placeholder token and return the formatted time string.
 *
 * Supported formats:
 *   TIME          → default 'HH:mm'
 *   TIME:format   → custom moment format
 */
export function parseTimePlaceholder(token: string, baseDate: Date): string {
    const rest = token.slice(4); // strip 'TIME'

    const fmt = rest.startsWith(':') ? rest.slice(1) : 'HH:mm';
    return moment(baseDate).format(fmt);
}

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID if available (Node 15+ / Bun), otherwise falls back to manual generation.
 */
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback: manual RFC4122 v4 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Process all built-in placeholders in a template string.
 *
 * Built-in placeholders (uppercase keywords):
 *   {{DATE}}          → today's date (YYYY-MM-DD)
 *   {{DATE:format}}   → custom moment format
 *   {{DATE+N}}        → N days from today
 *   {{DATE:format+N}} → custom format + offset
 *   {{TIME}}          → current time (HH:mm)
 *   {{TIME:format}}   → custom moment format
 *   {{TITLE}}         → context.title (left as-is if not provided)
 *   {{VAULT}}         → context.vault (left as-is if not provided)
 *   {{UUID}}          → random UUID v4 (unique per occurrence)
 *
 * User-defined lowercase {{variable}} placeholders are NOT touched.
 */
export function processPlaceholders(template: string, context: PlaceholderContext): string {
    const baseDate = context.date ?? new Date();

    // Match every {{...}} in the template; decide per-match whether it's built-in
    return template.replace(/\{\{([^}]+)\}\}/g, (match, inner: string) => {
        const token = inner.trim();

        if (token === 'DATE' || token.startsWith('DATE:') || /^DATE[+-]\d+/.test(token)) {
            return parseDatePlaceholder(token, baseDate);
        }

        if (token === 'TIME' || token.startsWith('TIME:')) {
            return parseTimePlaceholder(token, baseDate);
        }

        if (token === 'TITLE') {
            return context.title !== undefined ? context.title : match;
        }

        if (token === 'VAULT') {
            return context.vault !== undefined ? context.vault : match;
        }

        if (token === 'UUID') {
            return generateUUID();
        }

        // Not a built-in placeholder — preserve as-is for user variable handling
        return match;
    });
}
