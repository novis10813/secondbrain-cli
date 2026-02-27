## Capture: creating notes

The `sb capture` command creates a new Markdown note in your vault using optional templates,
title, tags, and target path.

It is designed to be easy to call from LLM agents and scripts.

## Basic usage

```bash
sb capture "Note content" \
  --title="My note" \
  --tags="tag1,tag2" \
  --template="meeting" \
  --path="Projects"
```

Arguments and options:

- Positional `content` (required): the Markdown body of the note.
- `--title` (optional): title used for the note and filename when appropriate.
- `--tags` (optional): comma-separated tags, stored in frontmatter.
- `--template` (optional): template name under the configured templates folder.
- `--path` (optional): target folder path inside the vault (e.g. `Daily`, `Projects/ClientA`).

The command writes a Markdown file, updates the SQLite index, and prints information suitable for
agents to consume.

## Templates

Templates live under the templates folder configured in `.secondbrain/config.json` (for example
`Templates/meeting.md`). They can include placeholders such as:

- `{{variable}}` — user-provided variables.
- Built-in placeholders like `{{DATE}}`, `{{TIME}}`, `{{TITLE}}`, `{{UUID}}` (see tests and
  TemplateManager docs for exact semantics).

You can manage templates via the `sb template` command group; see `docs/template.md`.

## path-or-id semantics

When capture creates a note, it chooses a path and an internal ID based on content and title.
Other commands accept either:

- A relative path inside the vault, e.g. `Projects/api-design.md`.
- A basename, e.g. `api-design`, as long as it resolves uniquely.

For details on how linkpaths and IDs are resolved, see `docs/open.md` and `docs/backlinks.md`.

