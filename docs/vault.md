## Vaults and multi-vault management

SecondBrain CLI can manage multiple Obsidian vaults. The `sb vault` command group lets you
register vaults, switch the active vault for your shell session, and set a default vault.

Most other commands (`sb sync`, `sb search`, `sb capture`, etc.) resolve the current vault using
this priority:

1. `SECONDBRAIN_VAULT` environment variable (vault name or absolute path)
2. Current directory (walk up to find a `.secondbrain/` folder)
3. Default vault from the global registry

## Global registry

Vault registrations are stored in a global config file (see `GlobalConfigManager`). Each entry
has a **name** and a **path**. Names must be unique; paths must not be duplicated.

You usually interact with the registry through CLI commands rather than editing it directly.

## Commands

### Initialize a vault

```bash
# Initialize a new vault at the default location (e.g. ~/vault/)
sb vault init

# Initialize the current directory as a vault
sb vault init .

# Initialize a specific path as a vault
sb vault init /path/to/my-notes
```

This creates a `.secondbrain/` directory with `config.json` and `index.db`.

### List registered vaults

```bash
sb vault list
```

Shows all registered vaults with their names and paths, plus an indicator for the default vault.

### Use a vault for the current shell session

```bash
# Print an export command; use eval to activate
eval $(sb vault use my-notes)

# Confirm which vault is active
sb vault current
```

`sb vault use` prints a shell snippet that sets `SECONDBRAIN_VAULT` for the current session. Use
`eval` to apply it in one step.

### Default vault

```bash
# Show default vault (if any)
sb vault default

# Set default vault by name
sb vault default set my-notes
```

The default vault is used when `SECONDBRAIN_VAULT` is not set and the current directory does not
contain a `.secondbrain/` directory.

### Delete a vault registration

```bash
# Remove from registry without deleting files
sb vault delete my-notes
```

This only removes the entry from the global registry. It does **not** delete the vault’s
directory or notes.

