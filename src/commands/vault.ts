// src/commands/vault.ts
import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { GlobalConfigManager } from '../utils/global-config.js';
import { resolveVaultPath } from '../utils/vault-resolve.js';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import * as readline from 'readline';

const DEFAULT_VAULT_PATH = join(homedir(), 'vault');

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function confirm(message: string): Promise<boolean> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

export function createVaultCommand(): Command {
  const command = new Command('vault')
    .description('Manage SecondBrain vaults');

  // sb vault init [path]
  command
    .command('init [path]')
    .description('Initialize a new SecondBrain vault')
    .action((path?: string) => {
      try {
        const vaultPath = resolve(path ?? DEFAULT_VAULT_PATH);
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

  // sb vault use <name|path>
  command
    .command('use <nameOrPath>')
    .description('Output export command to set active vault (use with eval)')
    .action((nameOrPath: string) => {
      const globalConfig = new GlobalConfigManager();
      const vault = globalConfig.findVault(nameOrPath);

      let vaultPath: string;
      if (vault) {
        vaultPath = vault.path;
      } else if (existsSync(join(nameOrPath, '.secondbrain', 'config.json'))) {
        vaultPath = resolve(nameOrPath);
      } else {
        console.error(`❌ Vault not found: ${nameOrPath}`);
        console.error('Run `sb vault list` to see available vaults');
        process.exit(1);
      }

      // 輸出 export 語句，供 eval 使用
      console.log(`export SECONDBRAIN_VAULT="${vaultPath}"`);
    });

  // sb vault current
  command
    .command('current')
    .description('Show the currently active vault')
    .action(() => {
      const vaultPath = resolveVaultPath();
      
      if (!vaultPath) {
        console.log('❌ No active vault');
        console.log('Set a vault with: eval $(sb vault use <name>)');
        return;
      }

      const globalConfig = new GlobalConfigManager();
      const vault = globalConfig.findVault(vaultPath);
      const envVault = process.env.SECONDBRAIN_VAULT;

      console.log('📁 Current vault:', vault?.name ?? vaultPath);
      console.log('   Path:', vaultPath);
      
      if (envVault) {
        console.log('   Source: SECONDBRAIN_VAULT environment variable');
      } else if (ConfigManager.findVaultPath() === vaultPath) {
        console.log('   Source: Local directory detection');
      } else {
        console.log('   Source: Default vault');
      }
    });

  // sb vault list
  command
    .command('list')
    .description('List all registered vaults')
    .action(() => {
      const globalConfig = new GlobalConfigManager();
      const vaults = globalConfig.listVaults();
      const defaultVault = globalConfig.getDefault();
      const currentPath = resolveVaultPath();

      if (vaults.length === 0) {
        console.log('No vaults registered.');
        console.log('Initialize a vault with: sb vault init [path]');
        return;
      }

      console.log('Registered vaults:\n');
      for (const vault of vaults) {
        const isDefault = defaultVault?.name === vault.name;
        const isCurrent = currentPath === vault.path;
        const markers = [
          isDefault ? '(default)' : '',
          isCurrent ? '(current)' : ''
        ].filter(Boolean).join(' ');
        
        console.log(`  ${vault.name} ${markers}`);
        console.log(`    ${vault.path}`);
      }
    });

  // sb vault default (查看)
  const defaultCommand = command
    .command('default')
    .description('Show or set the default vault');

  defaultCommand
    .action(() => {
      const globalConfig = new GlobalConfigManager();
      const defaultVault = globalConfig.getDefault();

      if (!defaultVault) {
        console.log('No default vault set.');
        console.log('Set a default with: sb vault default set <name>');
        return;
      }

      console.log('Default vault:', defaultVault.name);
      console.log('Path:', defaultVault.path);
    });

  // sb vault default set <name|path>
  defaultCommand
    .command('set <nameOrPath>')
    .description('Set the default vault')
    .action((nameOrPath: string) => {
      const globalConfig = new GlobalConfigManager();
      
      try {
        globalConfig.setDefault(nameOrPath);
        const vault = globalConfig.findVault(nameOrPath);
        console.log(`✅ Default vault set to: ${vault?.name ?? nameOrPath}`);
      } catch (error) {
        console.error('❌', error instanceof Error ? error.message : String(error));
        console.error('Run `sb vault list` to see available vaults');
        process.exit(1);
      }
    });

  // sb vault delete <name|path>
  command
    .command('delete <nameOrPath>')
    .description('Remove a vault from the registry (does not delete files)')
    .action(async (nameOrPath: string) => {
      const globalConfig = new GlobalConfigManager();
      const vault = globalConfig.findVault(nameOrPath);

      if (!vault) {
        console.error(`❌ Vault not found: ${nameOrPath}`);
        process.exit(1);
      }

      const confirmed = await confirm(
        `確定要移除 vault "${vault.name}" (${vault.path}) 的註冊嗎？`
      );

      if (!confirmed) {
        console.log('取消操作');
        return;
      }

      globalConfig.removeVault(nameOrPath);
      console.log(`✅ Removed vault: ${vault.name}`);
      console.log('Note: The vault files were not deleted.');
    });

  return command;
}
