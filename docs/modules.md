# Modules reference

## Utils (`src/utils/`)

### config.ts — ConfigManager

Manages vault configuration. Paths: `.secondbrain/config.json`, `.secondbrain/index.db`.

- **Constructor**: `ConfigManager(vaultPath?)` — default `process.cwd()`.
- **Key methods**: `isInitialized()`, `init()`, `loadConfig()`, `getConfig()`, `updateConfig(updates)`, `saveConfig(config)`.
- **Static**: `ConfigManager.findVaultPath(startPath?)` — walks up from startPath to find a directory containing `.secondbrain/config.json`.

Config type: `vaultPath`, `dailyNotesFolder`, `templatesFolder`, `dbPath`.

### database.ts — DatabaseManager

SQLite access and schema. Uses `bun:sqlite`; enables `PRAGMA foreign_keys = ON`.

- **Constructor**: `DatabaseManager(config: Config)` — opens `config.dbPath`, runs `initTables()` and `initObsidianTables()`.
- **Legacy**: `notes`, `links` tables; `upsertNote()`, `getNoteByPath()`, `getAllNotes()`, link resolution helpers.
- **Obsidian-aligned**: `files`, `content_metadata`, and `*_with_positions` tables; `upsertFile()`, `upsertContentMetadata()`, `getFileByPath()`, `getFileCache()`, `getFirstLinkpathDest()`, etc.
- **Migration**: `migrateFromOldSchema()` — copies from `notes` to `files`/`content_metadata` and position tables.
- **Lifecycle**: `close()`.

### parser.ts — NoteParser

Markdown parsing: frontmatter (YAML), title, tags, wikilinks, headings, blocks, embeds, footnotes, list items.

- **Static**: `NoteParser.parse(content)` → `ParsedNote` (with position refs).
- **Static**: `NoteParser.parsedToContentMetadata(parsed, content)` → `ContentMetadata` (Obsidian-aligned).
- **Static**: `NoteParser.computeHash(content)` — content hash for change detection.
- **Behaviour**: Tags are stripped inside code blocks; wikilinks support `[[target]]` and `[[target|display]]`.

### vault.ts — VaultManager

Vault operations: sync, search, get/backlinks/outlinks, capture, open resolution, stats, orphans, migration.

- **Constructor**: `VaultManager(config: Config)` — holds `DatabaseManager`.
- **Sync**: `sync()` — scans markdown files, parses, upserts files + content_metadata + notes; removes deleted paths.
- **Resolve**: `resolvePathOrBasename(pathOrBasename)` → `FileInfo | null`; `getFirstLinkpathDest(linkpath, sourcePath)` for link target.
- **Content**: `readNote(relativePath)`, `getFileCache(file)` (ContentMetadata with positions).
- **Links**: `getBacklinksByPath(path)`, `getOutlinksByPath(path)`.
- **Search**: `searchFiles(query, tags?, limit?, pathPrefix?, linksToPath?, heading?, modifiedAfter?, modifiedBefore?)`.
- **Capture**: `getTemplatePath(name)`, `writeNote(relativePath, content)`.
- **Open**: `resolveLinkToPosition(linkpath, sourcePath)` → `{ path, line, col } | null` (note, note#heading, note#^block-id).
- **Stats**: `getStats()` — totalNotes, totalLinks, orphans; `getOrphanFiles()`.
- **Migration**: `migrateFromOldSchema()` — delegates to DB.
- **Lifecycle**: `close()`.

### template.ts — TemplateManager

Templates under `config.templatesFolder` (e.g. `Templates/<name>.md`).

- **Methods**: `getTemplate(name)`, `createTemplate(name, content)`, `listTemplates()`, `deleteTemplate(name)`, `renderTemplate(name, variables)` (replaces `{{key}}`), `validateTemplate(name)` (returns required `{{variables}}`).

### position.ts — position helpers

Obsidian-aligned position types from `src/types`: `Loc`, `Pos`.

- **`indexToLoc(content, index)`** → `Loc` (line, col 0-based, offset).
- **`rangeToPos(content, startIndex, endIndex)`** → `Pos` (start/end Loc).

---

## Commands (`src/commands/`)

Each file exports a `create*Command(): Command` registered in `src/index.ts`.

| Command | Description |
|---------|-------------|
| **init** | Initialize vault: create `.secondbrain/`, default config. Option: `--path`. |
| **sync** | Sync vault with DB: scan .md files, upsert files + content_metadata + notes, remove deleted. |
| **capture** | Create note: `<content>`, options `--title`, `--tags`, `--template`, `--path`. |
| **search** | Search by path/basename and filters. Options: `--tags`, `--path`, `--limit`, `--links-to`, `--heading`, `--modified-after`/`--modified-before`, `--format` (json\|text). |
| **get** | Get one note by path or basename. Options: `--format` (json\|text). |
| **backlinks** | Backlinks for a note (path or basename). Option: `--format`. |
| **outlinks** | Outgoing links from a note. Option: `--format`. |
| **open** | Resolve link to `path:line:col`. Argument: `<linkpath>` (e.g. `note`, `note#heading`, `note#^block-id`). Options: `--source`, `--format` (position\|json). |
| **stats** | Vault stats: total notes, links, orphans. Option: `--format`. |
| **orphans** | List notes with no links. Option: `--format`. |
| **config** | Subcommands: `list`, `get <key>`, `set <key> <value>`. Editable keys: `dailyNotesFolder`, `templatesFolder`. |
| **migrate** | Run one-off migration from old schema (notes) to new (files + content_metadata + positions). |

All vault commands resolve vault via `ConfigManager.findVaultPath()`, then instantiate `ConfigManager` and `VaultManager`; they exit with code 1 on error and 0 on success.
