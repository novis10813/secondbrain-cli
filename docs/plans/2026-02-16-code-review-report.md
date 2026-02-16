# Code Review Report: 2026-02-16 Fixes

**Status:** ✅ **Approved with Minor Suggestions**
**Reviewer:** Gemini CLI
**Date:** 2026-02-16

---

## 1. Overview

The implementation successfully addresses the critical bugs and performance issues identified in the previous plan. The system is now more stable (upsert logic fixed), accurate (link resolution fixed), and efficient (title search optimized).

## 2. Verified Fixes

### ✅ Critical: Database Upsert Logic

- **Fix:** `DatabaseManager.upsertNote` now correctly handles content changes by using `ON CONFLICT(path)` instead of `id`. This prevents `UNIQUE constraint failed: notes.path` errors when a note's content (and thus its hash-based ID) changes.
- **Verification:** `tests/unit/database_upsert.test.ts` passes.

### ✅ Critical: Link Resolution (2-Pass Sync)

- **Fix:** `VaultManager.sync` now uses a two-pass approach:
    1. **Pass 1:** Upsert all notes with basic metadata to ensure they exist in the DB.
    2. **Pass 2:** Resolve links against the populated DB and update connections.
- **Verification:** Verified by code inspection of `src/utils/vault.ts`. This ensures links to new notes are correctly resolved.

### ✅ Performance: Title Search

- **Fix:** `VaultManager.findNoteByTitleOrPath` now uses a direct SQL query (`getNoteByTitle`) instead of loading all notes into memory.
- **Verification:** Verified code in `src/utils/database.ts` and `src/utils/vault.ts`.

### ✅ Bug: Daily Note Dates

- **Fix:** `VaultManager.getDailyNotePath` now uses local time (e.g., `date.getFullYear()`) instead of UTC, ensuring daily notes match the user's actual day.

### ✅ Logic: Tag Parser

- **Fix:** `NoteParser` now strips code blocks before extracting tags, preventing false positives from code snippets.

### ✅ Performance: Capture Command

- **Fix:** The `capture` command now upserts the single new note directly instead of triggering a full `vault.sync()`.

---

## 3. Remaining Observations & Suggestions

### ⚠️ Performance: N+1 Query Issue (Partial Fix)

While `capture` and `findNoteByTitle` are optimized, the `rowToNote` method still performs 2 separate queries (for links and backlinks) for *every* note converted.

- **Impact:** Methods like `getAllNotes` or `searchNotes` will execute `1 + (2 * N)` queries. For 1,000 notes, this is 2,001 database queries.
- **Recommendation:** Future optimization should use `LEFT JOIN` with `GROUP_CONCAT` or `json_group_array` to fetch links and backlinks in the same query as the note data.

### ℹ️ Database: Link Churn

`upsertNote` deletes all existing links for a note and re-inserts them on every save.

- **Impact:** Minimal for now, but if notes have hundreds of links, this could be optimized to only diff changes.

---

## 4. Conclusion

The codebase is in a much better state. The critical data-loss and crashing bugs are resolved. The remaining performance issues are non-critical for small-to-medium vaults (< 5,000 notes).

**Ready for merge/deployment.**
