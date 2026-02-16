import { describe, it, expect, beforeEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { Config, FileInfo, ContentMetadata } from '../../src/types';
import { unlinkSync, existsSync } from 'fs';

describe('DatabaseManager FileInfo Operations', () => {
  const dbPath = 'test-fileinfo.db';
  const config: Config = {
    vaultPath: '.',
    dailyNotesFolder: 'Daily',
    templatesFolder: 'Templates',
    dbPath
  };

  beforeEach(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  it('should upsert and retrieve a FileInfo', () => {
    const db = new DatabaseManager(config);
    const file: FileInfo = {
      path: 'test/note.md',
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

    db.upsertFile(file, 'hash123');
    const retrieved = db.getFileByPath('test/note.md');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.path).toBe('test/note.md');
    expect(retrieved?.name).toBe('note.md');
    expect(retrieved?.basename).toBe('note');
    expect(retrieved?.extension).toBe('md');
    expect(retrieved?.parent).toBe('test');
    expect(retrieved?.stat).toEqual({
      ctime: 1000,
      mtime: 2000,
      size: 42
    });

    db.close();
  }, 15000);

  it('should update FileInfo when upserting again', () => {
    const db = new DatabaseManager(config);
    const file1: FileInfo = {
      path: 'test/note.md',
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

    db.upsertFile(file1, 'hash123');

    const file2: FileInfo = {
      path: 'test/note.md',
      name: 'note.md',
      basename: 'note',
      extension: 'md',
      parent: 'test',
      stat: {
        ctime: 1000,
        mtime: 3000,
        size: 100
      }
    };

    db.upsertFile(file2, 'hash456');
    const retrieved = db.getFileByPath('test/note.md');

    expect(retrieved?.stat.mtime).toBe(3000);
    expect(retrieved?.stat.size).toBe(100);

    db.close();
  }, 15000);

  it('should return null for non-existent file', () => {
    const db = new DatabaseManager(config);
    const retrieved = db.getFileByPath('nonexistent.md');
    expect(retrieved).toBeNull();
    db.close();
  }, 15000);

  it('should delete a file', () => {
    const db = new DatabaseManager(config);
    const file: FileInfo = {
      path: 'test/note.md',
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

    db.upsertFile(file, 'hash123');
    expect(db.getFileByPath('test/note.md')).not.toBeNull();

    db.deleteFile('test/note.md');
    expect(db.getFileByPath('test/note.md')).toBeNull();

    db.close();
  }, 15000);

  it('should handle file with null parent', () => {
    const db = new DatabaseManager(config);
    const file: FileInfo = {
      path: 'root.md',
      name: 'root.md',
      basename: 'root',
      extension: 'md',
      parent: null,
      stat: {
        ctime: 1000,
        mtime: 2000,
        size: 42
      }
    };

    db.upsertFile(file, 'hash123');
    const retrieved = db.getFileByPath('root.md');

    expect(retrieved?.parent).toBeNull();

    db.close();
  }, 15000);

  it('should filter searchFiles by path prefix', () => {
    const db = new DatabaseManager(config);
    db.upsertFile(
      {
        path: 'Daily/note.md',
        name: 'note.md',
        basename: 'note',
        extension: 'md',
        parent: 'Daily',
        stat: { ctime: 1000, mtime: 2000, size: 10 }
      },
      'h1'
    );
    db.upsertFile(
      {
        path: 'Projects/note.md',
        name: 'note.md',
        basename: 'note',
        extension: 'md',
        parent: 'Projects',
        stat: { ctime: 1000, mtime: 2000, size: 10 }
      },
      'h2'
    );

    const daily = db.searchFiles('', undefined, 20, 'Daily');
    const projects = db.searchFiles('', undefined, 20, 'Projects');

    expect(daily.length).toBe(1);
    expect(daily[0].file.path).toBe('Daily/note.md');
    expect(projects.length).toBe(1);
    expect(projects[0].file.path).toBe('Projects/note.md');

    db.close();
  }, 15000);

  it('should filter searchFiles by linksToPath', () => {
    const db = new DatabaseManager(config);
    const targetFile: FileInfo = {
      path: 'target.md',
      name: 'target.md',
      basename: 'target',
      extension: 'md',
      parent: null,
      stat: { ctime: 1000, mtime: 2000, size: 10 }
    };
    const sourceFile: FileInfo = {
      path: 'source.md',
      name: 'source.md',
      basename: 'source',
      extension: 'md',
      parent: null,
      stat: { ctime: 1000, mtime: 2000, size: 10 }
    };
    const otherFile: FileInfo = {
      path: 'other.md',
      name: 'other.md',
      basename: 'other',
      extension: 'md',
      parent: null,
      stat: { ctime: 1000, mtime: 2000, size: 10 }
    };
    db.upsertFile(targetFile, 'h1');
    db.upsertFile(sourceFile, 'h2');
    db.upsertFile(otherFile, 'h3');

    const linkMetadata: ContentMetadata = {
      links: [
        {
          link: 'target.md',
          original: '[[target]]',
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 0, col: 10, offset: 10 }
          }
        }
      ]
    };
    db.upsertContentMetadata('source.md', linkMetadata, 'h2');

    const results = db.searchFiles('', undefined, 20, undefined, 'target.md');
    expect(results.length).toBe(1);
    expect(results[0].file.path).toBe('source.md');

    db.close();
  }, 15000);

  it('should filter searchFiles by headingQuery', () => {
    const db = new DatabaseManager(config);
    const file1: FileInfo = {
      path: 'intro.md',
      name: 'intro.md',
      basename: 'intro',
      extension: 'md',
      parent: null,
      stat: { ctime: 1000, mtime: 2000, size: 10 }
    };
    const file2: FileInfo = {
      path: 'outro.md',
      name: 'outro.md',
      basename: 'outro',
      extension: 'md',
      parent: null,
      stat: { ctime: 1000, mtime: 2000, size: 10 }
    };
    db.upsertFile(file1, 'h1');
    db.upsertFile(file2, 'h2');

    const introMeta: ContentMetadata = {
      headings: [
        {
          heading: 'Introduction',
          level: 1,
          position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 12, offset: 12 } }
        }
      ]
    };
    const outroMeta: ContentMetadata = {
      headings: [
        {
          heading: 'Conclusion',
          level: 1,
          position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } }
        }
      ]
    };
    db.upsertContentMetadata('intro.md', introMeta, 'h1');
    db.upsertContentMetadata('outro.md', outroMeta, 'h2');

    const results = db.searchFiles('', undefined, 20, undefined, undefined, 'Intro');
    expect(results.length).toBe(1);
    expect(results[0].file.path).toBe('intro.md');

    db.close();
  }, 15000);
});
