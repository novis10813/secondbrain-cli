import { describe, it, expect, beforeEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { Config, FileInfo, ContentMetadata } from '../../src/types';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('DatabaseManager Batch Operations', () => {
  const dbPath = join(tmpdir(), 'secondbrain-test-batch.db');
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
      name: `${path.split('/').pop()}`,
      basename: path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'note',
      extension: 'md',
      parent: path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : null,
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 42
      }
    };
  }

  it('should upsert multiple files in batch', () => {
    const db = new DatabaseManager(config);
    const files = [
      { file: createTestFile('test/note1.md'), contentHash: 'hash1' },
      { file: createTestFile('test/note2.md'), contentHash: 'hash2' },
      { file: createTestFile('test/note3.md'), contentHash: 'hash3' }
    ];

    db.upsertFilesBatch(files);

    expect(db.getFileByPath('test/note1.md')).not.toBeNull();
    expect(db.getFileByPath('test/note2.md')).not.toBeNull();
    expect(db.getFileByPath('test/note3.md')).not.toBeNull();

    const file1 = db.getFileByPath('test/note1.md');
    expect(file1?.path).toBe('test/note1.md');
    expect(file1?.basename).toBe('note1');

    db.close();
  }, 15000);

  it('should handle empty batch for files', () => {
    const db = new DatabaseManager(config);
    db.upsertFilesBatch([]);
    // Should not throw
    db.close();
  }, 15000);

  it('should upsert multiple ContentMetadata in batch', () => {
    const db = new DatabaseManager(config);
    const files = [
      { file: createTestFile('test/note1.md'), contentHash: 'hash1' },
      { file: createTestFile('test/note2.md'), contentHash: 'hash2' }
    ];
    db.upsertFilesBatch(files);

    const metadataItems = [
      {
        filePath: 'test/note1.md',
        metadata: {
          links: [
            {
              link: 'target1.md',
              original: '[[target1]]',
              position: {
                start: { line: 0, col: 0, offset: 0 },
                end: { line: 0, col: 11, offset: 11 }
              }
            }
          ]
        } as ContentMetadata,
        contentHash: 'hash1'
      },
      {
        filePath: 'test/note2.md',
        metadata: {
          tags: [
            {
              tag: 'test',
              position: {
                start: { line: 0, col: 0, offset: 0 },
                end: { line: 0, col: 5, offset: 5 }
              }
            }
          ]
        } as ContentMetadata,
        contentHash: 'hash2'
      }
    ];

    db.upsertContentMetadataBatch(metadataItems);

    const metadata1 = db.getContentMetadata('test/note1.md');
    expect(metadata1?.links).toHaveLength(1);
    expect(metadata1?.links?.[0].link).toBe('target1.md');

    const metadata2 = db.getContentMetadata('test/note2.md');
    expect(metadata2?.tags).toHaveLength(1);
    expect(metadata2?.tags?.[0].tag).toBe('test');

    db.close();
  }, 15000);

  it('should handle empty batch for ContentMetadata', () => {
    const db = new DatabaseManager(config);
    db.upsertContentMetadataBatch([]);
    // Should not throw
    db.close();
  }, 15000);

  it('should handle large batch operations', () => {
    const db = new DatabaseManager(config);
    const files = Array.from({ length: 100 }, (_, i) => ({
      file: createTestFile(`test/note${i}.md`),
      contentHash: `hash${i}`
    }));

    db.upsertFilesBatch(files);

    for (let i = 0; i < 100; i++) {
      const file = db.getFileByPath(`test/note${i}.md`);
      expect(file).not.toBeNull();
      expect(file?.path).toBe(`test/note${i}.md`);
    }

    db.close();
  }, 15000);
});
