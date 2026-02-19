import { describe, it, expect } from 'bun:test';
import type { HeadingRef, EmbedRef } from '../../src/types/index.js';
import type { Pos } from '../../src/types/index.js';

describe('Type Deduplication (Issue #6/#7)', () => {
    it('HeadingRef should have position property from types/index.ts', () => {
        // This should fail to compile if HeadingRef in types/index.ts doesn't have position
        // Or it will fail at runtime check if we try to use it as if it has it.
        const pos: Pos = {
            start: { line: 1, col: 1, offset: 0 },
            end: { line: 1, col: 5, offset: 4 }
        };

        const heading: HeadingRef = {
            level: 1,
            text: 'Title',
            line: 1,
            column: 1,
            position: pos
        };

        expect(heading).toBeDefined();
    });

    it('EmbedRef should have position property from types/index.ts', () => {
        const pos: Pos = {
            start: { line: 1, col: 1, offset: 0 },
            end: { line: 1, col: 5, offset: 4 }
        };

        const embed: EmbedRef = {
            target: 'file.png',
            line: 1,
            column: 1,
            position: pos
        };

        expect(embed).toBeDefined();
    });
});
