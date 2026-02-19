# Global Vault Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓 `sb` 指令可以在任何目錄使用，透過全域設定管理多個 vault，類似 nvm/uv 的使用體驗。

**Architecture:**
- 新增全域設定檔 `~/.config/secondbrain/vaults.json` 記錄所有已註冊的 vault
- Vault 解析優先順序：環境變數 `SECONDBRAIN_VAULT` > 當前目錄 > 預設 vault
- 新增 `sb vault` 指令群管理 vault，保留 `sb init` 作為 `sb vault init` 的別名

**Tech Stack:** TypeScript, Commander.js, Node.js fs/os modules

---

## Task 1: 新增全域設定型別定義

**Files:**
- Modify: `src/types/index.ts` (新增型別)

**Step 1: 新增 VaultEntry 和 GlobalConfig 型別**

在 `src/types/index.ts` 檔案末尾新增：

```typescript
/** 單一 Vault 的註冊資訊 */
export interface VaultEntry {
  name: string;
  path: string;
}

/** 全域設定檔結構 (~/.config/secondbrain/vaults.json) */
export interface GlobalConfig {
  vaults: VaultEntry[];
  default?: string;
}
```

**Step 2: 驗證型別正確**

Run: `bun run check`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add GlobalConfig and VaultEntry types"
```

---

## Task 2: 實作全域設定管理器

**Files:**
- Create: `src/utils/global-config.ts`
- Test: `tests/global-config.test.ts`

**Step 1: 建立測試檔案**

```typescript
// tests/global-config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { GlobalConfigManager } from '../src/utils/global-config.js';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('GlobalConfigManager', () => {
  let testConfigDir: string;
  let manager: GlobalConfigManager;

  beforeEach(() => {
    testConfigDir = join(tmpdir(), `sb-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true });
    manager = new GlobalConfigManager(testConfigDir);
  });

  afterEach(() => {
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('init', () => {
    it('should create config directory and vaults.json', () => {
      manager.init();
      expect(existsSync(join(testConfigDir, 'vaults.json'))).toBe(true);
    });

    it('should create empty vaults array', () => {
      manager.init();
      const config = manager.load();
      expect(config.vaults).toEqual([]);
      expect(config.default).toBeUndefined();
    });
  });

  describe('addVault', () => {
    it('should add a vault with auto-generated name', () => {
      manager.init();
      manager.addVault('/home/user/my-notes');
      const config = manager.load();
      expect(config.vaults).toHaveLength(1);
      expect(config.vaults[0].name).toBe('my-notes');
      expect(config.vaults[0].path).toBe('/home/user/my-notes');
    });

    it('should handle duplicate folder names with suffix', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.addVault('/work/notes');
      const config = manager.load();
      expect(config.vaults).toHaveLength(2);
      expect(config.vaults[0].name).toBe('notes');
      expect(config.vaults[1].name).toBe('notes-2');
    });

    it('should not add duplicate paths', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.addVault('/home/user/notes');
      const config = manager.load();
      expect(config.vaults).toHaveLength(1);
    });
  });

  describe('removeVault', () => {
    it('should remove vault by name', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.removeVault('notes');
      const config = manager.load();
      expect(config.vaults).toHaveLength(0);
    });

    it('should remove vault by path', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.removeVault('/home/user/notes');
      const config = manager.load();
      expect(config.vaults).toHaveLength(0);
    });

    it('should clear default if removed vault was default', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.setDefault('notes');
      manager.removeVault('notes');
      const config = manager.load();
      expect(config.default).toBeUndefined();
    });
  });

  describe('setDefault', () => {
    it('should set default vault by name', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.setDefault('notes');
      const config = manager.load();
      expect(config.default).toBe('notes');
    });

    it('should throw if vault not found', () => {
      manager.init();
      expect(() => manager.setDefault('nonexistent')).toThrow();
    });
  });

  describe('findVault', () => {
    it('should find vault by name', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      const vault = manager.findVault('notes');
      expect(vault?.path).toBe('/home/user/notes');
    });

    it('should find vault by path', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      const vault = manager.findVault('/home/user/notes');
      expect(vault?.name).toBe('notes');
    });

    it('should return undefined if not found', () => {
      manager.init();
      const vault = manager.findVault('nonexistent');
      expect(vault).toBeUndefined();
    });
  });

  describe('getDefault', () => {
    it('should return default vault', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.setDefault('notes');
      const vault = manager.getDefault();
      expect(vault?.name).toBe('notes');
    });

    it('should return undefined if no default', () => {
      manager.init();
      const vault = manager.getDefault();
      expect(vault).toBeUndefined();
    });
  });

  describe('listVaults', () => {
    it('should return all vaults', () => {
      manager.init();
      manager.addVault('/home/user/notes');
      manager.addVault('/work/docs');
      const vaults = manager.listVaults();
      expect(vaults).toHaveLength(2);
    });
  });
});
```

**Step 2: 執行測試確認失敗**

Run: `bun test tests/global-config.test.ts`
Expected: FAIL (module not found)

**Step 3: 實作 GlobalConfigManager**

```typescript
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
```

**Step 4: 執行測試確認通過**

Run: `bun test tests/global-config.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/utils/global-config.ts tests/global-config.test.ts
git commit -m "feat(global-config): add GlobalConfigManager for multi-vault support"
```

---

## Task 3: 修改 vault-resolve.ts 實作新的解析優先順序

**Files:**
- Modify: `src/utils/vault-resolve.ts`
- Test: `tests/vault-resolve.test.ts`

**Step 1: 建立測試檔案**

```typescript
// tests/vault-resolve.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { resolveVaultPath } from '../src/utils/vault-resolve.js';
import { GlobalConfigManager } from '../src/utils/global-config.js';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('resolveVaultPath', () => {
  let testDir: string;
  let testConfigDir: string;
  let testVaultPath: string;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `sb-resolve-test-${Date.now()}`);
    testConfigDir = join(testDir, 'config');
    testVaultPath = join(testDir, 'vault');
    
    // Create test vault with .secondbrain
    mkdirSync(join(testVaultPath, '.secondbrain'), { recursive: true });
    writeFileSync(
      join(testVaultPath, '.secondbrain', 'config.json'),
      JSON.stringify({ vaultPath: testVaultPath })
    );
    
    // Initialize global config
    const manager = new GlobalConfigManager(testConfigDir);
    manager.init();
    manager.addVault(testVaultPath);
  });
  
  afterEach(() => {
    // Clean up environment variable
    delete process.env.SECONDBRAIN_VAULT;
    
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('should prioritize SECONDBRAIN_VAULT environment variable', () => {
    const envVaultPath = join(testDir, 'env-vault');
    mkdirSync(join(envVaultPath, '.secondbrain'), { recursive: true });
    writeFileSync(
      join(envVaultPath, '.secondbrain', 'config.json'),
      JSON.stringify({ vaultPath: envVaultPath })
    );
    
    process.env.SECONDBRAIN_VAULT = envVaultPath;
    
    const result = resolveVaultPath({ globalConfigDir: testConfigDir });
    expect(result).toBe(envVaultPath);
  });
  
  it('should resolve vault name from environment variable', () => {
    const manager = new GlobalConfigManager(testConfigDir);
    const vault = manager.findVault(testVaultPath);
    
    process.env.SECONDBRAIN_VAULT = vault!.name;
    
    const result = resolveVaultPath({ globalConfigDir: testConfigDir });
    expect(result).toBe(testVaultPath);
  });
  
  it('should fallback to local directory detection', () => {
    const result = resolveVaultPath({
      globalConfigDir: testConfigDir,
      cwd: testVaultPath
    });
    expect(result).toBe(testVaultPath);
  });
  
  it('should fallback to default vault', () => {
    const manager = new GlobalConfigManager(testConfigDir);
    manager.setDefault(testVaultPath);
    
    const result = resolveVaultPath({
      globalConfigDir: testConfigDir,
      cwd: '/some/random/path'
    });
    expect(result).toBe(testVaultPath);
  });
  
  it('should return null if no vault found', () => {
    const emptyConfigDir = join(testDir, 'empty-config');
    const emptyManager = new GlobalConfigManager(emptyConfigDir);
    emptyManager.init();
    
    const result = resolveVaultPath({
      globalConfigDir: emptyConfigDir,
      cwd: '/some/random/path'
    });
    expect(result).toBeNull();
  });
});
```

**Step 2: 執行測試確認失敗**

Run: `bun test tests/vault-resolve.test.ts`
Expected: FAIL (resolveVaultPath not exported or different signature)

**Step 3: 修改 vault-resolve.ts**

```typescript
// src/utils/vault-resolve.ts
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
```

**Step 4: 執行測試確認通過**

Run: `bun test tests/vault-resolve.test.ts`
Expected: All tests PASS

**Step 5: 確認現有測試仍通過**

Run: `bun test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/utils/vault-resolve.ts tests/vault-resolve.test.ts
git commit -m "feat(vault-resolve): implement vault resolution priority (env > local > default)"
```

---

## Task 4: 實作 sb vault 指令群

**Files:**
- Create: `src/commands/vault.ts`

**Step 1: 建立 vault.ts 指令檔案**

```typescript
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
```

**Step 2: 驗證檔案語法正確**

Run: `bun run check`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/commands/vault.ts
git commit -m "feat(vault): add vault command group (init, use, current, list, default, delete)"
```

---

## Task 5: 更新 index.ts 註冊新指令並保留 sb init 別名

**Files:**
- Modify: `src/index.ts`
- Modify: `src/commands/init.ts`

**Step 1: 修改 init.ts 作為別名**

```typescript
// src/commands/init.ts
import { Command } from 'commander';
import { ConfigManager } from '../utils/config.js';
import { GlobalConfigManager } from '../utils/global-config.js';
import { resolve, join } from 'path';
import { homedir } from 'os';

const DEFAULT_VAULT_PATH = join(homedir(), 'vault');

export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize a new SecondBrain vault (alias for `sb vault init`)')
    .argument('[path]', 'Vault path', DEFAULT_VAULT_PATH)
    .action((path: string) => {
      try {
        const vaultPath = resolve(path);
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
```

**Step 2: 修改 index.ts 加入 vault 指令**

在 `src/index.ts` 中加入 vault 指令的 import 和註冊：

```typescript
// 在 import 區塊加入
import { createVaultCommand } from './commands/vault.js';

// 在 program.addCommand(createInitCommand()); 之後加入
program.addCommand(createVaultCommand());
```

**Step 3: 驗證建置正確**

Run: `bun run check`
Expected: 無錯誤

**Step 4: 測試指令可用**

Run: `bun run src/index.ts vault --help`
Expected: 顯示 vault 子指令列表

Run: `bun run src/index.ts init --help`
Expected: 顯示 init 指令說明

**Step 5: Commit**

```bash
git add src/index.ts src/commands/init.ts
git commit -m "feat(cli): register vault command and update init as alias"
```

---

## Task 6: 整合測試與驗證

**Files:**
- Test: `tests/vault-integration.test.ts`

**Step 1: 建立整合測試**

```typescript
// tests/vault-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Vault CLI Integration', () => {
  let testDir: string;
  let testConfigDir: string;
  
  const runCli = (args: string, env: Record<string, string> = {}) => {
    const envVars = {
      ...process.env,
      SECONDBRAIN_CONFIG_DIR: testConfigDir,
      ...env
    };
    try {
      return execSync(`bun run src/index.ts ${args}`, {
        encoding: 'utf-8',
        env: envVars,
        cwd: process.cwd()
      });
    } catch (error: any) {
      return error.stdout || error.stderr || '';
    }
  };
  
  beforeEach(() => {
    testDir = join(tmpdir(), `sb-integration-${Date.now()}`);
    testConfigDir = join(testDir, 'config');
    mkdirSync(testConfigDir, { recursive: true });
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('sb vault init', () => {
    it('should initialize a vault and register it globally', () => {
      const vaultPath = join(testDir, 'my-vault');
      const output = runCli(`vault init ${vaultPath}`);
      
      expect(output).toContain('SecondBrain vault initialized');
      expect(existsSync(join(vaultPath, '.secondbrain', 'config.json'))).toBe(true);
    });
  });
  
  describe('sb vault list', () => {
    it('should list registered vaults', () => {
      const vaultPath = join(testDir, 'test-vault');
      runCli(`vault init ${vaultPath}`);
      
      const output = runCli('vault list');
      expect(output).toContain('test-vault');
    });
  });
  
  describe('sb vault use', () => {
    it('should output export command', () => {
      const vaultPath = join(testDir, 'use-vault');
      runCli(`vault init ${vaultPath}`);
      
      const output = runCli('vault use use-vault');
      expect(output).toContain('export SECONDBRAIN_VAULT=');
      expect(output).toContain(vaultPath);
    });
  });
});
```

**Step 2: 執行整合測試**

Run: `bun test tests/vault-integration.test.ts`
Expected: All tests PASS

**Step 3: 執行所有測試**

Run: `bun test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add tests/vault-integration.test.ts
git commit -m "test(vault): add integration tests for vault commands"
```

---

## Task 7: 更新文件

**Files:**
- Modify: `README.md`

**Step 1: 更新 README.md 加入 vault 指令說明**

在 README.md 的 Commands 區塊加入：

```markdown
### Vault Management

SecondBrain supports managing multiple vaults. You can use any `sb` command from anywhere by setting an active vault.

#### Initialize a vault
```bash
# Initialize in default location (~/vault/)
sb vault init

# Initialize in current directory
sb vault init .

# Initialize in specific path
sb vault init /path/to/my-notes
```

#### Switch between vaults
```bash
# List all registered vaults
sb vault list

# Set active vault for current session
eval $(sb vault use my-notes)

# Check current vault
sb vault current
```

#### Set default vault
```bash
# View default vault
sb vault default

# Set default vault
sb vault default set my-notes
```

#### Remove vault registration
```bash
# Remove vault from registry (files are not deleted)
sb vault delete my-notes
```

#### Vault Resolution Priority
1. `SECONDBRAIN_VAULT` environment variable (name or path)
2. Current directory (searches up for `.secondbrain/`)
3. Default vault
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add vault management documentation"
```

---

## Task 8: 最終驗證

**Step 1: 執行完整測試套件**

Run: `bun test`
Expected: All tests PASS

**Step 2: 執行型別檢查**

Run: `bun run check`
Expected: 無錯誤

**Step 3: 測試 CLI 指令**

```bash
# 測試 help
bun run src/index.ts vault --help

# 測試 init
bun run src/index.ts vault init /tmp/test-vault

# 測試 list
bun run src/index.ts vault list

# 測試 use
bun run src/index.ts vault use test-vault

# 測試 current
bun run src/index.ts vault current

# 測試 default
bun run src/index.ts vault default

# 測試 delete
bun run src/index.ts vault delete test-vault
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(vault): complete global vault management implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | 型別定義 | `src/types/index.ts` |
| 2 | GlobalConfigManager | `src/utils/global-config.ts`, `tests/global-config.test.ts` |
| 3 | Vault 解析優先順序 | `src/utils/vault-resolve.ts`, `tests/vault-resolve.test.ts` |
| 4 | Vault 指令群 | `src/commands/vault.ts` |
| 5 | Index 整合 | `src/index.ts`, `src/commands/init.ts` |
| 6 | 整合測試 | `tests/vault-integration.test.ts` |
| 7 | 文件更新 | `README.md` |
| 8 | 最終驗證 | - |
