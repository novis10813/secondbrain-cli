import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createOpenCommand(): Command {
  const command = new Command('open')
    .description('Resolve a link to a file and position for editor navigation (path:line:col)')
    .argument('<linkpath>', 'Obsidian-style link (e.g. note, note#heading, note#^block-id)')
    .option('-s, --source <path>', 'Source file path for relative link resolution', '')
    .option('-f, --format <format>', 'Output format (position|json)', 'position')
    .action((linkpath, options) => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        const result = vault.resolveLinkToPosition(linkpath, options.source ?? '');
        vault.close();

        if (!result) {
          console.error('❌ Link not found');
          process.exit(1);
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`${result.path}:${result.line}:${result.col}`);
        }
      } catch (error) {
        console.error(
          '❌ Failed to resolve link:',
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  return command;
}
