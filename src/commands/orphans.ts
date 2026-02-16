import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createOrphansCommand(): Command {
  const command = new Command('orphans')
    .description('Find notes with no links (orphans)')
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

        const orphans = vault.getOrphanFiles();

        if (options.format === 'json') {
          console.log(JSON.stringify({
            count: orphans.length,
            orphans: orphans.map(o => ({
              path: o.path,
              basename: o.basename
            }))
          }, null, 2));
        } else {
          if (orphans.length === 0) {
            console.log('✅ No orphan notes found. All notes are connected!');
          } else {
            console.log(`⚠️  Found ${orphans.length} orphan note(s):\n`);
            orphans.forEach((file, i) => {
              console.log(`${i + 1}. ${file.basename}`);
              console.log(`   Path: ${file.path}`);
              console.log();
            });
          }
        }

        vault.close();
      } catch (error) {
        console.error('❌ Failed to get orphans:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
