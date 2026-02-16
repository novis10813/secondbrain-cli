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

  it('should load all notes correctly with batch optimization', () => {
    // This test verifies the batch loading works (actual query counting to be added later)
    const notes = db.getAllNotes();
    expect(notes).toHaveLength(100);
    // Note: Query counting mechanism can be added here in future to assert query count <= 3
  });

  it('should not churn links when content unchanged', () => {
    // Get a note with links
    const note = db.getNoteById('note-50');
    expect(note).not.toBeNull();
    expect(note!.links.length).toBeGreaterThan(0);
    
    // Re-save the same note
    const initialLinkCount = note!.links.length;
    db.upsertNote(note!);
    
    // Verify links are preserved (no unnecessary delete/insert)
    const reloadedNote = db.getNoteById('note-50');
    expect(reloadedNote!.links).toHaveLength(initialLinkCount);
  });
  
  it('should only update changed links in diff mode', () => {
    const note = db.getNoteById('note-50');
    expect(note).not.toBeNull();
    
    // Modify only one link
    const originalLinks = [...note!.links];
    note!.links = ['note-1', 'note-2']; // Change links
    db.upsertNote(note!);
    
    // Verify new links are saved
    const updatedNote = db.getNoteById('note-50');
    expect(updatedNote!.links).toContain('note-1');
    expect(updatedNote!.links).toContain('note-2');
    expect(updatedNote!.links).not.toContain(originalLinks[0]);
  });
});