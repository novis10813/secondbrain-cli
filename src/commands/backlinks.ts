import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createBacklinksCommand(): Command {
  const command = new Command('backlinks')
    .description('Get backlinks for a note')
    .argument('<id>', 'Note ID')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action((id, options) => {
      try {
        const vaultPath = ConfigManager.findVaultPath();
        if (!vaultPath) {
          console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
          process.exit(1);
        }

        const configManager = new ConfigManager(vaultPath);
        const config = configManager.getConfig();
        const vault = new VaultManager(config);

        // First check if note exists
        const note = vault.getNoteById(id);
        if (!note) {
          console.error('❌ Note not found');
          process.exit(1);
        }

        const backlinks = vault.getBacklinks(id);

        if (options.format === 'json') {
          console.log(JSON.stringify({
            noteId: id,
            noteTitle: note.title,
            backlinkCount: backlinks.length,
            backlinks: backlinks.map(b => ({
              id: b.id,
              title: b.title,
              path: b.path,
              tags: b.tags
            }))
          }, null, 2));
        } else {
          console.log(`Backlinks for "${note.title}":\n`);
          if (backlinks.length === 0) {
            console.log('No backlinks found');
          } else {
            backlinks.forEach((b, i) => {
              console.log(`${i + 1}. ${b.title}`);
              console.log(`   Path: ${b.path}`);
              console.log(`   ID: ${b.id}`);
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
