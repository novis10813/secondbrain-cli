import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createStatsCommand(): Command {
  const command = new Command('stats')
    .description('Show vault statistics')
    .option('-f, --format <format>', 'Output format (json|text)', 'text')
    .action((options) => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        const stats = vault.getStats();

        if (options.format === 'json') {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log('📊 Vault Statistics\n');
          console.log('Total notes:', stats.totalNotes);
          console.log('Total links:', stats.totalLinks);
          console.log('Orphan notes:', stats.orphans);
          
          if (stats.orphans > 0) {
            console.log();
            console.log('⚠️  Run `sb orphans` to see disconnected notes');
          }
        }

        vault.close();
      } catch (error) {
        console.error('❌ Failed to get stats:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
