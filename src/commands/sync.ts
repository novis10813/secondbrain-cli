import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createSyncCommand(): Command {
  const command = new Command('sync')
    .description('Sync vault with database index')
    .action(async () => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        console.log('🔄 Syncing vault...');
        
        const result = await vault.sync();

        console.log('✅ Sync complete!');
        console.log(`Added: ${result.added}`);
        console.log(`Updated: ${result.updated}`);
        console.log(`Removed: ${result.removed}`);

        const stats = vault.getStats();
        console.log();
        console.log('Vault stats:');
        console.log(`Total notes: ${stats.totalNotes}`);
        console.log(`Total links: ${stats.totalLinks}`);
        console.log(`Orphan notes: ${stats.orphans}`);

        vault.close();
      } catch (error) {
        console.error('❌ Sync failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
