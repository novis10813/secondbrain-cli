import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { VaultManager } from '../../src/utils/vault';
import { ConfigManager } from '../../src/utils/config';
import { NoteParser } from '../../src/utils/parser';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Sync Performance (Issue #3)', () => {
    let tempDir: string;
    let vaultManager: VaultManager;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'sb-sync-perf-'));
        const configManager = new ConfigManager(tempDir);
        const config = configManager.init();
        vaultManager = new VaultManager(config);
    });

    afterEach(() => {
        vaultManager.close();
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('sync() should not parse files if content hash hasn\'t changed', async () => {
        const filename = 'note.md';
        const filepath = join(tempDir, filename);
        writeFileSync(filepath, '# Title\n\nContent');

        // First sync - should parse
        await vaultManager.sync();

        // Setup spy on NoteParser.parse
        const parseSpy = spyOn(NoteParser, 'parse');

        // Second sync - nothing changed, should NOT parse
        await vaultManager.sync();

        // RED LIGHT: Currently sync() parses every file on every run.
        // We expect it NOT to be called here.
        expect(parseSpy).not.toHaveBeenCalled();

        parseSpy.mockRestore();
    });

    it('sync() should only parse new or updated files', async () => {
        vaultManager.writeNote('fixed.md', '# Fixed');
        await vaultManager.sync();

        const parseSpy = spyOn(NoteParser, 'parse');

        // Add a new file and keep the old one
        vaultManager.writeNote('new.md', '# New');

        await vaultManager.sync();

        // Should have been called EXACTLY once (for new.md)
        expect(parseSpy).toHaveBeenCalledTimes(1);

        parseSpy.mockRestore();
    });
});
