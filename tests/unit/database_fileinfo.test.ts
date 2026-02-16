import { describe, it, expect, beforeEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { Config, FileInfo } from '../../src/types';
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
  });

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
  });

  it('should return null for non-existent file', () => {
    const db = new DatabaseManager(config);
    const retrieved = db.getFileByPath('nonexistent.md');
    expect(retrieved).toBeNull();
    db.close();
  });

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
  });

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
  });

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
  });
});
