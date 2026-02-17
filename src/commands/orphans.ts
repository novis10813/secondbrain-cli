import { Command } from 'commander';
import { withVault } from '../utils/vault-resolve.js';

export function createOrphansCommand(): Command {
  const command = new Command('orphans')
    .description('Find notes with no links (orphans)')
    .option('-f, --format <format>', 'Output format (json|text)', 'text')
    .action(async (options) => {
      await withVault((vault) => {
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
      });
    });

  return command;
}
