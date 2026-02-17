# Architecture

## Directory structure

```
src/
├── index.ts           # CLI entry: Commander program, command registration
├── commands/          # CLI command handlers (one file per command)
├── types/             # TypeScript types (Obsidian-aligned + app types)
└── utils/             # Shared logic: config, database, parser, vault, template, position
```

## Entry point and data flow

1. **Entry**: `src/index.ts` creates a Commander program, registers commands, and parses argv.
2. **Vault detection**: Commands that need a vault call `ConfigManager.findVaultPath()` (walks up from cwd for `.secondbrain/config.json`).
3. **Config**: `ConfigManager` loads/saves `.secondbrain/config.json` (vaultPath, dailyNotesFolder, templatesFolder, dbPath).
4. **Database**: `DatabaseManager` opens `.secondbrain/index.db`, runs `initTables()` and `initObsidianTables()` on first use.
5. **Vault operations**: `VaultManager` uses `DatabaseManager` and `NoteParser`; sync reads markdown files, parses, and upserts into both legacy (`notes`/`links`) and Obsidian-aligned tables (`files`, `content_metadata`, `*_with_positions`).

## Design choices

- **Dual storage**: SQLite index + original Markdown files; CLI does not rewrite note content except for capture/template.
- **Obsidian compatibility**: Types and schema align with Obsidian’s TFile / CachedMetadata where applicable; see [obsidian-alignment-guide.md](./obsidian-alignment-guide.md).
- **Backward compatibility**: Legacy `notes` and `links` tables are still maintained for existing behaviour; new logic prefers `files` and position tables.
