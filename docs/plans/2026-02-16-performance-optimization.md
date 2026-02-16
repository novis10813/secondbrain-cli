# Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix N+1 query issue and link churn in DatabaseManager to improve performance for large vaults.

**Architecture:** 1) Use SQL LEFT JOIN with json_group_array() to fetch notes with links/backlinks in single query, 2) Implement diff-based link update to only modify changed links instead of delete-all-and-reinsert.

**Tech Stack:** Bun SQLite with json_group_array aggregate function, TypeScript

---

## Task 1: Analyze Current Performance Baseline

**Files:**
- Create: `tests/perf/database_perf.test.ts`

**Step 1: Create performance test to measure current N+1 query behavior**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { DatabaseManager } from '../../src/utils/database.js';
import type { Note } from '../../src/types/index.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Database Performance', () => {
  let db: DatabaseManager;
  let tempDir: string;
  let queryCount = 0;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'secondbrain-perf-'));
    const dbPath = join(tempDir, 'test.db');
    
    // Wrap db to count queries
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
  });

  it('should not perform N+1 queries when loading all notes', () => {
    // Before optimization: 1 query for notes + 100 queries for links + 100 queries for backlinks = 201 queries
    // After optimization: 1 query total
    const notes = db.getAllNotes();
    expect(notes).toHaveLength(100);
    // TODO: Add query counting mechanism
  });
});
```

**Step 2: Run test to establish baseline**

Run: `bun test tests/perf/database_perf.test.ts`
Expected: PASS (baseline established)

**Step 3: Commit**

```bash
git add tests/perf/database_perf.test.ts
git commit -m "test: add performance baseline test for N+1 query issue"
```

---

## Task 2: Implement Batch Link Loading with SQL JOIN

**Files:**
- Modify: `src/utils/database.ts:115-122` (getAllNotes method)
- Modify: `src/utils/database.ts:166-182` (rowToNote method)
- Create: `src/utils/database.ts:183-210` (new batch methods)

**Step 1: Add batch link loading query**

Add new private method after `rowToNote`:

```typescript
private getNotesWithLinksBatch(noteIds: string[]): Map<string, { links: string[], backlinks: string[] }> {
  if (noteIds.length === 0) return new Map();
  
  const placeholders = noteIds.map(() => '?').join(',');
  
  // Single query to get all links for all notes
  const linksSql = `
    SELECT source_id, json_group_array(target_id) as targets
    FROM links
    WHERE source_id IN (${placeholders})
    GROUP BY source_id
  `;
  
  const backlinksSql = `
    SELECT target_id, json_group_array(source_id) as sources
    FROM links
    WHERE target_id IN (${placeholders})
    GROUP BY target_id
  `;
  
  const result = new Map<string, { links: string[], backlinks: string[] }>();
  
  // Initialize with empty arrays
  for (const id of noteIds) {
    result.set(id, { links: [], backlinks: [] });
  }
  
  // Populate links
  const linksRows = this.db.prepare(linksSql).all(...noteIds) as any[];
  for (const row of linksRows) {
    const targets = JSON.parse(row.targets);
    result.get(row.source_id)!.links = targets;
  }
  
  // Populate backlinks
  const backlinksRows = this.db.prepare(backlinksSql).all(...noteIds) as any[];
  for (const row of backlinksRows) {
    const sources = JSON.parse(row.sources);
    result.get(row.target_id)!.backlinks = sources;
  }
  
  return result;
}
```

**Step 2: Create optimized batch rowToNote variant**

```typescript
private rowsToNotes(rows: any[]): Note[] {
  if (rows.length === 0) return [];
  
  // Extract all note IDs
  const noteIds = rows.map(row => row.id);
  
  // Batch load all links and backlinks in 2 queries
  const linkData = this.getNotesWithLinksBatch(noteIds);
  
  // Map rows to notes using batched link data
  return rows.map(row => {
    const links = linkData.get(row.id)?.links || [];
    const backlinks = linkData.get(row.id)?.backlinks || [];
    
    return {
      id: row.id,
      path: row.path,
      title: row.title,
      content: row.content,
      frontmatter: JSON.parse(row.frontmatter),
      tags: JSON.parse(row.tags),
      links,
      backlinks,
      hash: row.hash,
      createdAt: row.created_at,
      modifiedAt: row.modified_at,
    };
  });
}
```

**Step 3: Update getAllNotes to use batch method**

Replace `getAllNotes` method (lines 115-118):

```typescript
getAllNotes(): Note[] {
  const rows = this.db.prepare('SELECT * FROM notes').all();
  return this.rowsToNotes(rows as any[]);
}
```

**Step 4: Update searchNotes to use batch method**

Replace `searchNotes` method return statement (lines 98-99):

```typescript
const rows = this.db.prepare(sql).all(...params);
return this.rowsToNotes(rows as any[]);
```

**Step 5: Update getBacklinks to use batch method**

Replace `getBacklinks` method (lines 107-113):

```typescript
getBacklinks(noteId: string): Note[] {
  const sql = `
    SELECT n.* FROM notes n
    JOIN links l ON n.id = l.source_id
    WHERE l.target_id = ?
  `;
  const rows = this.db.prepare(sql).all(noteId);
  return this.rowsToNotes(rows as any[]);
}
```

**Step 6: Update getOrphans to use batch method**

Replace `getOrphans` method (lines 120-128):

```typescript
getOrphans(): Note[] {
  const sql = `
    SELECT n.* FROM notes n
    LEFT JOIN links l1 ON n.id = l1.source_id
    LEFT JOIN links l2 ON n.id = l2.target_id
    WHERE l1.source_id IS NULL AND l2.target_id IS NULL
  `;
  const rows = this.db.prepare(sql).all();
  return this.rowsToNotes(rows as any[]);
}
```

**Step 7: Run tests to verify correctness**

Run: `bun test tests/unit/`
Expected: All 73+ tests PASS

**Step 8: Run performance test**

Run: `bun test tests/perf/database_perf.test.ts`
Expected: PASS with improved performance (fewer queries)

**Step 9: Commit**

```bash
git add src/utils/database.ts
git commit -m "perf: optimize N+1 query issue with batch link loading

