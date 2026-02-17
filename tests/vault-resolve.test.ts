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

  it('should fall through when SECONDBRAIN_VAULT is set but invalid (path not a vault)', () => {
    process.env.SECONDBRAIN_VAULT = '/nonexistent/not-a-vault';
    const result = resolveVaultPath({
      globalConfigDir: testConfigDir,
      cwd: '/some/random/path'
    });
    expect(result).toBeNull();
  });

  it('should fall through when SECONDBRAIN_VAULT is set to unknown name', () => {
    process.env.SECONDBRAIN_VAULT = 'unknown-vault-name';
    const result = resolveVaultPath({
      globalConfigDir: testConfigDir,
      cwd: '/some/random/path'
    });
    expect(result).toBeNull();
  });
});
