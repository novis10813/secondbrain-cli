import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createBacklinksCommand(): Command {
  const command = new Command('backlinks')
    .description('Get backlinks for a note')
    .argument('<path-or-id>', 'File path or basename')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action((pathOrId, options) => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        const file = vault.resolvePathOrBasename(pathOrId);
        const resolvedPath = file?.path ?? null;
        if (!resolvedPath) {
          console.error('❌ Note not found');
          process.exit(1);
        }

        const backlinks = vault.getBacklinksByPath(resolvedPath);
        const title = file?.basename ?? resolvedPath.replace(/\.md$/, '');

        if (options.format === 'json') {
          console.log(JSON.stringify({
            path: resolvedPath,
            title,
            backlinkCount: backlinks.length,
            backlinks: backlinks.map(b => ({
              path: b.path,
              basename: b.basename
            }))
          }, null, 2));
        } else {
          console.log(`Backlinks for "${title}":\n`);
          if (backlinks.length === 0) {
            console.log('No backlinks found');
          } else {
            backlinks.forEach((b, i) => {
              console.log(`${i + 1}. ${b.basename}`);
              console.log(`   Path: ${b.path}`);
              console.log();
            });
          }
        }

        vault.close();
      } catch (error) {
        console.error('❌ Failed to get backlinks:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
