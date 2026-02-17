import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { withVault, getConfigOrExit } from '../../src/utils/vault-resolve';
import { ConfigManager } from '../../src/utils/config';

describe('vault-resolve', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sb-vault-resolve-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('withVault', () => {
    it('calls fn with VaultManager when inside a vault', async () => {
      const configManager = new ConfigManager(tempDir);
      configManager.init();
      const origCwd = process.cwd;
      process.cwd = () => tempDir;
      try {
        let receivedVault: unknown = null;
        await withVault((vault) => {
          receivedVault = vault;
        });
        expect(receivedVault).not.toBeNull();
        expect((receivedVault as { getStats: () => unknown }).getStats).toBeDefined();
      } finally {
        process.cwd = origCwd;
      }
    });

    it('closes vault in finally after fn completes', async () => {
      const configManager = new ConfigManager(tempDir);
      configManager.init();
      const origCwd = process.cwd;
      process.cwd = () => tempDir;
      try {
        let closed = false;
        const closeSpy = (vault: { close: () => void }) => {
          const orig = vault.close.bind(vault);
          vault.close = () => {
            closed = true;
            orig();
          };
        };
        await withVault((vault) => {
          closeSpy(vault);
        });
        expect(closed).toBe(true);
      } finally {
        process.cwd = origCwd;
      }
    });

    it('exits when not in a vault', async () => {
      const exit = process.exit;
      const origCwd = process.cwd;
      process.cwd = () => tempDir;
      (process as NodeJS.Process & { exit: (code?: number) => never }).exit = ((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as (code?: number) => never;
      try {
        await withVault(() => {});
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('exit:1');
      } finally {
        process.exit = exit;
        process.cwd = origCwd;
      }
    });

    it('exits when fn throws', async () => {
      const configManager = new ConfigManager(tempDir);
      configManager.init();
      const origCwd = process.cwd;
      process.cwd = () => tempDir;
      const exit = process.exit;
      (process as NodeJS.Process & { exit: (code?: number) => never }).exit = ((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as (code?: number) => never;
      try {
        await withVault(() => {
          throw new Error('callback error');
        });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('exit:1');
      } finally {
        process.exit = exit;
        process.cwd = origCwd;
      }
    });
  });

  describe('getConfigOrExit', () => {
    it('returns config when inside a vault', () => {
      const configManager = new ConfigManager(tempDir);
      configManager.init();

      const origCwd = process.cwd;
      process.cwd = () => tempDir;
      try {
        const config = getConfigOrExit();
        expect(config.vaultPath).toBe(tempDir);
        expect(config.dailyNotesFolder).toBe('Daily');
      } finally {
        process.cwd = origCwd;
      }
    });

    it('exits when not in a vault', () => {
      const exit = process.exit;
      const origCwd = process.cwd;
      process.cwd = () => tempDir;
      (process as NodeJS.Process & { exit: (code?: number) => never }).exit = ((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as (code?: number) => never;
      try {
        getConfigOrExit();
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('exit:1');
      } finally {
        process.exit = exit;
        process.cwd = origCwd;
      }
    });
  });
});