- Add getNotesWithLinksBatch() to load links/backlinks in 2 queries
- Add rowsToNotes() for batch note conversion
- Update getAllNotes, searchNotes, getBacklinks, getOrphans to use batch loading
- Reduces queries from 1+2N to 3 for bulk operations"
```

---

## Task 3: Implement Diff-Based Link Updates

**Files:**
- Modify: `src/utils/database.ts:71-84` (updateLinks method)

**Step 1: Refactor updateLinks to use diff approach**

Replace `updateLinks` method:

```typescript
private updateLinks(noteId: string, targetIds: string[]): void {
  // Get existing links
  const existingLinks = this.db.prepare('SELECT target_id FROM links WHERE source_id = ?')
    .all(noteId)
    .map((row: any) => row.target_id);
  
  // Calculate diff
  const existingSet = new Set(existingLinks);
  const newSet = new Set(targetIds);
  
  // Links to add (in newSet but not in existingSet)
  const toAdd = targetIds.filter(id => !existingSet.has(id));
  
  // Links to remove (in existingSet but not in newSet)
  const toRemove = existingLinks.filter(id => !newSet.has(id));
  
  // Skip if no changes
  if (toAdd.length === 0 && toRemove.length === 0) {
    return;
  }
  
  // Remove links that no longer exist
  if (toRemove.length > 0) {
    const placeholders = toRemove.map(() => '?').join(',');
    this.db.prepare(`DELETE FROM links WHERE source_id = ? AND target_id IN (${placeholders})`)
      .run(noteId, ...toRemove);
  }
  
  // Add new links (only if target exists)
  if (toAdd.length > 0) {
    const insertStmt = this.db.prepare('INSERT OR IGNORE INTO links (source_id, target_id) VALUES (?, ?)');
    const targetExistsStmt = this.db.prepare('SELECT 1 FROM notes WHERE id = ?');
    
    for (const targetId of toAdd) {
      // Only insert if target exists
      const targetExists = targetExistsStmt.get(targetId);
      if (targetExists) {
        insertStmt.run(noteId, targetId);
      }
    }
  }
}
```

**Step 2: Run tests to verify correctness**

Run: `bun test tests/unit/`
Expected: All tests PASS, including database_upsert.test.ts

**Step 3: Run performance test**

Run: `bun test tests/perf/database_perf.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/utils/database.ts
git commit -m "perf: implement diff-based link updates to reduce churn

- Replace delete-all-and-reinsert with selective diff updates
- Only delete removed links and insert new links
- Skip update entirely when links haven't changed
- Reduces write operations and improves sync performance"
```

---

## Task 4: Add Comprehensive Performance Tests

**Files:**
- Modify: `tests/perf/database_perf.test.ts`

**Step 1: Add link churn test**

Add to existing test file:

```typescript
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
```

**Step 2: Run tests**

Run: `bun test tests/perf/`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/perf/database_perf.test.ts
git commit -m "test: add comprehensive performance tests for link operations"
```

---

## Task 5: Run Full Test Suite

**Files:**
- All test files

**Step 1: Run complete test suite**

Run: `bun test`
Expected: All tests PASS (existing + new performance tests)

**Step 2: Verify no regressions**

Run integration tests:
Run: `bun test tests/integration/`
Expected: All PASS

**Step 3: Final commit**

```bash
git commit -m "perf: complete performance optimization for database operations

Summary of improvements:
- N+1 Query Issue: Reduced from 1+2N queries to 3 queries for bulk operations
- Link Churn: Eliminated unnecessary delete/insert cycles when links unchanged
- Added comprehensive performance tests

Benchmarks (100 notes):
- Before: ~201 queries for getAllNotes
- After: 3 queries for getAllNotes
- Link updates: Only touch changed links instead of all"
```

---

## Verification Checklist

- [ ] All existing tests pass
- [ ] New performance tests pass  
- [ ] Integration tests pass
- [ ] No TypeScript compilation errors
- [ ] Manual test with sample vault works correctly

## Expected Performance Improvements

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| getAllNotes (100 notes) | 201 queries | 3 queries | 98.5% fewer queries |
| searchNotes (100 results) | 201 queries | 3 queries | 98.5% fewer queries |
| upsertNote (unchanged links) | DELETE ALL + INSERT ALL | No-op | 100% reduction |
| upsertNote (1 link changed) | DELETE ALL + INSERT ALL | DELETE 1 + INSERT 1 | ~50% reduction |

## Notes for Implementer

1. The `json_group_array()` function is available in SQLite 3.9+ (Bun's SQLite supports it)
2. Keep `rowToNote()` for single-note operations (used by getNoteById, getNoteByPath, etc.)
3. Only bulk operations should use `rowsToNotes()`
4. The diff algorithm uses Set operations for O(n) performance
