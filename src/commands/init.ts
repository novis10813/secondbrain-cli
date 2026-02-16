import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';

export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize a new SecondBrain vault')
    .option('-p, --path <path>', 'Vault path', process.cwd())
    .action((options) => {
      try {
        const configManager = new ConfigManager(options.path);
        
        if (configManager.isInitialized()) {
          console.log('⚠️  Vault already initialized at:', options.path);
          return;
        }

        const config = configManager.init();
        
        console.log('✅ SecondBrain vault initialized!');
        console.log('Vault path:', config.vaultPath);
        console.log('Daily notes:', config.dailyNotesFolder);
        console.log('Templates:', config.templatesFolder);
        console.log();
        console.log('Next steps:');
        console.log('  1. Create notes in your vault');
        console.log('  2. Run `sb sync` to index existing notes');
        console.log('  3. Use `sb capture` to create new notes');
      } catch (error) {
        console.error('❌ Failed to initialize vault:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
