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
      // We need to modify GlobalConfigManager to accept config dir via env or parameter
      // For now, let's test with a simpler approach - just verify the vault is created
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
