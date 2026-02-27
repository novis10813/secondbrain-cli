# Obsidian vs SecondBrain CLI metadata

## Overview

This document compares the in-memory metadata used by Obsidian with the persistent metadata
stored by SecondBrain CLI.

> Obsidian uses a **layered model** for metadata:
> - **TFile**: file-level info (filesystem layer)
> - **CachedMetadata**: content-level info (parsed from Markdown)
>
> For a deeper alignment guide, see [obsidian-alignment-guide.md](./obsidian-alignment-guide.md).

## Obsidian metadata (CachedMetadata)

According to the Obsidian API (`obsidian.d.ts`), the in-memory metadata cache looks like:

```typescript
interface CachedMetadata {
  links?: LinkCache[];           // Wikilinks
  embeds?: EmbedCache[];         // Embedded files/images
  tags?: TagCache[];             // Tags (with positions)
  headings?: HeadingCache[];     // Heading hierarchy
  footnotes?: FootnoteCache[];   // Footnotes
  blocks?: BlockCache[];         // Block IDs (for block refs)
  frontmatter?: FrontMatterCache;// Frontmatter position
  sections?: SectionCache[];     // Document sections
  listItems?: ListItemCache[];   // List items
}
```

### Key characteristics

1. **Rich position data**: every element has line/column offsets.
2. **Structured information**: heading hierarchy, list hierarchy, etc.
3. **Block ref support**: block IDs and references.
4. **In-memory only**: metadata is not persisted to disk.

## SecondBrain CLI metadata

The CLI uses a **two-layer structure**: Obsidian-aligned tables (`files`, `content_metadata`,
position tables) plus legacy tables (`notes`, `links`) for backwards compatibility. Queries and
sync now primarily use the new structure.

### New structure: files + content_metadata (TFile / CachedMetadata aligned)

**`files`** (TFile / FileStats equivalent):

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  basename TEXT NOT NULL,
  extension TEXT NOT NULL,
  parent TEXT,
  ctime INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL,
  content_hash TEXT NOT NULL
);
```

**`content_metadata`** (frontmatter positions, etc.):

```sql
CREATE TABLE content_metadata (
  file_path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  frontmatter_start_line INTEGER, ...
);
```

**Position tables** (line/col/offset, analogous to Obsidian cache items):

- `links_with_positions`: target, original text, display text, start/end line/col/offset.
- `tags_with_positions`: tag, positions.
- `headings_with_positions`: heading text, level (1–6), positions.
- `blocks_with_positions`: block ID for block refs.
- `embeds_with_positions`: target path, original, display text, positions.
- `sections_with_positions`: section id, type, positions.

### Legacy structure (`notes` + `links`, retained after migration)

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  frontmatter TEXT NOT NULL,
  tags TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  ...
);

CREATE TABLE links (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id)
);
```

### Key characteristics

- **Persistent**: metadata is stored in SQLite, not just memory.
- **Obsidian-aligned**: `files`/`content_metadata` plus position tables mirror TFile/CachedMetadata.
- **Position data**: links, tags, headings, blocks, embeds, sections all have line/col/offset.
- **Hash tracking**: `content_hash` tracks content changes.
- **Timestamps**: `ctime`/`mtime` on `files`, `created_at`/`modified_at` on `notes`.

## Comparison table

| Feature | Obsidian | SecondBrain CLI |
|---------|----------|-----------------|
| **Storage location** | In-memory cache | SQLite database |
| **Persistence** | ❌ Not persisted | ✅ Persisted |
| **Position data** | ✅ Line/column | ✅ `*_with_positions` tables with line/col/offset |
| **Heading hierarchy** | ✅ Full structure | ✅ `headings_with_positions` (level 1–6) |
| **Block refs** | ✅ Supported | ✅ `blocks_with_positions` storing block_id |
| **Footnotes** | ✅ Supported | ❌ Not currently tracked |
| **List structure** | ✅ Full structure | ❌ Not currently tracked |
| **Embeds** | ✅ Tracked | ✅ `embeds_with_positions` |
| **Link resolution** | Title/path matching | ✅ Path/ID + `links_with_positions` |
| **Backlinks graph** | ✅ Automatic | ✅ Automatic |
| **Timestamps** | ❌ None | ✅ `ctime`/`mtime` (files) |
| **Content hash** | ❌ None | ✅ `content_hash` |
| **Query performance** | In-memory | ✅ SQL indexes |

## Design differences

### Obsidian
- **Editor-centric**: optimized for interactive editing.
- **Real-time**: rich positions support navigation, highlighting, and previews.
- **Visualization**: needs full structural info for graphs and outline views.

### SecondBrain CLI
- **Agent-centric**: optimized for LLM agents and automation.
- **Query-focused**: uses SQL indexes for search and link queries.
- **Persistent**: metadata survives process restarts.
- **Programmable**: JSON output for downstream tools.

## Practical impact

### Features Obsidian has that the CLI does not
1. Full list structure (listItems).
2. Footnote definitions and references.

### Features the CLI has that Obsidian does not
1. Persistent queryable index in SQLite.
2. Content hashing for change detection.
3. File-level timestamps in the index.
4. Stable ID-style link resolution for automation.

## References

- [Obsidian API Documentation](https://docs.obsidian.md/)
- [Obsidian API Type Definitions](https://github.com/obsidianmd/obsidian-api)
- [Obsidian alignment guide](./obsidian-alignment-guide.md)
- SecondBrain CLI: `src/types/index.ts`, `src/utils/database.ts` (`initTables` + `initObsidianTables`), `src/utils/parser.ts`

