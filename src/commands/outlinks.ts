import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';

export function createOutlinksCommand(): Command {
  const command = new Command('outlinks')
    .description('Get outgoing links from a note (files this note links to)')
    .argument('<path-or-id>', 'File path or basename')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (pathOrId, options) => {
      try {
        await withVault((vault) => {
          const file = vault.resolvePathOrBasename(pathOrId);
          const resolvedPath = file?.path ?? null;
          if (!resolvedPath) {
            console.error('❌ Note not found');
            process.exit(1);
          }

          const outlinks = vault.getOutlinksByPath(resolvedPath);
          const title = file?.basename ?? resolvedPath.replace(/\.md$/, '');

          if (options.format === 'json') {
            console.log(JSON.stringify({
              path: resolvedPath,
              title,
              outlinkCount: outlinks.length,
              outlinks: outlinks.map(o => ({
                path: o.path,
                basename: o.basename
              }))
            }, null, 2));
          } else {
            console.log(`Outlinks from "${title}":\n`);
            if (outlinks.length === 0) {
              console.log('No outlinks found');
            } else {
              outlinks.forEach((o, i) => {
                console.log(`${i + 1}. ${o.basename}`);
                console.log(`   Path: ${o.path}`);
                console.log();
              });
            }
          }
        });
      } catch (error) {
        console.error('❌ Failed to get outlinks:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
