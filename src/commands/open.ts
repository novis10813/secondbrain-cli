import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';

export function createOpenCommand(): Command {
  const command = new Command('open')
    .description('Resolve a link to a file and position for editor navigation (path:line:col)')
    .argument('<linkpath>', 'Obsidian-style link (e.g. note, note#heading, note#^block-id)')
    .option('-s, --source <path>', 'Source file path for relative link resolution', '')
    .option('-f, --format <format>', 'Output format (position|json)', 'position')
    .action(async (linkpath, options) => {
      try {
        await withVault((vault) => {
          const result = vault.resolveLinkToPosition(linkpath, options.source ?? '');
          if (!result) {
            console.error('❌ Link not found');
            process.exit(1);
          }
          if (options.format === 'json') {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`${result.path}:${result.line}:${result.col}`);
          }
        });
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
