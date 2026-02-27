## Search: querying your vault

The `sb search` command lets you query notes by basename, tags, path prefix, links, headings, and
modification dates. It is optimized for JSON output so agents can consume results easily.

## Basic usage

```bash
# Free-text search by basename/path (default limit: 20)
sb search "api design"

# Return JSON results (recommended for agents)
sb search "api design" --format=json
```

## Filters and options

```bash
sb search "keyword" \
  --tags="work,meeting" \
  --path="Projects" \
  --links-to="Client/README.md" \
  --heading="API design" \
  --modified-after="2024-01-01" \
  --modified-before="2024-12-31" \
  --limit=10 \
  --format=json
```

- `--tags` — comma-separated list of tags (OR semantics).
- `--path` — path prefix filter (e.g. `Daily`, `Projects/ClientA`).
- `--links-to` — only files that link to the given target (path-or-id).
- `--heading` — only files containing a heading with the given text.
- `--modified-after` / `--modified-before` — filter by file modification time
  (ISO 8601 or other supported date formats).
- `--limit` — maximum number of results (defaults to 20).
- `--format` — `json` or `text`. JSON includes structured fields like `path`, `basename`, `tags`.

If the query string is empty or whitespace, search returns all files (subject to filters).

## Output shape (JSON)

The JSON output includes:

- `query`: the original query string (or `null`/empty for no query).
- `filters`: the active filters (tags, path, linksTo, heading, modifiedAfter/Before).
- `results`: array of result objects with at least `path`, `basename`, and `tags`.
- `total`: total number of results (matches `results.length` for the current page).

For examples of the exact structure, see the search command tests in `tests/unit/search-command.test.ts`.

