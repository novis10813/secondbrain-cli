import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database';
import type { Note } from '../../src/types/index';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Database Performance', () => {
  let db: DatabaseManager;
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'secondbrain-perf-'));
    const dbPath = join(tempDir, 'test.db');
    
    // TODO: Wrap db to count queries (Task 4)
    db = new DatabaseManager({
      vaultPath: tempDir,
      dbPath,
      dailyNotesFolder: 'daily',
      templatesFolder: 'templates',
    });
    
    // Create 100 notes with links
    for (let i = 0; i < 100; i++) {
      const note: Note = {
        id: `note-${i}`,
        path: `note-${i}.md`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        frontmatter: {},
        tags: [],
        links: i > 0 ? [`note-${i-1}`] : [], // Each note links to previous
        backlinks: [],
        hash: `hash-${i}`,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };
      db.upsertNote(note);
    }
  });

  afterAll(() => {
    db.close();
    rmSync(tempDir, { recursive: true });
  });

  it('should not perform N+1 queries when loading all notes', () => {
    // Before optimization: 1 query for notes + 100 queries for links + 100 queries for backlinks = 201 queries
    // After optimization: 1 query total
    const notes = db.getAllNotes();
    expect(notes).toHaveLength(100);
    // TODO: Add query counting mechanism
  });
});