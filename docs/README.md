# SecondBrain CLI Documentation

This directory contains documentation for both everyday CLI usage and internal implementation
details.

## Usage guides (one core utility per file)

These documents explain how to use each major CLI capability:

| Guide | Description |
|-------|-------------|
| [Vaults](./vault.md) | Multi-vault registry, `sb vault` subcommands, resolution priority |
| [Sync](./sync.md) | How `sb sync` scans Markdown and updates the SQLite index |
| [Capture](./capture.md) | Creating notes, templates, tags, and `path-or-id` behavior |
| [Search](./search.md) | Query syntax and filters: tags, path prefix, links, headings, modified dates |
| [Backlinks & outlinks](./backlinks.md) | Link graph commands: `sb backlinks` and `sb outlinks` |
| [Open](./open.md) | Resolving linkpaths to `path:line:col` with `sb open` |
| [Templates](./template.md) | `sb template` workflow and TemplateManager concepts |
| [Config](./config.md) | Vault config file and `sb config` subcommands |
| [Stats & orphans](./stats.md) | Vault stats, orphan detection, and maintenance commands |
| [Migrate](./migrate.md) | When and how to run `sb migrate` (schema migration) |

## Internal reference

These documents are primarily for contributors and maintainers:

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Codebase layout, entry point, and data flow |
| [Modules](./modules.md) | Utils and commands reference |
| [Database schema](./database-schema.md) | SQLite tables and relationships |
| [Metadata comparison](./metadata-comparison.md) | Obsidian vs CLI metadata |
| [Obsidian alignment](./obsidian-alignment-guide.md) | TFile / CachedMetadata alignment |

## Quick reference

- **Entry point**: `src/index.ts` (Commander.js, registers all commands)
- **Config**: `.secondbrain/config.json`; DB: `.secondbrain/index.db`
- **Stack**: Bun/Node, TypeScript, Commander.js, SQLite (better-sqlite3), YAML (frontmatter)
