## Sync: indexing your vault

The `sb sync` command scans your Obsidian vault for Markdown files, parses them once, and updates
the SQLite index in `.secondbrain/index.db`.

This command is safe to run repeatedly; it only re-parses files whose content hash has changed.

## Basic usage

```bash
# Use the vault resolved from env / cwd / default
sb sync
```

Sync performs these steps:

1. Discover all `.md` files under the vault (excluding `.secondbrain`, `.git`, `node_modules`).
2. Compute a content hash and compare to what is stored in the database.
3. For new or changed files, parse frontmatter, links, tags, headings, blocks, embeds, etc.
4. Upsert into both legacy tables (`notes`, `links`) and Obsidian-aligned tables
   (`files`, `content_metadata`, and `*_with_positions`).
5. Remove database entries for files that no longer exist.

The command exits with status 0 on success and 1 on error.

## When to run sync

- After adding or editing notes directly in your Obsidian vault.
- After bulk operations (e.g. moving many files).
- Before running expensive queries (search, backlinks/outlinks) in automation.

For performance characteristics and implementation details, see `docs/architecture.md` and
`docs/database-schema.md`.

