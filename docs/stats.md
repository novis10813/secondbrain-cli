## Stats and orphans: vault health

SecondBrain CLI provides maintenance commands to get a high-level view of your vault and to find
notes that are not connected to the rest of the graph.

## Stats

```bash
sb stats
sb stats --format=json
```

This command reports aggregate information such as:

- Total number of notes.
- Total number of links.
- Number of orphan files.

JSON output is suitable for dashboards or automated checks.

## Orphans

```bash
sb orphans
sb orphans --format=json
```

Lists notes that have no incoming or outgoing links (orphans).

This is useful for:

- Finding notes that might be obsolete or forgotten.
- Checking the connectivity of your knowledge graph.

For more details on how orphans and link counts are computed, see `docs/database-schema.md` and
the `VaultManager` section in `docs/modules.md`.

