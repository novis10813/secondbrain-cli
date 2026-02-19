# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **Runtime**: Bun (primary) / Node.js 18+ (fallback)
- **Language**: TypeScript 5.3 (strict mode)
- **Database**: SQLite via better-sqlite3
- **CLI Framework**: Commander.js
- **Package Manager**: Bun/npm

## Repository Purpose

SecondBrain CLI is a tool for LLM agents to interact with Obsidian vaults. It provides:
- Dual-storage architecture (SQLite index + raw Markdown files)
- Full link system ([[wikilinks]], backlinks, orphan detection)
- Agent-first design (JSON output, structured data, pipeable CLI)
- 100% Obsidian compatibility

## Essential Commands

```bash
# Development
bun install              # Install dependencies
bun run build           # Compile TypeScript to dist/
bun run lint            # Type-check (tsc --noEmit)
bun run dev             # Run from source (bun run src/index.ts)
bun test                # Run all tests
bun test --coverage     # Run tests with coverage
bun test tests/unit/    # Run specific test directory
bun test tests/perf/    # Run performance tests

# Release
npm publish --access public  # Publish to npm (after npm login)
```

## Architecture Overview

### Data Storage

The codebase uses **two storage layers**:

1. **Filesystem** - Raw Markdown files (Obsidian-compatible)
2. **SQLite Database** (`.secondbrain/index.db`) - Index for fast queries

The database has two schemas:

**New Obsidian-aligned schema** (preferred):
- `files` - File metadata (path, name, timestamps, content hash)
- `content_metadata` - Frontmatter positions
- `links_with_positions` - Links with line/col positions
- `tags_with_positions`, `headings_with_positions`, `blocks_with_positions`, `embeds_with_positions`, `sections_with_positions`

**Legacy schema** (for backwards compatibility):
- `notes` table - Combined file + content data
- `links` table - Many-to-many note relationships

### Core Modules

**src/index.ts** - Entry point, registers all commands
- 13 CLI commands via commander
- Imports from `src/commands/` and `src/utils/`

**src/utils/database.ts** - DatabaseManager
- Initializes schema, handles migrations
- CRUD for files, notes, metadata
- Batch operations with transactions
- Search, backlinks, orphan detection

**src/utils/vault.ts** - VaultManager
- Higher-level vault operations
- File scanning and sync
- Note reading/writing
- Link resolution (path → file)

**src/utils/parser.ts** - NoteParser
- Markdown parsing with position tracking
- Extracts: frontmatter, titles, tags, links, embeds, headings, block refs, footnotes
- Produces `ParsedNote` and `ContentMetadata`
- Static helpers for content generation

**src/utils/config.ts** - ConfigManager
- Manages local vault config (`.secondbrain/config.json`)
- Provides vaultPath, dailyNotesFolder, templatesFolder, dbPath

**src/utils/global-config.ts** - GlobalConfigManager
- Manages global vault registry (`~/.config/secondbrain/vaults.json`)
- Multi-vault support: register, switch, set default

**src/utils/template.ts** - Template system
- Loads templates from templates folder
- Field validation

**src/utils/sqlite-adapter.ts** - SQLite wrapper
- Creates better-sqlite3 instance with PRAGMAs
- Transaction helper

## Key Concepts

### Sync Process (VaultManager.sync())
1. Scan filesystem for `.md` files (excludes `.git`, `.secondbrain`, `node_modules`)
2. Parse each file once, compute hash
3. Compare hash with database to detect changes
4. For new/updated files: upsert `files` + `content_metadata` + (legacy) `notes`
5. Pass 2: Resolve link targets using cached parsed data
6. Delete files that no longer exist
7. Returns `{ added, updated, removed }`

### Link Resolution (VaultManager.getFirstLinkpathDest())
Tries in order:
1. Exact path match
2. Path + `.md`
3. Relative to source file's directory (with and without `.md`)
4. Path variations (spaces→dashes/underscores)
5. Basename match (case-insensitive)

### Position Tracking
All parsed elements include both:
- Line/column (1-based for editor display)
- Character offset from file start (for precise navigation)

Use `rangeToPos()` (src/utils/position.ts) to convert offset ranges.

## Data Flow

```
User runs command
  ↓
Command handler (src/commands/*.ts) uses VaultManager
  ↓
VaultManager uses DatabaseManager + reads filesystem
  ↓
DatabaseManager uses SQLite + transactions
  ↓
VaultManager optionally uses NoteParser for parsing
```

## Important Files

- `src/types/index.ts` - All TypeScript interfaces (FileInfo, Note, ContentMetadata, Config, etc.)
- `.cursorrules` - Project coding standards (indentation, commit format, best practices)
- `README.md` - User-facing documentation (Chinese)
- `docs/` - Detailed architecture, database schema, metadata comparison

