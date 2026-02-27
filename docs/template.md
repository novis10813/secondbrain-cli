## Templates: reusable note structures

Templates let you standardize how notes are created, which is especially useful for LLM agents.
Files are stored under the configured `templatesFolder` in `.secondbrain/config.json`
(for example `Templates/`).

The `sb template` command group manages templates, while `sb capture` applies them.

## Template files

A template is a Markdown file that may contain placeholders:

- `{{variable}}` — user-provided variables.
- Built-ins such as `{{DATE}}`, `{{TIME}}`, `{{TITLE}}`, `{{UUID}}`, etc.

Frontmatter inside the template is preserved and can also contain placeholders.

## Commands

### List templates

```bash
sb template list
```

Shows all templates in the configured templates folder.

### Configure target folder

```bash
sb template set <name> --targetFolder="Projects"
sb template get <name>
```

Stores template-specific configuration in `.secondbrain/config.json`, such as the default folder
where notes created from this template should live.

### Delete a template

```bash
sb template delete <name>
```

Removes the template file (but not existing notes that were created from it).

## Using templates with capture

```bash
sb capture "Meeting notes" \
  --title="Client sync" \
  --tags="meeting,client" \
  --template="meeting"
```

The TemplateManager resolves the template file, substitutes placeholders, and writes the final
note into the vault. Required fields and placeholder validation are covered by tests in
`tests/unit/template-manager.test.ts`.

