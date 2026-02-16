import { describe, it, expect, beforeEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { Config, Note } from '../../src/types';
import { unlinkSync, existsSync } from 'fs';

describe('DatabaseManager Migration from Old Schema', () => {
  const dbPath = 'test-migration.db';
  const config: Config = {
    vaultPath: '.',
    dailyNotesFolder: 'Daily',
    templatesFolder: 'Templates',
    dbPath
  };

  beforeEach(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  it('should migrate notes from old schema to new schema', () => {
    const db = new DatabaseManager(config);

    // Create notes in old schema (notes table)
    const note1: Note = {
      id: 'hash1',
      path: 'test/note1.md',
      name: 'note1',
      extension: '.md',
      title: 'Note 1',
      content: 'Content with [[link]] and #tag',
      frontmatter: { tags: ['frontmatter-tag'] },
      tags: ['tag'],
      links: [],
      backlinks: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'hash1',
      createdAt: '2025-01-01T00:00:00.000Z',
      modifiedAt: '2025-01-02T00:00:00.000Z',
      parent: 'test',
      basename: 'note1',
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 100
      }
    };

    const note2: Note = {
      id: 'hash2',
      path: 'note2.md',
      name: 'note2',
      extension: '.md',
      title: 'Note 2',
      content: '# Heading\n\nText with ^block-id',
      frontmatter: {},
      tags: [],
      links: [],
      backlinks: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'hash2',
      createdAt: '2025-01-03T00:00:00.000Z',
      modifiedAt: '2025-01-04T00:00:00.000Z',
      stat: {
        ctime: 3000,
        mtime: 4000,
        size: 200
      }
    };

    // Insert notes into old schema
    db.upsertNote(note1);
    db.upsertNote(note2);

    // Verify notes exist in old schema
    expect(db.getNoteByPath('test/note1.md')).not.toBeNull();
    expect(db.getNoteByPath('note2.md')).not.toBeNull();

    // Verify files don't exist in new schema yet
    expect(db.getFileByPath('test/note1.md')).toBeNull();
    expect(db.getFileByPath('note2.md')).toBeNull();

    // Run migration
    const result = db.migrateFromOldSchema();

    // Verify migration statistics
    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    // Verify files exist in new schema
    const file1 = db.getFileByPath('test/note1.md');
    expect(file1).not.toBeNull();
    expect(file1?.path).toBe('test/note1.md');
    expect(file1?.name).toBe('note1.md');
    expect(file1?.basename).toBe('note1');
    expect(file1?.extension).toBe('md');
    expect(file1?.parent).toBe('test');
    expect(file1?.stat).toEqual({
      ctime: 1000,
      mtime: 2000,
      size: 100
    });

    const file2 = db.getFileByPath('note2.md');
    expect(file2).not.toBeNull();
    expect(file2?.path).toBe('note2.md');
    expect(file2?.name).toBe('note2.md');
    expect(file2?.basename).toBe('note2');
    expect(file2?.extension).toBe('md');
    expect(file2?.parent).toBeNull();

    // Verify content metadata exists
    const metadata1 = db.getContentMetadata('test/note1.md');
    expect(metadata1).not.toBeNull();
    expect(metadata1?.links).toBeDefined();
    expect(metadata1?.links?.length).toBeGreaterThan(0);
    expect(metadata1?.tags).toBeDefined();
    expect(metadata1?.tags?.length).toBeGreaterThan(0);

    const metadata2 = db.getContentMetadata('note2.md');
    expect(metadata2).not.toBeNull();
    expect(metadata2?.headings).toBeDefined();
    expect(metadata2?.headings?.length).toBeGreaterThan(0);
    expect(metadata2?.blocks).toBeDefined();
    expect(metadata2?.blocks?.length).toBeGreaterThan(0);

    db.close();
  }, 10000);

  it('should skip already migrated notes', () => {
    const db = new DatabaseManager(config);

    // Create note in old schema
    const note: Note = {
      id: 'hash1',
      path: 'test.md',
      name: 'test',
      extension: '.md',
      title: 'Test',
      content: 'Content',
      frontmatter: {},
      tags: [],
      links: [],
      backlinks: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'hash1',
      createdAt: '2025-01-01T00:00:00.000Z',
      modifiedAt: '2025-01-02T00:00:00.000Z',
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 50
      }
    };

    db.upsertNote(note);

    // Manually create file in new schema (simulating already migrated)
    const fileInfo = {
      path: 'test.md',
      name: 'test.md',
      basename: 'test',
      extension: 'md',
      parent: null,
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 50
      }
    };
    db.upsertFile(fileInfo, 'hash1');

    // Run migration
    const result = db.migrateFromOldSchema();

    // Should skip the already migrated note
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toBe(0);

    db.close();
  }, 10000);

  it('should extract positions correctly from migrated content', () => {
    const db = new DatabaseManager(config);

    const note: Note = {
      id: 'hash1',
      path: 'test.md',
      name: 'test',
      extension: '.md',
      title: 'Test',
      content: '# Heading\n\nText with [[link]] and #tag',
      frontmatter: {},
      tags: [],
      links: [],
      backlinks: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'hash1',
      createdAt: '2025-01-01T00:00:00.000Z',
      modifiedAt: '2025-01-02T00:00:00.000Z',
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 50
      }
    };

    db.upsertNote(note);
    db.migrateFromOldSchema();

    const metadata = db.getContentMetadata('test.md');
    expect(metadata).not.toBeNull();

    // Verify heading has position
    if (metadata?.headings && metadata.headings.length > 0) {
      const heading = metadata.headings[0];
      expect(heading.heading).toBe('Heading');
      expect(heading.level).toBe(1);
      expect(heading.position.start.line).toBeDefined();
      expect(heading.position.start.offset).toBeDefined();
      expect(heading.position.end.offset).toBeGreaterThan(heading.position.start.offset);
    }

    // Verify link has position
    if (metadata?.links && metadata.links.length > 0) {
      const link = metadata.links[0];
      expect(link.link).toBe('link');
      expect(link.position.start.line).toBeDefined();
      expect(link.position.start.offset).toBeDefined();
      expect(link.position.end.offset).toBeGreaterThan(link.position.start.offset);
    }

    // Verify tag has position
    if (metadata?.tags && metadata.tags.length > 0) {
      const tag = metadata.tags[0];
      expect(tag.tag).toBe('tag');
      expect(tag.position.start.line).toBeDefined();
      expect(tag.position.start.offset).toBeDefined();
      expect(tag.position.end.offset).toBeGreaterThan(tag.position.start.offset);
    }

    db.close();
  }, 10000);

  it('should handle notes without stat information', () => {
    const db = new DatabaseManager(config);

    const note: Note = {
      id: 'hash1',
      path: 'test.md',
      name: 'test',
      extension: '.md',
      title: 'Test',
      content: 'Content',
      frontmatter: {},
      tags: [],
      links: [],
      backlinks: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'hash1',
      createdAt: '2025-01-01T00:00:00.000Z',
      modifiedAt: '2025-01-02T00:00:00.000Z'
    };

    db.upsertNote(note);
    const result = db.migrateFromOldSchema();

    expect(result.migrated).toBe(1);
    expect(result.errors).toBe(0);

    const file = db.getFileByPath('test.md');
    expect(file).not.toBeNull();
    // Should use defaults for stat
    expect(file?.stat.ctime).toBeGreaterThan(0);
    expect(file?.stat.mtime).toBeGreaterThan(0);
    expect(file?.stat.size).toBeGreaterThanOrEqual(0);

    db.close();
  }, 10000);

  it('should handle notes with frontmatter correctly', () => {
    const db = new DatabaseManager(config);

    const note: Note = {
      id: 'hash1',
      path: 'test.md',
      name: 'test',
      extension: '.md',
      title: 'Test',
      content: 'Body content',
      frontmatter: {
        title: 'Frontmatter Title',
        tags: ['tag1', 'tag2']
      },
      tags: [],
      links: [],
      backlinks: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'hash1',
      createdAt: '2025-01-01T00:00:00.000Z',
      modifiedAt: '2025-01-02T00:00:00.000Z',
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 50
      }
    };

    db.upsertNote(note);
    db.migrateFromOldSchema();

    const metadata = db.getContentMetadata('test.md');
    expect(metadata).not.toBeNull();
    // Frontmatter position should be extracted
    expect(metadata?.frontmatter).toBeDefined();
    expect(metadata?.frontmatter?.position).toBeDefined();
    expect(metadata?.frontmatter?.position.start.offset).toBeDefined();
    expect(metadata?.frontmatter?.position.end.offset).toBeDefined();

    db.close();
  }, 10000);

  it('should return zero statistics when no notes exist', () => {
    const db = new DatabaseManager(config);

    const result = db.migrateFromOldSchema();

    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    db.close();
  });
});
