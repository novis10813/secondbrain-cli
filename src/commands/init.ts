import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { GlobalConfigManager } from '../utils/global-config.js';
import { resolve, join } from 'path';
import { homedir } from 'os';

const DEFAULT_VAULT_PATH = join(homedir(), 'vault');

export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize a new SecondBrain vault (alias for `sb vault init`)')
    .option('-p, --path <path>', 'Vault path', process.cwd())
    .argument('[path]', 'Vault path')
    .action((path?: string, options?: { path?: string }) => {
      try {
        const vaultPath = resolve(path ?? options?.path ?? DEFAULT_VAULT_PATH);
        const configManager = new ConfigManager(vaultPath);
        const globalConfig = new GlobalConfigManager();

        if (configManager.isInitialized()) {
          console.log('⚠️  Vault already initialized at:', vaultPath);
          
          // 確保已註冊到全域設定
          const entry = globalConfig.addVault(vaultPath);
          if (entry) {
            console.log(`✅ Registered as "${entry.name}" in global config`);
          }
          return;
        }

        const config = configManager.init();
        const entry = globalConfig.addVault(vaultPath);

        console.log('✅ SecondBrain vault initialized!');
        console.log('Vault path:', config.vaultPath);
        console.log('Vault name:', entry?.name ?? 'unknown');
        console.log('Daily notes:', config.dailyNotesFolder);
        console.log('Templates:', config.templatesFolder);
        console.log();
        console.log('Next steps:');
        console.log('  1. Create notes in your vault');
        console.log('  2. Run `sb sync` to index existing notes');
        console.log('  3. Use `sb capture` to create new notes');
        console.log();
        console.log('To use this vault:');
        console.log(`  eval $(sb vault use ${entry?.name ?? vaultPath})`);
      } catch (error) {
        console.error('❌ Failed to initialize vault:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}
