# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs, performance bottlenecks, and logic errors identified during the code review to ensure system stability and scalability.

**Architecture:** Refactor `DatabaseManager` to handle UPSERTs correctly and avoid N+1 queries using optimized SQL. Implement a two-pass sync mechanism in `VaultManager` to ensure all links are resolved against a populated database. Refine the parser to respect code blocks and fix date localization issues.

**Tech Stack:** TypeScript, Bun, SQLite (bun:sqlite), Commander.js.

---

### Task 1: Fix Database UPSERT Conflict Logic

**Files:**
- Modify: `src/utils/database.ts:70-85`
- Test: `tests/unit/database_upsert.test.ts` (New)

**Step 1: Write the failing test**

```typescript
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
    const note1 = { id: 'hash1', path: 'test.md', title: 'T1', content: 'C1', frontmatter: {}, tags: [], links: [], hash: 'hash1', createdAt: '', modifiedAt: '' };
    db.upsertNote(note1 as any);
    
    // Content changes -> hash changes -> ID changes
    const note2 = { id: 'hash2', path: 'test.md', title: 'T1', content: 'C2', frontmatter: {}, tags: [], links: [], hash: 'hash2', createdAt: '', modifiedAt: '' };
    
    // This should NOT throw "UNIQUE constraint failed: notes.path"
    db.upsertNote(note2 as any);
    
    const saved = db.getNoteByPath('test.md');
    expect(saved?.id).toBe('hash2');
    db.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/database_upsert.test.ts`
Expected: FAIL with `SQLiteError: UNIQUE constraint failed: notes.path`

**Step 3: Write minimal implementation**

Modify `src/utils/database.ts`:
Change `ON CONFLICT(id)` to `ON CONFLICT(path)` and update the `id` field.

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/database_upsert.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/database.ts tests/unit/database_upsert.test.ts
git commit -m "fix: correct upsert logic to handle content changes for same path"
```

---

### Task 2: Optimize Title Search Performance

**Files:**
- Modify: `src/utils/vault.ts:115-125`
- Modify: `src/utils/database.ts` (Add `getNoteIdByTitle` method)

**Step 1: Write the failing test**
(Mock or observe `getAllNotes` being called unnecessarily in `VaultManager`)

**Step 2: Implement `getNoteIdByTitle` in `DatabaseManager`**

```typescript
getNoteByTitle(title: string): Note | null {
  const row = this.db.prepare('SELECT * FROM notes WHERE title = ? COLLATE NOCASE').get(title);
  if (!row) return null;
  return this.rowToNote(row);
}
```

**Step 3: Update `VaultManager.findNoteByTitleOrPath`**

Replace `this.db.getAllNotes().find(...)` with `this.db.getNoteByTitle(titleOrPath)`.

**Step 4: Commit**

```bash
git add src/utils/database.ts src/utils/vault.ts
git commit -m "perf: use SQL for title search instead of loading all notes into memory"
```

---

### Task 2.5: Fix N+1 Query Problem in Note Loading

**Files:**
- Modify: `src/utils/database.ts`

**Step 1: Refactor `rowToNote` to avoid individual queries if possible, or batch them.**
(For now, ensure we at least use efficient queries. Advanced: use JSON_GROUP_ARRAY in a JOIN).

---

### Task 3: Fix Link Resolution (Two-Pass Sync)

**Files:**
- Modify: `src/utils/vault.ts:27-65`

**Step 1: Modify `sync()` logic**
1. Pass 1: Collect all files, parse basic metadata, and `upsertNote` with empty `links`.
2. Pass 2: Iterate through all files again (or the ones changed), resolve links using `findNoteByTitleOrPath`, and update the `links` table.

**Step 2: Commit**

```bash
git add src/utils/vault.ts
git commit -m "fix: implement two-pass sync to resolve links correctly"
```

---

### Task 4: Fix UTC Date Issue in Daily Notes

**Files:**
- Modify: `src/utils/vault.ts:148`
- Modify: `src/utils/parser.ts:110`

**Step 1: Change to Local Date**

```typescript
// In VaultManager.getDailyNotePath
const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
```

---

### Task 5: Refine Tag Parser (Exclude Code Blocks)

**Files:**
- Modify: `src/utils/parser.ts:70-85`

**Step 1: Update Regex/Logic**
Strip code blocks before extracting tags.

---

### Task 6: Optimize Capture Command

**Files:**
- Modify: `src/commands/capture.ts:80`

**Step 1: Replace `vault.sync()` with targeted upsert.**

---

### Task 7: Adjust Orphan Logic

**Files:**
- Modify: `src/utils/database.ts:112`

**Step 1: Update SQL**
Change to `WHERE l2.target_id IS NULL`.
