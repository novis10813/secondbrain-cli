## Backlinks and outlinks: working with the link graph

SecondBrain CLI provides two commands to explore the link graph of your vault:

- `sb backlinks` — notes that link **to** a given note.
- `sb outlinks` — notes that a given note links **out to**.

Both commands work with path-or-id and can output JSON for agents.

## Backlinks

```bash
# Human-readable output
sb backlinks <path-or-id>

# JSON output for agents
sb backlinks <path-or-id> --format=json
```

Backlinks are computed from the underlying link tables and position tables and respect Obsidian
style link resolution (basenames, relative paths, etc.).

## Outlinks

```bash
sb outlinks <path-or-id>
sb outlinks <path-or-id> --format=json
```

Outlinks list the files that the given note links to via wikilinks.

## path-or-id

For both commands, the argument can be:

- A relative path inside the vault, e.g. `Projects/api-design.md`.
- A basename that resolves uniquely, e.g. `api-design`.

If resolution fails (no such file or ambiguous basename), the command exits with an error.

For lower-level APIs that mirror Obsidian (e.g. `getBacklinksForFile`, `getMarkdownFiles`), see
`docs/modules.md` and the `VaultManager` section.

