import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sb-test-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('應該創建 .secondbrain 目錄', () => {
      configManager.init();
      
      const fs = require('fs');
      expect(fs.existsSync(join(tempDir, '.secondbrain'))).toBe(true);
    });

    it('應該創建預設設定檔', () => {
      const config = configManager.init();
      
      expect(config.vaultPath).toBe(tempDir);
      expect(config.dailyNotesFolder).toBe('Daily');
      expect(config.templatesFolder).toBe('Templates');
      expect(config.dbPath).toBe(join(tempDir, '.secondbrain/index.db'));
    });

    it('應該寫入設定檔到磁碟', () => {
      configManager.init();
      
      const fs = require('fs');
      expect(fs.existsSync(join(tempDir, '.secondbrain/config.json'))).toBe(true);
    });
  });

  describe('isInitialized', () => {
    it('應該在未初始化時回傳 false', () => {
      expect(configManager.isInitialized()).toBe(false);
    });

    it('應該在初始化後回傳 true', () => {
      configManager.init();
      expect(configManager.isInitialized()).toBe(true);
    });
  });

  describe('loadConfig', () => {
    it('應該在未初始化時回傳 null', () => {
      const config = configManager.loadConfig();
      expect(config).toBeNull();
    });

    it('應該載入已儲存的設定', () => {
      configManager.init();
      const loaded = configManager.loadConfig();
      
      expect(loaded).not.toBeNull();
      expect(loaded?.vaultPath).toBe(tempDir);
      expect(loaded?.dailyNotesFolder).toBe('Daily');
    });
  });

  describe('getConfig', () => {
    it('應該在未初始化時拋出錯誤', () => {
      expect(() => configManager.getConfig()).toThrow('Vault not initialized');
    });

    it('應該回傳設定物件', () => {
      configManager.init();
      const config = configManager.getConfig();
      
      expect(config.vaultPath).toBe(tempDir);
    });
  });

  describe('updateConfig', () => {
    it('應該更新特定設定值', () => {
      configManager.init();
      configManager.updateConfig({ dailyNotesFolder: 'Journal' });
      
      const config = configManager.getConfig();
      expect(config.dailyNotesFolder).toBe('Journal');
    });

    it('應該保留未更新的設定值', () => {
      configManager.init();
      configManager.updateConfig({ dailyNotesFolder: 'Journal' });
      
      const config = configManager.getConfig();
      expect(config.templatesFolder).toBe('Templates');
      expect(config.vaultPath).toBe(tempDir);
    });

    it('應該將更新寫入磁碟', () => {
      configManager.init();
      configManager.updateConfig({ dailyNotesFolder: 'Journal' });
      
      // 建立新的 ConfigManager 實例來驗證持久化
      const newManager = new ConfigManager(tempDir);
      const config = newManager.getConfig();
      expect(config.dailyNotesFolder).toBe('Journal');
    });
  });

  describe('findVaultPath', () => {
    it('應該在當前目錄找到 vault', () => {
      configManager.init();
      
      const found = ConfigManager.findVaultPath(tempDir);
      expect(found).toBe(tempDir);
    });

    it('應該在父目錄找到 vault', () => {
      configManager.init();
      const subDir = join(tempDir, 'sub', 'folder');
      mkdirSync(subDir, { recursive: true });
      
      const found = ConfigManager.findVaultPath(subDir);
      expect(found).toBe(tempDir);
    });

    it('應該在找不到 vault 時回傳 null', () => {
      const found = ConfigManager.findVaultPath(tempDir);
      expect(found).toBeNull();
    });
  });
});
