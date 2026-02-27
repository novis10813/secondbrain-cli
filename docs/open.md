## Open: resolving linkpaths to positions

The `sb open` command resolves an Obsidian-style linkpath to a concrete file and position in the
form `path:line:col`. This is intended for editor integrations and navigation tools.

## Linkpath syntax

Supported forms:

- `note` — basename or relative path.
- `note#Heading` — heading fragment; resolves to the heading position.
- `note#^block-id` — block reference; resolves to the block position.

Resolution uses the same strategy as Obsidian’s `getFirstLinkpathDest`, trying exact paths,
variations with/without `.md`, and basename matches.

## Basic usage

```bash
# Resolve to "path:line:col" (default)
sb open "My Note"

# Resolve a heading
sb open "My Note#Section title"

# Resolve a block reference
sb open "My Note#^block-id"
```

## Options

```bash
sb open "<linkpath>" \
  --source="Daily/2024-02-27.md" \
  --format=position
```

- `--source` — optional source file path used for resolving relative linkpaths.
- `--format` — output format; `position` (default) or `json`.

The JSON output includes at least:

- `path`: resolved file path (relative to vault).
- `line`: 1-based line number.
- `col`: 1-based column number.

If the linkpath cannot be resolved, the command exits with status 1.

Internally, this uses `VaultManager.resolveLinkToPosition` and the position tables documented in
`docs/database-schema.md`.

