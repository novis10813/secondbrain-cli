import type { Config } from '../types/index.js';
import { ConfigManager } from './config.js';
import { GlobalConfigManager } from './global-config.js';
import { VaultManager } from './vault.js';
import { existsSync } from 'fs';
import { join } from 'path';

const NOT_IN_VAULT_MSG = `❌ 找不到可用的 vault
   • 設定環境變數：export SECONDBRAIN_VAULT=<name|path>
   • 或進入 vault 目錄
   • 或設定預設 vault：sb vault default set <name>
   • 或初始化新 vault：sb vault init`;

export interface ResolveOptions {
  globalConfigDir?: string;
  cwd?: string;
}

/**
 * 解析 vault 路徑，依照優先順序：
 * 1. 環境變數 SECONDBRAIN_VAULT（名稱或路徑）
 * 2. 當前目錄（往上找 .secondbrain/config.json）
 * 3. 預設 vault
 */
export function resolveVaultPath(options: ResolveOptions = {}): string | null {
  const globalConfig = new GlobalConfigManager(options.globalConfigDir);
  const cwd = options.cwd ?? process.cwd();

  // 1. 環境變數
  const envVault = process.env.SECONDBRAIN_VAULT;
  if (envVault) {
    // 先嘗試作為路徑
    if (existsSync(join(envVault, '.secondbrain', 'config.json'))) {
      return envVault;
    }
    // 再嘗試作為名稱
    const entry = globalConfig.findVault(envVault);
    if (entry && existsSync(join(entry.path, '.secondbrain', 'config.json'))) {
      return entry.path;
    }
  }

  // 2. 當前目錄（向上查找）
  const localVault = ConfigManager.findVaultPath(cwd);
  if (localVault) {
    return localVault;
  }

  // 3. 預設 vault
  const defaultVault = globalConfig.getDefault();
  if (defaultVault && existsSync(join(defaultVault.path, '.secondbrain', 'config.json'))) {
    return defaultVault.path;
  }

  return null;
}

/**
 * Resolve vault path and run fn with a VaultManager. Ensures vault.close() in finally.
 * Exits with 1 if not inside a SecondBrain vault.
 */
export async function withVault(
  fn: (vault: VaultManager) => void | Promise<void>,
  options: ResolveOptions = {}
): Promise<void> {
  const vaultPath = resolveVaultPath(options);
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
export function getConfigOrExit(options: ResolveOptions = {}): Config {
  const vaultPath = resolveVaultPath(options);
  if (!vaultPath) {
    console.error(NOT_IN_VAULT_MSG);
    process.exit(1);
  }
  const configManager = new ConfigManager(vaultPath);
  return configManager.getConfig();
}
