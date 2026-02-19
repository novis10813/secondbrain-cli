import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createCaptureCommand } from '../../src/commands/capture';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Command } from 'commander';
import { VaultManager } from '../../src/utils/vault';

describe('capture path resolution', () => {
    let tempDir: string;
    let configManager: ConfigManager;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'sb-capture-test-'));
        configManager = new ConfigManager(tempDir);
        configManager.init();

        // 建立 Templates
        mkdirSync(join(tempDir, 'Templates'), { recursive: true });
        writeFileSync(join(tempDir, 'Templates', 'meeting.md'), '# Meeting');

        process.env.SECONDBRAIN_VAULT = tempDir;
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
        delete process.env.SECONDBRAIN_VAULT;
    });

    async function executeAction(command: Command, content: string, title?: string, template?: string): Promise<void> {
        const args = [content];
        if (title) args.push('--title', title);
        if (template) args.push('--template', template);

        // 模擬 commander 的行為
        await command.parseAsync(['node', 'sb', 'capture', ...args]);
    }

    it('有 template targetFolder 時應存至該資料夾', async () => {
        const cmd = createCaptureCommand();
        configManager.setTemplateConfig('meeting', { targetFolder: 'Meetings' });

        await executeAction(cmd, '測試內容', '會議筆記', 'meeting');

        expect(existsSync(join(tempDir, 'Meetings', '會議筆記.md'))).toBe(true);
    });

    it('無 template config、有 captureFolder 時應存至 captureFolder', async () => {
        const cmd = createCaptureCommand();
        configManager.updateConfig({ captureFolder: 'Inbox' });

        await executeAction(cmd, '隨手紀錄內容', '隨手紀錄');

        expect(existsSync(join(tempDir, 'Inbox', '隨手紀錄.md'))).toBe(true);
    });

    it('都沒有設定時應存至 vault root', async () => {
        const cmd = createCaptureCommand();

        await executeAction(cmd, '全空測試', '全空測試');

        expect(existsSync(join(tempDir, '全空測試.md'))).toBe(true);
    });

    it('移除 --path 後不應接受 --path 參數', async () => {
        const cmd = createCaptureCommand();
        // 透過 exitOverride 攔截 commander 的退出行為
        cmd.exitOverride();
        // 攔截 stderr 避免干擾測試輸出
        const originalError = console.log; // Commander 可能用 console.error 或 process.stdout/err
        console.error = () => { };

        let error: any;
        try {
            await cmd.parseAsync(['node', 'sb', 'capture', '內容', '--path', 'custom/path.md']);
        } catch (e) {
            error = e;
        } finally {
            console.error = originalError;
        }

        expect(error).toBeDefined();
        // Commander 3.0+ throws error with code 'commander.unknownOption'
        expect((error as any).code).toBe('commander.unknownOption');
    });

    it('capture 後應在 DB 中建立索引（getFileByPath 應成功）', async () => {
        const cmd = createCaptureCommand();
        configManager.updateConfig({ captureFolder: 'Inbox' });

        await executeAction(cmd, '索引測試內容', '索引測試');

        // 需要建立一個 VaultManager 來檢查 DB 狀態
        // 由於 executeAction 呼叫了 commander，而 commander 呼叫了 withVault，
        // withVault 會建立自己的 VaultManager 並在結束時 close
        // 我們這裡再建立一個新的來驗證
        const vault = new VaultManager(configManager.getConfig());
        const file = vault.getFileByPath('Inbox/索引測試.md');
        const cache = file ? vault.getFileCache(file) : null;
        vault.close();

        expect(file).not.toBeNull();
        expect(file?.path).toBe('Inbox/索引測試.md');
        expect(cache).not.toBeNull();
    });
});
