## SecondBrain CLI

SecondBrain CLI is a command-line tool for LLM agents and power users to work with Obsidian
vaults. It keeps your vault fully compatible with Obsidian while providing a fast SQLite index
and JSON-friendly APIs.

For a Chinese version of this document, see `README_zh.md`.

## Features

- **Dual-storage architecture**: SQLite index + raw Markdown files (never rewrites your notes)
- **Rich link system**: `[[wikilinks]]`, backlinks, outlinks, orphan detection
- **Agent-first design**: JSON output, structured data, easy to pipe and script
- **Obsidian compatibility**: Aligned with TFile / CachedMetadata, safe to use on existing vaults
- **Standardized capture**: Template system that enforces consistent note formats

## Installation

```bash
npm install -g @novis10813/secondbrain-cli
```

- **Runtime**: Node.js 18+ (required)
- **Optional**: Bun for local development and tests (`bun test`, `bun run dev`)

After global install you can use the `sb` binary from anywhere.

## Quick start

```bash
# 1) Initialize in an existing Obsidian vault
cd ~/my-obsidian-vault
sb init

# 2) Index existing notes into SQLite
sb sync

# 3) Capture a new note with title and tags
sb capture "This is the note content" \
  --title="My note" \
  --tags="idea,work"

# 4) Search notes (JSON output for agents)
sb search "API design" --tags="tech" --format=json

# 5) Backlinks and outlinks
sb backlinks <path-or-id>
sb outlinks <path-or-id>

# 6) Resolve linkpaths to path:line:col (for editors)
sb open "My Note#Section"

# 7) Find orphan notes (no links in or out)
sb orphans
```

`<path-or-id>` accepts either a relative path inside the vault (e.g. `Projects/api-design.md`) or
a basename that can be resolved uniquely.

## CLI overview

SecondBrain CLI groups commands into a few core utilities. Each has its own usage guide under
`docs/`:

- **Vault management**: `sb vault ...` — multi-vault registry and active vault selection  
  See `docs/vault.md`.
- **Sync**: `sb sync` — scan Markdown files, parse, and update the SQLite index  
  See `docs/sync.md`.
- **Capture & templates**: `sb capture`, `sb template ...` — create notes and enforce formats  
  See `docs/capture.md` and `docs/template.md`.
- **Search**: `sb search` — query by name, tags, path prefix, links, headings, modification time  
  See `docs/search.md`.
- **Links & navigation**: `sb backlinks`, `sb outlinks`, `sb open` — link graph and positions  
  See `docs/backlinks.md` and `docs/open.md`.
- **Config & maintenance**: `sb config`, `sb stats`, `sb orphans`, `sb migrate`  
  See `docs/config.md`, `docs/stats.md`, and `docs/migrate.md`.

For a full command and module reference, see `docs/modules.md`.

## Data layout

```text
/your-vault/
├── Projects/
│   └── api-design.md          # Raw Markdown files (Obsidian-compatible)
├── Daily/
│   └── 2024-01-15.md
└── .secondbrain/
    ├── config.json            # Vault config (paths, folders, DB path)
    └── index.db               # SQLite index (files + metadata)
```

The CLI reads and writes only inside the vault and `.secondbrain/` directory. Note content is
never rewritten except when you explicitly create notes via `sb capture` or templates.

## Development

```bash
# Install dependencies
bun install

# Run from source
bun run dev

# Build TypeScript to dist/
bun run build

# Type-check only
bun run lint

# Run tests
bun test
```

This repository targets Bun for development, but the published package works on standard Node.js
18+ environments.

## License

MIT

