## Migrate: legacy to Obsidian-aligned schema

Early versions of SecondBrain CLI stored note data in a single `notes` table plus a `links`
table. Newer versions use an Obsidian-aligned schema based on `files`, `content_metadata`, and
position tables (`*_with_positions`).

The `sb migrate` command upgrades existing databases to the new structure while keeping legacy
tables for backwards compatibility.

## When to run migrate

You should run:

```bash
sb migrate
```

if:

- You have an older `.secondbrain/index.db` created before the Obsidian-aligned schema was
  introduced.
- You are upgrading from a version that only had `notes` and `links` tables.

New databases created by recent versions already include the new schema and do not require manual
migration.

## What migrate does

Internally, `sb migrate` calls `DatabaseManager.migrateFromOldSchema()` which:

1. Reads rows from the legacy `notes` table.
2. Re-parses content to extract full metadata and positions.
3. Inserts into `files`, `content_metadata`, and the `*_with_positions` tables.
4. Leaves `notes` and `links` intact for backwards compatibility.

For the exact schema, see `docs/database-schema.md`. For metadata alignment with Obsidian, see
`docs/metadata-comparison.md` and `docs/obsidian-alignment-guide.md`.

