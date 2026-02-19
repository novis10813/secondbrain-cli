import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { runCommand } from './cli-test-utils'; // 我需要檢查是否有這個工具有助於跑 CLI 測試，或者直接模擬指令函式
import { createTemplateCommand } from '../../src/commands/template';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Command } from 'commander';

describe('sb template command', () => {
    let tempDir: string;
    let configManager: ConfigManager;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'sb-template-cmd-test-'));
        configManager = new ConfigManager(tempDir);
        configManager.init();

        // 建立 Templates 目錄
        mkdirSync(join(tempDir, 'Templates'), { recursive: true });
        writeFileSync(join(tempDir, 'Templates', 'meeting.md'), '# Meeting');
        writeFileSync(join(tempDir, 'Templates', 'daily.md'), '# Daily');
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    // 輔助函式：執行指令並捕獲輸出
    async function executeAction(command: Command, args: string[]): Promise<string> {
        let output = '';
        const originalLog = console.log;
        console.log = (...msg) => { output += msg.join(' ') + '\n'; };

        try {
            await command.parseAsync(['node', 'sb', ...args]);
        } finally {
            console.log = originalLog;
        }
        return output;
    }

    describe('list', () => {
        it('應列出 Templates 目錄中的模板', async () => {
            const cmd = createTemplateCommand();
            // 在測試中，我們需要確保 withVault 能解析到正確的 tempDir
            // 這邊可能需要修改 withVault 的邏輯或者在測試中設定 SECONDBRAIN_VAULT
            process.env.SECONDBRAIN_VAULT = tempDir;

            const output = await executeAction(cmd, ['list']);
            expect(output).toContain('meeting');
            expect(output).toContain('daily');

            delete process.env.SECONDBRAIN_VAULT;
        });
    });

    describe('set', () => {
        it('應設定模板的 targetFolder', async () => {
            const cmd = createTemplateCommand();
            process.env.SECONDBRAIN_VAULT = tempDir;

            await executeAction(cmd, ['set', 'meeting', '--folder', 'Meetings']);

            const config = configManager.getConfig();
            expect(config.templates?.['meeting']?.targetFolder).toBe('Meetings');

            delete process.env.SECONDBRAIN_VAULT;
        });
    });

    describe('get', () => {
        it('應顯示模板的設定', async () => {
            const cmd = createTemplateCommand();
            process.env.SECONDBRAIN_VAULT = tempDir;

            // 先設定
            configManager.setTemplateConfig('meeting', { targetFolder: 'Meetings' });

            const output = await executeAction(cmd, ['get', 'meeting']);
            expect(output).toContain('"targetFolder": "Meetings"');

            delete process.env.SECONDBRAIN_VAULT;
        });
    });
});
