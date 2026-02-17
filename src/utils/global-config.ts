// src/utils/global-config.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { GlobalConfig, VaultEntry } from '../types/index.js';

const DEFAULT_CONFIG_DIR = join(homedir(), '.config', 'secondbrain');
const CONFIG_FILE = 'vaults.json';

export class GlobalConfigManager {
  private configDir: string;

  constructor(configDir: string = DEFAULT_CONFIG_DIR) {
    this.configDir = configDir;
  }

  get configPath(): string {
    return join(this.configDir, CONFIG_FILE);
  }

  /**
   * 初始化全域設定（建立目錄與預設 vaults.json）
   */
  init(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    if (!existsSync(this.configPath)) {
      this.save({ vaults: [] });
    }
  }

  /**
   * 確保設定檔存在，若不存在則初始化
   */
  ensureInitialized(): void {
    if (!existsSync(this.configPath)) {
      this.init();
    }
  }

  /**
   * 載入全域設定
   */
  load(): GlobalConfig {
    this.ensureInitialized();
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content) as GlobalConfig;
    } catch {
      return { vaults: [] };
    }
  }

  /**
   * 儲存全域設定
   */
  save(config: GlobalConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * 根據路徑產生 vault 名稱，處理重複名稱
   */
  private generateVaultName(vaultPath: string, existingNames: string[]): string {
    const baseName = basename(vaultPath);
    if (!existingNames.includes(baseName)) {
      return baseName;
    }
    
    // 找到下一個可用的數字後綴
    let suffix = 2;
    while (existingNames.includes(`${baseName}-${suffix}`)) {
      suffix++;
    }
    return `${baseName}-${suffix}`;
  }

  /**
   * 新增 vault 到全域設定
   * @returns 新增的 VaultEntry，若已存在則回傳 null
   */
  addVault(vaultPath: string): VaultEntry | null {
    const config = this.load();
    
    // 檢查路徑是否已存在
    if (config.vaults.some(v => v.path === vaultPath)) {
      return null;
    }
    
    const existingNames = config.vaults.map(v => v.name);
    const name = this.generateVaultName(vaultPath, existingNames);
    
    const entry: VaultEntry = { name, path: vaultPath };
    config.vaults.push(entry);
    this.save(config);
    
    return entry;
  }

  /**
   * 移除 vault（by name 或 path）
   * @returns 是否成功移除
   */
  removeVault(nameOrPath: string): boolean {
    const config = this.load();
    const index = config.vaults.findIndex(
      v => v.name === nameOrPath || v.path === nameOrPath
    );
    
    if (index === -1) {
      return false;
    }
    
    const removed = config.vaults[index];
    config.vaults.splice(index, 1);
    
    // 如果移除的是預設 vault，清空 default
    if (config.default === removed.name) {
      delete config.default;
    }
    
    this.save(config);
    return true;
  }

  /**
   * 設定預設 vault
   */
  setDefault(nameOrPath: string): void {
    const config = this.load();
    const vault = config.vaults.find(
      v => v.name === nameOrPath || v.path === nameOrPath
    );
    
    if (!vault) {
      throw new Error(`Vault not found: ${nameOrPath}`);
    }
    
    config.default = vault.name;
    this.save(config);
  }

  /**
   * 取得預設 vault
   */
  getDefault(): VaultEntry | undefined {
    const config = this.load();
    if (!config.default) {
      return undefined;
    }
    return config.vaults.find(v => v.name === config.default);
  }

  /**
   * 依名稱或路徑尋找 vault
   */
  findVault(nameOrPath: string): VaultEntry | undefined {
    const config = this.load();
    return config.vaults.find(
      v => v.name === nameOrPath || v.path === nameOrPath
    );
  }

  /**
   * 列出所有 vault
   */
  listVaults(): VaultEntry[] {
    return this.load().vaults;
  }
}
