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
