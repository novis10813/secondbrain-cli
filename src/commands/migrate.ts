import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';

export function createMigrateCommand(): Command {
  const command = new Command('migrate')
    .description('Migrate data from old schema (notes table) to new schema (files + content_metadata)')
    .action(async () => {
      await withVault((vault) => {
        const result = vault.migrateFromOldSchema();
        console.log('✅ Migration complete');
        console.log(`Migrated: ${result.migrated}`);
        console.log(`Skipped (already in new schema): ${result.skipped}`);
        if (result.errors > 0) {
          console.log(`Errors: ${result.errors}`);
        }
      });
    });

  return command;
}
