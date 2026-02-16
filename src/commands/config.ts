import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';

export function createConfigCommand(): Command {
  const command = new Command('config')
    .description('Manage configuration')
    .addCommand(
      new Command('get')
        .description('Get configuration value')
        .argument('<key>', 'Configuration key')
        .action((key) => {
          try {
            const vaultPath = ConfigManager.findVaultPath();
            if (!vaultPath) {
              console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
              process.exit(1);
            }

            const configManager = new ConfigManager(vaultPath);
            const config = configManager.getConfig();

            if (key in config) {
              console.log((config as unknown as Record<string, unknown>)[key]);
            } else {
              console.error(`❌ Unknown config key: ${key}`);
              console.log('Available keys: vaultPath, dailyNotesFolder, templatesFolder, dbPath');
              process.exit(1);
            }
          } catch (error) {
            console.error('❌ Failed to get config:', error instanceof Error ? error.message : String(error));
            process.exit(1);
          }
        })
    )
    .addCommand(
      new Command('set')
        .description('Set configuration value')
        .argument('<key>', 'Configuration key')
        .argument('<value>', 'Configuration value')
        .action((key, value) => {
          try {
            const vaultPath = ConfigManager.findVaultPath();
            if (!vaultPath) {
              console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
              process.exit(1);
            }

            const configManager = new ConfigManager(vaultPath);
            const validKeys = ['dailyNotesFolder', 'templatesFolder'];

            if (!validKeys.includes(key)) {
              console.error(`❌ Cannot set config key: ${key}`);
              console.log(`Editable keys: ${validKeys.join(', ')}`);
              process.exit(1);
            }

            configManager.updateConfig({ [key]: value });
            console.log(`✅ Set ${key} = ${value}`);
          } catch (error) {
            console.error('❌ Failed to set config:', error instanceof Error ? error.message : String(error));
            process.exit(1);
          }
        })
    )
    .addCommand(
      new Command('list')
        .description('List all configuration')
        .action(() => {
          try {
            const vaultPath = ConfigManager.findVaultPath();
            if (!vaultPath) {
              console.error('❌ Not in a SecondBrain vault. Run `sb init` first.');
              process.exit(1);
            }

            const configManager = new ConfigManager(vaultPath);
            const config = configManager.getConfig();

            console.log('Configuration:\n');
            Object.entries(config).forEach(([key, value]) => {
              console.log(`${key}: ${value}`);
            });
          } catch (error) {
            console.error('❌ Failed to list config:', error instanceof Error ? error.message : String(error));
            process.exit(1);
          }
        })
    );

  return command;
}
