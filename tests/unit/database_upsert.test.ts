import { describe, it, expect, beforeEach } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import { Config } from '../../src/types';
import { unlinkSync, existsSync } from 'fs';

describe('DatabaseManager Upsert', () => {
  const dbPath = 'test-upsert.db';
  const config: Config = { vaultPath: '.', dailyNotesFolder: 'Daily', templatesFolder: 'Templates', dbPath };

  beforeEach(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  it('should update a note when content changes but path remains the same', () => {
    const db = new DatabaseManager(config);
    const note1 = {
      id: 'hash1', path: 'test.md', title: 'T1', content: 'C1', frontmatter: {}, tags: [], links: [],
      blockRefs: [], embeds: [], headings: [], hash: 'hash1', createdAt: '', modifiedAt: ''
    };
    db.upsertNote(note1 as any);

    // Content changes -> hash changes -> ID changes
    const note2 = {
      id: 'hash2', path: 'test.md', title: 'T1', content: 'C2', frontmatter: {}, tags: [], links: [],
      blockRefs: [], embeds: [], headings: [], hash: 'hash2', createdAt: '', modifiedAt: ''
    };

    // This should NOT throw "UNIQUE constraint failed: notes.path"
    db.upsertNote(note2 as any);

    const saved = db.getNoteByPath('test.md');
    expect(saved?.id).toBe('hash2');
    db.close();
  }, 10000);

  it('persists embeds with positions and returns them on get', () => {
    const db = new DatabaseManager(config);
    const embeds = [{ target: 'image.png', line: 2, column: 10 }, { target: 'note.md', line: 5, column: 1 }];
    const note = {
      id: 'h1', path: 'e.md', title: 'E', content: 'x', frontmatter: {}, tags: [], links: [],
      blockRefs: [], embeds, headings: [], hash: 'h1', createdAt: '', modifiedAt: ''
    };
    db.upsertNote(note as any);
    const saved = db.getNoteByPath('e.md');
    expect(saved?.embeds).toEqual(embeds);
    db.close();
  }, 15000);

  it('persists headings with level and position and returns them on get', () => {
    const db = new DatabaseManager(config);
    const headings = [
      { level: 1, text: 'Title', line: 1, column: 1 },
      { level: 2, text: 'Section', line: 3, column: 1 }
    ];
    const note = {
      id: 'h2', path: 'headings.md', title: 'H', content: '# Title\n\n## Section', frontmatter: {},
      tags: [], links: [], blockRefs: [], embeds: [], headings, hash: 'h2', createdAt: '', modifiedAt: ''
    };
    db.upsertNote(note as any);
    const saved = db.getNoteByPath('headings.md');
    expect(saved?.headings).toEqual(headings);
    db.close();
  }, 15000);

  it('persists TFile-aligned fields (parent, basename, stat) and returns them on get', () => {
    const db = new DatabaseManager(config);
    const note = {
      id: 'tf1',
      path: 'folder/note.md',
      title: 'T',
      content: 'C',
      frontmatter: {},
      tags: [],
      links: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'tf1',
      createdAt: '2025-01-01T00:00:00.000Z',
      modifiedAt: '2025-01-02T00:00:00.000Z',
      parent: 'folder',
      basename: 'note',
      stat: { ctime: 1000, mtime: 2000, size: 42 }
    };
    db.upsertNote(note as any);
    const saved = db.getNoteByPath('folder/note.md');
    expect(saved?.parent).toBe('folder');
    expect(saved?.basename).toBe('note');
    expect(saved?.stat).toEqual({ ctime: 1000, mtime: 2000, size: 42 });
    db.close();
  });

  it('accepts notes without TFile-aligned fields (backward compatible)', () => {
    const db = new DatabaseManager(config);
    const note = {
      id: 'legacy1',
      path: 'legacy.md',
      title: 'L',
      content: 'C',
      frontmatter: {},
      tags: [],
      links: [],
      blockRefs: [],
      embeds: [],
      headings: [],
      hash: 'legacy1',
      createdAt: '',
      modifiedAt: ''
    };
    db.upsertNote(note as any);
    const saved = db.getNoteByPath('legacy.md');
    expect(saved?.id).toBe('legacy1');
    expect(saved?.parent).toBeUndefined();
    expect(saved?.basename).toBeUndefined();
    expect(saved?.stat).toBeUndefined();
    db.close();
  }, 15000);
});
