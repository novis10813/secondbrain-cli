import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VaultManager } from '../../src/utils/vault';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Link Target Preservation (Issue #4)', () => {
    let tempDir: string;
    let vaultManager: VaultManager;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'sb-link-test-'));
        const configManager = new ConfigManager(tempDir);
        const config = configManager.init();
        vaultManager = new VaultManager(config);
    });

    afterEach(() => {
        vaultManager.close();
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('getContentMetadata() should return the original link target, not the resolved path', async () => {
        // 1. Create a note with a link to a non-existent file or a file with a different name
        vaultManager.writeNote('target.md', '# Target');
        // Use a link that needs resolution (e.g., lowercase or without extension)
        vaultManager.writeNote('source.md', '# Source\n\nLink to [[target]]');

        await vaultManager.sync();

        const sourceFile = vaultManager.getFileByPath('source.md');
        expect(sourceFile).not.toBeNull();

        const cache = vaultManager.getFileCache(sourceFile!);
        expect(cache?.links).toBeDefined();
        expect(cache?.links?.length).toBe(1);

        // RED LIGHT: Currently, vault.ts sync() updates the link target to the resolved path ('target.md')
        // and database.ts returns the target_path if available.
        // We want it to be 'target' (the original string inside [[ ]]).
        expect(cache?.links?.[0].link).toBe('target');
    });

    it('link.link should remain original even after link resolution in sync', async () => {
        vaultManager.writeNote('Projects/Goal.md', '# Goal');
        vaultManager.writeNote('start.md', '# Start\n\nSee [[Goal]]');

        await vaultManager.sync();

        const startFile = vaultManager.getFileByPath('start.md');
        const cache = vaultManager.getFileCache(startFile!);

        // Currently this will likely return 'Projects/Goal.md' because sync() resolves it.
        // We want it to remain 'Goal'.
        expect(cache?.links?.[0].link).toBe('Goal');
    });
});
