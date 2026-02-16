import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createMigrateCommand(): Command {
  const command = new Command('migrate')
    .description('Migrate data from old schema (notes table) to new schema (files + content_metadata)')
    .action(() => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        const result = vault.migrateFromOldSchema();

        console.log('✅ Migration complete');
        console.log(`Migrated: ${result.migrated}`);
        console.log(`Skipped (already in new schema): ${result.skipped}`);
        if (result.errors > 0) {
          console.log(`Errors: ${result.errors}`);
        }

        vault.close();
      } catch (error) {
        console.error('❌ Migration failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
