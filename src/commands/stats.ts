import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';

export function createStatsCommand(): Command {
  const command = new Command('stats')
    .description('Show vault statistics')
    .option('-f, --format <format>', 'Output format (json|text)', 'text')
    .action(async (options) => {
      await withVault((vault) => {
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
      });
    });

  return command;
}
