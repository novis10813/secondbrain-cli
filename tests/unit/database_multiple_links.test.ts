import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ContentMetadata } from '../../src/types/index';

describe('Database Multiple Links (Issue #2)', () => {
    let tempDir: string;
    let db: DatabaseManager;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'sb-db-links-test-'));
        db = new DatabaseManager(join(tempDir, 'index.db'));
        db.initTables();
    });

    afterEach(() => {
        db.close();
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('should store multiple links to the same target', () => {
        const filePath = 'source.md';
        db.upsertFile({
            path: filePath,
            name: 'source',
            basename: 'source',
            extension: 'md',
            stat: {
                size: 100,
                mtime: Date.now(),
                ctime: Date.now(),
            },
            content_hash: 'hash'
        });

        const metadata: ContentMetadata = {
            links: [
                {
                    link: 'target',
                    original: '[[target]]',
                    position: {
                        start: { line: 1, col: 1, offset: 0 },
                        end: { line: 1, col: 10, offset: 9 }
                    }
                },
                {
                    link: 'target',
                    original: '[[target]]',
                    position: {
                        start: { line: 2, col: 1, offset: 20 },
                        end: { line: 2, col: 10, offset: 29 }
                    }
                }
            ],
            tags: [],
            headings: [],
            blocks: [],
            embeds: []
        };

        db.upsertContentMetadata(filePath, metadata, 'hash');

        const retrieved = db.getContentMetadata(filePath);
        expect(retrieved.links).toHaveLength(2);
        expect(retrieved.links[0].link).toBe('target');
        expect(retrieved.links[1].link).toBe('target');
        expect(retrieved.links[0].position.start.line).toBe(1);
        expect(retrieved.links[1].position.start.line).toBe(2);
    });
});
