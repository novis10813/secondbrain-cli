import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { VaultManager } from '../../src/utils/vault';
import { ConfigManager } from '../../src/utils/config';
import type { Config, FileInfo, ContentMetadata } from '../../src/types';
import { mkdtempSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Position-based navigation', () => {
  describe('DatabaseManager.getHeadingPosition', () => {
    const dbPath = 'test-open-position.db';
    const config: Config = {
      vaultPath: '.',
      dailyNotesFolder: 'Daily',
      templatesFolder: 'Templates',
      dbPath
    };

    beforeEach(() => {
      if (existsSync(dbPath)) unlinkSync(dbPath);
    });

    function createTestFile(path: string): FileInfo {
      return {
        path,
        name: 'note.md',
        basename: 'note',
        extension: 'md',
        parent: null,
        stat: { ctime: 1000, mtime: 2000, size: 100 }
      };
    }

    it('returns position for exact heading text match', () => {
      const db = new DatabaseManager(config);
      db.upsertFile(createTestFile('doc.md'), 'h1');
      const meta: ContentMetadata = {
        headings: [
          {
            heading: 'Introduction',
            level: 1,
            position: {
              start: { line: 1, col: 1, offset: 0 },
              end: { line: 1, col: 14, offset: 13 }
            }
          }
        ]
      };
      db.upsertContentMetadata('doc.md', meta, 'h1');

      const pos = db.getHeadingPosition('doc.md', 'Introduction');
      expect(pos).toEqual({ line: 1, col: 1 });
      db.close();
    }, 15000);

    it('returns position for slug match (Obsidian-style)', () => {
      const db = new DatabaseManager(config);
      db.upsertFile(createTestFile('doc.md'), 'h1');
      const meta: ContentMetadata = {
        headings: [
          {
            heading: 'My Section Title',
            level: 2,
            position: {
              start: { line: 3, col: 1, offset: 20 },
              end: { line: 3, col: 18, offset: 37 }
            }
          }
        ]
      };
      db.upsertContentMetadata('doc.md', meta, 'h1');

      expect(db.getHeadingPosition('doc.md', 'my-section-title')).toEqual({ line: 3, col: 1 });
      db.close();
    }, 15000);

    it('returns null when heading not found', () => {
      const db = new DatabaseManager(config);
      db.upsertFile(createTestFile('doc.md'), 'h1');
      const meta: ContentMetadata = {
        headings: [{ heading: 'Only', level: 1, position: { start: { line: 1, col: 1, offset: 0 }, end: { line: 1, col: 4, offset: 3 } } }]
      };
      db.upsertContentMetadata('doc.md', meta, 'h1');

      expect(db.getHeadingPosition('doc.md', 'Missing')).toBeNull();
      expect(db.getHeadingPosition('other.md', 'Only')).toBeNull();
      db.close();
    }, 15000);
  });

  describe('DatabaseManager.getBlockPosition', () => {
    const dbPath = 'test-open-block.db';
    const config: Config = {
      vaultPath: '.',
      dailyNotesFolder: 'Daily',
      templatesFolder: 'Templates',
      dbPath
    };

    beforeEach(() => {
      if (existsSync(dbPath)) unlinkSync(dbPath);
    });

    function createTestFile(path: string): FileInfo {
      return {
        path,
        name: 'note.md',
        basename: 'note',
        extension: 'md',
        parent: null,
        stat: { ctime: 1000, mtime: 2000, size: 100 }
      };
    }

    it('returns position for block id', () => {
      const db = new DatabaseManager(config);
      db.upsertFile(createTestFile('note.md'), 'h1');
      const meta: ContentMetadata = {
        blocks: [
          {
            id: 'abc-123',
            position: {
              start: { line: 5, col: 1, offset: 80 },
              end: { line: 7, col: 1, offset: 120 }
            }
          }
        ]
      };
      db.upsertContentMetadata('note.md', meta, 'h1');

      const pos = db.getBlockPosition('note.md', 'abc-123');
      expect(pos).toEqual({ line: 5, col: 1 });
      db.close();
    }, 15000);

    it('returns null when block or file missing', () => {
      const db = new DatabaseManager(config);
      db.upsertFile(createTestFile('note.md'), 'h1');
      const meta: ContentMetadata = {
        blocks: [{ id: 'x', position: { start: { line: 1, col: 1, offset: 0 }, end: { line: 1, col: 1, offset: 0 } } }]
      };
      db.upsertContentMetadata('note.md', meta, 'h1');

      expect(db.getBlockPosition('note.md', 'nonexistent')).toBeNull();
      expect(db.getBlockPosition('other.md', 'x')).toBeNull();
      db.close();
    }, 15000);
  });

  describe('VaultManager.resolveLinkToPosition', () => {
    let tempDir: string;
    let vault: VaultManager;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'sb-open-test-'));
      const configManager = new ConfigManager(tempDir);
      const config = configManager.init();
      vault = new VaultManager(config);
    });

    afterEach(() => {
      vault.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('resolves link without fragment to line 1:1', async () => {
      writeFileSync(join(tempDir, 'note.md'), '# Note\n\nContent');
      await vault.sync();

      const result = vault.resolveLinkToPosition('note', '');
      expect(result).not.toBeNull();
      expect(result!.path).toBe('note.md');
      expect(result!.line).toBe(1);
      expect(result!.col).toBe(1);
    });

    it('resolves link with heading fragment to heading position', async () => {
      writeFileSync(
        join(tempDir, 'doc.md'),
        '# Title\n\nIntro.\n\n## Section One\n\nFirst.\n\n## Section Two\n\nSecond.'
      );
      await vault.sync();

      const one = vault.resolveLinkToPosition('doc#Section One', '');
      expect(one).not.toBeNull();
      expect(one!.path).toBe('doc.md');
      expect(one!.line).toBeGreaterThan(1);

      const slug = vault.resolveLinkToPosition('doc#section-one', '');
      expect(slug).not.toBeNull();
      expect(slug!.path).toBe('doc.md');
    });

    it('resolves link with block fragment to block position', async () => {
      writeFileSync(
        join(tempDir, 'blocks.md'),
        '# Blocks\n\nParagraph one.\n\nTarget line here ^my-block\n\nMore text.'
      );
      await vault.sync();

      const result = vault.resolveLinkToPosition('blocks#^my-block', '');
      expect(result).not.toBeNull();
      expect(result!.path).toBe('blocks.md');
      expect(result!.line).toBeGreaterThanOrEqual(1);
    });

    it('returns null for non-existent link', () => {
      const result = vault.resolveLinkToPosition('nonexistent-note-xyz', '');
      expect(result).toBeNull();
    });
  });
});
