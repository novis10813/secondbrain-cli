import { describe, it, expect } from 'bun:test';
import type { FileInfo, FileStats } from '../../src/types';

describe('FileInfo', () => {
  const validStat: FileStats = {
    ctime: 1700000000000,
    mtime: 1700000100000,
    size: 1024
  };

  const validFileInfo: FileInfo = {
    path: 'folder/note.md',
    name: 'note.md',
    basename: 'note',
    extension: 'md',
    parent: 'folder',
    stat: validStat
  };

  it('accepts valid FileInfo with all required fields', () => {
    expect(validFileInfo.path).toBe('folder/note.md');
    expect(validFileInfo.name).toBe('note.md');
    expect(validFileInfo.basename).toBe('note');
    expect(validFileInfo.extension).toBe('md');
    expect(validFileInfo.parent).toBe('folder');
    expect(validFileInfo.stat).toEqual(validStat);
  });

  it('accepts null parent for root-level file', () => {
    const rootFile: FileInfo = {
      ...validFileInfo,
      path: 'note.md',
      parent: null
    };
    expect(rootFile.parent).toBeNull();
  });

  it('FileStats has ctime, mtime, size as numbers', () => {
    expect(typeof validStat.ctime).toBe('number');
    expect(typeof validStat.mtime).toBe('number');
    expect(typeof validStat.size).toBe('number');
  });

  it('extension is without leading dot (Obsidian convention)', () => {
    expect(validFileInfo.extension).toBe('md');
    expect(validFileInfo.extension).not.toContain('.');
  });

  it('name includes extension (Obsidian convention)', () => {
    expect(validFileInfo.name).toBe('note.md');
    expect(validFileInfo.name).toContain(validFileInfo.extension);
  });
});