## Testing

- Tests located in `tests/unit/` and `tests/perf/`
- Test fixtures: `tests_vault/` (sample Obsidian vault)
- Run single test: `bun test tests/unit/path/to/test.ts`
- Coverage: `bun test --coverage`

Before committing, run:
```bash
bun run lint
bun test
```

## Vault Configuration

Each vault has:
- Local config: `.secondbrain/config.json` (managed by ConfigManager)
- Database: `.secondbrain/index.db`

Global registry (`~/.config/secondbrain/vaults.json`) enables multi-vault switching:
```bash
sb vault list                 # List registered vaults
sb vault init /path/to/vault  # Register and initialize
eval $(sb vault use my-vault) # Switch active vault for session
sb vault default set my-vault # Set default
```

Vault resolution order:
1. `SECONDBRAIN_VAULT` env var
2. Current directory (walk up to find `.secondbrain/`)
3. Default vault from global config

## Migration

The database supports schema evolution:

- **Schema version table** tracks current version
- `runMigrations()` in DatabaseManager.initTables() applies incremental ALTERs
- `migrateFromOldSchema()` converts legacy `notes` table to new files+content_metadata structure

When adding schema changes:
1. Add idempotent ALTER/CREATE statements
2. Bump version in `schema_version` if breaking change
3. Write data migration if needed

## Development Patterns

### Adding a new command
1. Create `src/commands/<name>.ts` exporting `create<Name>Command(): Command`
2. Import and register in `src/index.ts`
3. Follow existing command patterns (options parsing, error handling)

### Database operations
- Use prepared statements with `?` placeholders (parameterized queries)
- Wrap multi-step operations in `db.transaction(() => { ... })`
- Create indexes for frequently queried columns
- Use `ON CONFLICT` upserts for idempotent operations
- Close database on process exit (`db.close()`)

### Vault operations
- Filesystem scanning: recursive, excludes symlinks, `.secondbrain`, `node_modules`
- All file paths are relative to vault root
- Hash content with `NoteParser.computeHash()` (SHA-256)
- Separately track `FileInfo` (filesystem) and `ContentMetadata` (parsed)

### Parsing
- Always parse once per file, reuse results
- Respect code blocks (exclude from tag/link extraction)
- Position offsets are from file start (include frontmatter)
- Use `rangeToPos()` to convert offset ranges to line/col

## Commit Format

```
type: brief description
```

Types:
- `feat:` - new feature
- `fix:` - bug fix
- `refactor:` - code restructuring
- `docs:` - documentation changes
- `test:` - test additions/changes
- `chore:` - maintenance tasks

Example: `feat: add block reference support`

## Boundaries - Never Modify

- `.secondbrain/` directory (except config.json edits via ConfigManager)
- `.git/` directory
- `node_modules/` or lock files
- Test fixtures (unless explicitly requested)
- Documentation PRD files during execution

## Code Quality Standards

From `.cursorrules`:
- Keep changes small and focused (one logical change per commit)
- Prefer multiple small commits over one large commit
- Run feedback loops after each change
- Indentation: tabs (2 space width)
- Line width: 100 characters
- Use descriptive names, avoid over-engineering
- Delete unused code completely
- This codebase will outlive you - leave it better than you found it

## Performance Considerations

- Use batch operations (e.g., `upsertFilesBatch`) for bulk inserts
- Cache parsed results during sync (avoid re-parsing same file)
- SQLite indexes exist on: `files.path`, `files.content_hash`, `links.*`, `tags.*`, `headings.*`
- Transactions are critical for atomic metadata sets

## Obsidian Compatibility

- All file operations are read-only or append-only (never modify Obsidian-specific frontmatter unexpectedly)
- Supports standard Markdown + YAML frontmatter
- Wikilinks: `[[note]]` and `[[note|display]]`
- Embeds: `![[note]]`
- Block refs: `^block-id`
- Tags: `#tag` (in frontmatter or body, excluding code and headings)
- Headings: `# H1` through `###### H6`
- No assumptions about vault structure (user can organize freely)

## Environment & Configuration

- Minimum Node.js 18.0.0
- SECONDBRAIN_CONFIG_DIR environment variable supported (for global config location)
- SECONDBRAIN_VAULT environment variable overrides vault resolution

## Related Documentation

- `README.md` - User guide and CLI reference
- `docs/architecture.md` - System architecture
- `docs/database-schema.md` - Database design
- `docs/modules.md` - Module descriptions
- `docs/metadata-comparison.md` - Format vs Obsidian
- `docs/obsidian-alignment-guide.md` - Compatibility decisions
