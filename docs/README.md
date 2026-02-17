# SecondBrain CLI Documentation

Index of technical documentation for the codebase.

## Overview

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
- **Stack**: Bun, TypeScript, Commander.js, SQLite (bun:sqlite), YAML (frontmatter)
