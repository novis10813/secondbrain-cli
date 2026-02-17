import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';

export function createBacklinksCommand(): Command {
  const command = new Command('backlinks')
    .description('Get backlinks for a note')
    .argument('<path-or-id>', 'File path or basename')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (pathOrId, options) => {
      await withVault((vault) => {
        const file = vault.resolvePathOrBasename(pathOrId);
        const resolvedPath = file?.path ?? null;
        if (!resolvedPath) {
          throw new Error('Note not found');
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
      });
    });

  return command;
}
