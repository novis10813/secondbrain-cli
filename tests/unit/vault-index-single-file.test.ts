import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VaultManager } from '../../src/utils/vault';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Config } from '../../src/types/index';

describe('VaultManager.indexSingleFile', () => {
    let tempDir: string;
    let vault: VaultManager;
    let config: Config;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'sb-vault-index-test-'));
        config = {
            vaultPath: tempDir,
            dbPath: join(tempDir, '.secondbrain', 'index.db'),
            dailyNotesFolder: 'Daily',
            templatesFolder: 'Templates'
        };
        mkdirSync(join(tempDir, '.secondbrain'), { recursive: true });
        vault = new VaultManager(config);
    });

    afterEach(() => {
        vault.close();
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('應將新檔案寫入 DB (getFileByPath 可查到)', () => {
        const relativePath = 'test.md';
        writeFileSync(join(tempDir, relativePath), '# Test Note\nContent here.');

        vault.indexSingleFile(relativePath);

        const file = vault.getFileByPath(relativePath);
        expect(file).not.toBeNull();
        expect(file?.basename).toBe('test');
    });

    it('應將 ContentMetadata 寫入 DB (getFileCache 可查到)', () => {
        const relativePath = 'tags-test.md';
        const content = '---\ntags: [foo, bar]\n---\n# Content';
        writeFileSync(join(tempDir, relativePath), content);

        vault.indexSingleFile(relativePath);

        const file = vault.getFileByPath(relativePath);
        expect(file).not.toBeNull();

        const cache = vault.getFileCache(file!);
        expect(cache).not.toBeNull();
        expect(cache?.tags?.length).toBe(2);
        expect(cache?.tags?.some(t => t.tag === 'foo')).toBe(true);
    });

    it('應能抓取新檔案的 links', async () => {
        const sourcePath = 'source.md';
        writeFileSync(join(tempDir, sourcePath), 'Link to [[target]]');

        vault.indexSingleFile(sourcePath);

        const sourceFile = vault.getFileByPath(sourcePath);
        const cache = vault.getFileCache(sourceFile!);

        expect(cache?.links).toBeDefined();
        expect(cache?.links?.[0].link).toBe('target');
    });
});
