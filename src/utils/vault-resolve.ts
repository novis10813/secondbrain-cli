import type { Config } from '../types/index.js';
import { ConfigManager } from './config.js';
import { VaultManager } from './vault.js';

const NOT_IN_VAULT_MSG = '❌ Not in a SecondBrain vault. Run `sb init` first.';

/**
 * Resolve vault path and run fn with a VaultManager. Ensures vault.close() in finally.
 * Exits with 1 if not inside a SecondBrain vault.
 */
export async function withVault(
  fn: (vault: VaultManager) => void | Promise<void>
): Promise<void> {
  const vaultPath = ConfigManager.findVaultPath();
  if (!vaultPath) {
    console.error(NOT_IN_VAULT_MSG);
    process.exit(1);
  }
  const configManager = new ConfigManager(vaultPath);
  const config = configManager.getConfig();
  const vault = new VaultManager(config);
  try {
    await fn(vault);
  } catch (error) {
    console.error('❌', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    vault.close();
  }
}

/**
 * Get config for current vault or exit. Use when only config is needed (e.g. config command).
 */
export function getConfigOrExit(): Config {
  const vaultPath = ConfigManager.findVaultPath();
  if (!vaultPath) {
    console.error(NOT_IN_VAULT_MSG);
    process.exit(1);
  }
  const configManager = new ConfigManager(vaultPath);
  return configManager.getConfig();
}
