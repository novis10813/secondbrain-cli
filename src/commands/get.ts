import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { VaultManager } from '../utils/vault.js';

export function createGetCommand(): Command {
  const command = new Command('get')
    .description('Get a note by ID')
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

        const note = vault.getNoteById(id);

        if (!note) {
          console.error('❌ Note not found');
          process.exit(1);
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(note, null, 2));
        } else {
          console.log(note.title);
          console.log('─'.repeat(40));
          console.log(note.content);
        }

        vault.close();
      } catch (error) {
        console.error('❌ Failed to get note:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
