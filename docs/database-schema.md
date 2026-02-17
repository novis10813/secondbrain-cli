# Database schema

SQLite database: `.secondbrain/index.db`. Foreign keys enabled.

## Legacy tables (backward compatibility)

### notes

Stores note summary and content hash; used by legacy APIs and link resolution.

- `id` TEXT PK (content hash)
- `path` TEXT UNIQUE NOT NULL
- `title`, `content`, `frontmatter` TEXT, `tags` TEXT (JSON array), `block_refs`, `embeds`, `headings` TEXT (JSON)
- `hash` TEXT NOT NULL
- `created_at`, `modified_at` TEXT
- `parent`, `basename` TEXT; `ctime`, `mtime`, `size` INTEGER (TFile-aligned)

Indexes: `idx_notes_path`, `idx_notes_hash`.

### links

Many-to-many note links (source_id → target_id).

- `source_id`, `target_id` TEXT; PK (source_id, target_id)
- FK to `notes(id)` ON DELETE CASCADE

Indexes: `idx_links_source`, `idx_links_target`.

---

## Obsidian-aligned tables

### files

File-level info (TFile / FileInfo). One row per markdown file.

- `path` TEXT PK (relative to vault)
- `name`, `basename`, `extension` TEXT, `parent` TEXT
- `ctime`, `mtime`, `size` INTEGER (ms, ms, bytes)
- `content_hash` TEXT NOT NULL

### content_metadata

Per-file content metadata (CachedMetadata). Frontmatter position only in table; other data in `*_with_positions`.

- `file_path` TEXT PK, FK → `files(path)` ON DELETE CASCADE
- `content_hash` TEXT NOT NULL
- `frontmatter_start_line`, `frontmatter_start_col`, `frontmatter_start_offset`, `frontmatter_end_*` INTEGER

### Position tables (all: start_line/col/offset, end_line/col/offset; FK file_path → files(path) ON DELETE CASCADE)

| Table | Key columns | Purpose |
|-------|-------------|---------|
| **links_with_positions** | source_path, target_path, target_id, original, display_text | Wikilinks `[[target]]`, `[[target\|display]]` |
| **tags_with_positions** | file_path, tag | Tags `#tag` |
| **headings_with_positions** | file_path, heading, level (1–6) | Headings |
| **blocks_with_positions** | file_path, block_id | Block refs `^block-id` |
| **embeds_with_positions** | file_path, target_path, original, display_text | Embeds `![[path]]` |
| **sections_with_positions** | file_path, section_id, type | Document sections |

Indexes on `file_path` (and where used: source_path, target_path) for fast lookups.

---

## Relationships

- **files** ↔ **content_metadata**: 1:1 by `file_path`.
- **files** ↔ **\*_with_positions**: 1:N by `file_path`.
- **links_with_positions**: `target_path`/`target_id` resolved to a file in the vault (via `getFirstLinkpathDest`); not enforced by FK.
- **notes** ↔ **links**: `notes.id` = `links.source_id` or `links.target_id`; backlinks/outlinks computed from `links` or from position tables.

## Migration

`DatabaseManager.migrateFromOldSchema()` (and `sb migrate`): reads all rows from `notes`, re-parses content to get positions, and inserts into `files`, `content_metadata`, and the `*_with_positions` tables. Does not drop `notes` or `links`.

For Obsidian type alignment and comparison, see [metadata-comparison.md](./metadata-comparison.md) and [obsidian-alignment-guide.md](./obsidian-alignment-guide.md).
