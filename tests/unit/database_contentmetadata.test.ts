import { describe, it, expect, beforeEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { Config, FileInfo, ContentMetadata } from '../../src/types';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('DatabaseManager ContentMetadata Operations', () => {
  const dbPath = join(tmpdir(), 'secondbrain-test-contentmetadata.db');
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
      parent: 'test',
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 42
      }
    };
  }

  it('should upsert and retrieve ContentMetadata with links', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      links: [
        {
          link: 'target.md',
          original: '[[target]]',
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 0, col: 10, offset: 10 }
          }
        },
        {
          link: 'other.md',
          original: '[[other|display]]',
          displayText: 'display',
          position: {
            start: { line: 1, col: 0, offset: 12 },
            end: { line: 1, col: 15, offset: 27 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.links).toHaveLength(2);
    expect(retrieved?.links?.[0].link).toBe('target.md');
    expect(retrieved?.links?.[0].original).toBe('[[target]]');
    expect(retrieved?.links?.[1].displayText).toBe('display');

    db.close();
  }, 15000);

  it('should upsert and retrieve ContentMetadata with tags', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      tags: [
        {
          tag: 'test',
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 0, col: 5, offset: 5 }
          }
        },
        {
          tag: 'important',
          position: {
            start: { line: 1, col: 0, offset: 6 },
            end: { line: 1, col: 9, offset: 15 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved?.tags).toHaveLength(2);
    expect(retrieved?.tags?.[0].tag).toBe('test');
    expect(retrieved?.tags?.[1].tag).toBe('important');

    db.close();
  }, 15000);

  it('should upsert and retrieve ContentMetadata with headings', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      headings: [
        {
          heading: 'Title',
          level: 1,
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 0, col: 7, offset: 7 }
          }
        },
        {
          heading: 'Section',
          level: 2,
          position: {
            start: { line: 2, col: 0, offset: 10 },
            end: { line: 2, col: 9, offset: 19 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved?.headings).toHaveLength(2);
    expect(retrieved?.headings?.[0].heading).toBe('Title');
    expect(retrieved?.headings?.[0].level).toBe(1);
    expect(retrieved?.headings?.[1].level).toBe(2);

    db.close();
  }, 15000);

  it('should upsert and retrieve ContentMetadata with blocks', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      blocks: [
        {
          id: 'block-123',
          position: {
            start: { line: 5, col: 0, offset: 50 },
            end: { line: 5, col: 10, offset: 60 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved?.blocks).toHaveLength(1);
    expect(retrieved?.blocks?.[0].id).toBe('block-123');

    db.close();
  }, 15000);

  it('should upsert and retrieve ContentMetadata with embeds', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      embeds: [
        {
          link: 'image.png',
          original: '![[image.png]]',
          position: {
            start: { line: 3, col: 0, offset: 30 },
            end: { line: 3, col: 14, offset: 44 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved?.embeds).toHaveLength(1);
    expect(retrieved?.embeds?.[0].link).toBe('image.png');
    expect(retrieved?.embeds?.[0].original).toBe('![[image.png]]');

    db.close();
  }, 15000);

  it('should upsert and retrieve ContentMetadata with frontmatter', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      frontmatter: {
        position: {
          start: { line: 0, col: 0, offset: 0 },
          end: { line: 3, col: 3, offset: 20 }
        }
      }
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved?.frontmatter).not.toBeUndefined();
    expect(retrieved?.frontmatter?.position.start.line).toBe(0);
    expect(retrieved?.frontmatter?.position.end.line).toBe(3);

    db.close();
  }, 15000);

  it('should update ContentMetadata when upserting again', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata1: ContentMetadata = {
      links: [
        {
          link: 'old.md',
          original: '[[old]]',
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 0, col: 8, offset: 8 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata1, 'hash123');

    const metadata2: ContentMetadata = {
      links: [
        {
          link: 'new.md',
          original: '[[new]]',
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 0, col: 8, offset: 8 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata2, 'hash456');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved?.links).toHaveLength(1);
    expect(retrieved?.links?.[0].link).toBe('new.md');

    db.close();
  }, 15000);

  it('should upsert and retrieve ContentMetadata with sections', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      sections: [
        {
          id: 'frontmatter',
          type: 'frontmatter',
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 3, col: 3, offset: 25 }
          }
        },
        {
          id: '0',
          type: 'heading',
          position: {
            start: { line: 4, col: 0, offset: 26 },
            end: { line: 10, col: 0, offset: 80 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved?.sections).toHaveLength(2);
    expect(retrieved?.sections?.[0].id).toBe('frontmatter');
    expect(retrieved?.sections?.[0].type).toBe('frontmatter');
    expect(retrieved?.sections?.[1].id).toBe('0');
    expect(retrieved?.sections?.[1].type).toBe('heading');
    expect(retrieved?.sections?.[1].position.start.line).toBe(4);
    expect(retrieved?.sections?.[1].position.end.offset).toBe(80);

    db.close();
  }, 15000);

  it('getSectionsForFile returns sections for file', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {
      sections: [
        {
          id: '0',
          type: 'content',
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 5, col: 0, offset: 50 }
          }
        }
      ]
    };

    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const sections = db.getSectionsForFile('test/note.md');

    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('0');
    expect(sections[0].type).toBe('content');
  }, 15000);

  it('getSectionsForFile returns empty array for non-existent file', () => {
    const db = new DatabaseManager(config);
    const sections = db.getSectionsForFile('nonexistent.md');
    expect(sections).toEqual([]);
    db.close();
  }, 15000);

  it('should return null for non-existent ContentMetadata', () => {
    const db = new DatabaseManager(config);
    const retrieved = db.getContentMetadata('nonexistent.md');
    expect(retrieved).toBeNull();
    db.close();
  }, 15000);

  it('should handle empty ContentMetadata', () => {
    const db = new DatabaseManager(config);
    const file = createTestFile('test/note.md');
    db.upsertFile(file, 'hash123');

    const metadata: ContentMetadata = {};
    db.upsertContentMetadata('test/note.md', metadata, 'hash123');
    const retrieved = db.getContentMetadata('test/note.md');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.links).toBeUndefined();
    expect(retrieved?.tags).toBeUndefined();

    db.close();
  }, 15000);
});
