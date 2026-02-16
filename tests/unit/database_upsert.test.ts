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
      blockRefs: [], embeds: [], hash: 'hash1', createdAt: '', modifiedAt: ''
    };
    db.upsertNote(note1 as any);

    // Content changes -> hash changes -> ID changes
    const note2 = {
      id: 'hash2', path: 'test.md', title: 'T1', content: 'C2', frontmatter: {}, tags: [], links: [],
      blockRefs: [], embeds: [], hash: 'hash2', createdAt: '', modifiedAt: ''
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
      blockRefs: [], embeds, hash: 'h1', createdAt: '', modifiedAt: ''
    };
    db.upsertNote(note as any);
    const saved = db.getNoteByPath('e.md');
    expect(saved?.embeds).toEqual(embeds);
    db.close();
  });
});
