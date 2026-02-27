import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createCaptureCommand } from '../../src/commands/capture';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
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

    async function executeAction(command: Command, content: string, options: { title?: string, template?: string, vars?: string[] } = {}): Promise<void> {
        const args = [content];
        if (options.title) args.push('--title', options.title);
        if (options.template) args.push('--template', options.template);
        if (options.vars) {
            options.vars.forEach(v => args.push('--var', v));
        }

        // 模擬 commander 的行為
        await command.parseAsync(['node', 'sb', ...args]);
    }

    it('有 template targetFolder 時應存至該資料夾', async () => {
        const cmd = createCaptureCommand();
        configManager.setTemplateConfig('meeting', { targetFolder: 'Meetings' });

        await executeAction(cmd, '測試內容', { title: '會議筆記', template: 'meeting' });

        expect(existsSync(join(tempDir, 'Meetings', '會議筆記.md'))).toBe(true);
    });

    it('無 template config、有 captureFolder 時應存至 captureFolder', async () => {
        const cmd = createCaptureCommand();
        configManager.updateConfig({ captureFolder: 'Inbox' });

        await executeAction(cmd, '隨手紀錄內容', { title: '隨手紀錄' });

        expect(existsSync(join(tempDir, 'Inbox', '隨手紀錄.md'))).toBe(true);
    });

    it('都沒有設定時應存至 vault root', async () => {
        const cmd = createCaptureCommand();

        await executeAction(cmd, '全空測試', { title: '全空測試' });

        expect(existsSync(join(tempDir, '全空測試.md'))).toBe(true);
    });

    it('移除 --path 後不應接受 --path 參數', async () => {
        const cmd = createCaptureCommand();
        cmd.exitOverride();
        const originalError = console.error;
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
        expect((error as any).code).toBe('commander.unknownOption');
    });

    it('capture 後應在 DB 中建立索引（getFileByPath 應成功）', async () => {
        const cmd = createCaptureCommand();
        configManager.updateConfig({ captureFolder: 'Inbox' });

        await executeAction(cmd, '索引測試內容', { title: '索引測試' });

        const vault = new VaultManager(configManager.getConfig());
        const file = vault.getFileByPath('Inbox/索引測試.md');
        const cache = file ? vault.getFileCache(file) : null;
        vault.close();

        expect(file).not.toBeNull();
        expect(file?.path).toBe('Inbox/索引測試.md');
        expect(cache).not.toBeNull();
    });

    describe('template placeholder', () => {
        it('使用 template 時應將 {{content}} 替換為 capture 的 content', async () => {
            writeFileSync(join(tempDir, 'Templates', 'meeting.md'), '## 摘要\n\n{{content}}');
            const cmd = createCaptureCommand();

            await executeAction(cmd, '討論事項', { title: '會議', template: 'meeting' });

            const content = readFileSync(join(tempDir, '會議.md'), 'utf-8');
            expect(content).toContain('## 摘要');
            expect(content).toContain('討論事項');
            expect(content).not.toContain('{{content}}');
        });

        it('--var key=value 應填入對應 placeholder', async () => {
            writeFileSync(join(tempDir, 'Templates', 'meeting.md'), 'mood: {{mood}}\n\n{{content}}');
            const cmd = createCaptureCommand();

            await executeAction(cmd, '紀錄', { title: '心情', template: 'meeting', vars: ['mood=happy'] });

            const content = readFileSync(join(tempDir, '心情.md'), 'utf-8');
            expect(content).toContain('mood: happy');
            expect(content).toContain('紀錄');
        });

        it('未提供的 placeholder 應為空字串並印出 warning', async () => {
            writeFileSync(join(tempDir, 'Templates', 'meeting.md'), '{{optional}}\n\n{{content}}');
            const cmd = createCaptureCommand();

            const originalWarn = console.warn;
            let warnCalled = false;
            let warnMsg = '';
            console.warn = (msg) => { warnCalled = true; warnMsg = msg; };

            try {
                await executeAction(cmd, '內容', { title: '測試', template: 'meeting' });
            } finally {
                console.warn = originalWarn;
            }

            const content = readFileSync(join(tempDir, '測試.md'), 'utf-8');
            expect(content).not.toContain('{{optional}}');
            expect(warnCalled).toBe(true);
            expect(warnMsg).toContain('optional');
        });

        it('template 無 placeholder 但有 content 時應顯示 warning', async () => {
            writeFileSync(join(tempDir, 'Templates', 'static.md'), '## 固定結構');
            const cmd = createCaptureCommand();

            const originalWarn = console.warn;
            let warnCalled = false;
            let warnMsg = '';
            console.warn = (msg) => { warnCalled = true; warnMsg = msg; };

            try {
                await executeAction(cmd, '被忽略的內容', { title: '靜態', template: 'static' });
            } finally {
                console.warn = originalWarn;
            }

            expect(warnCalled).toBe(true);
            expect(warnMsg).toContain('content');
        });

        it('template 中 {{TITLE}} 應被 --title 的值替換', async () => {
            writeFileSync(join(tempDir, 'Templates', 'meeting.md'), '# {{TITLE}}\n\n{{content}}');
            const cmd = createCaptureCommand();

            await executeAction(cmd, '討論事項', { title: '我的標題', template: 'meeting' });

            const content = readFileSync(join(tempDir, '我的標題.md'), 'utf-8');
            expect(content).toContain('# 我的標題');
            expect(content).not.toContain('{{TITLE}}');
        });

        it('template 中 {{UUID}} 應被自動生成的 UUID 替換', async () => {
            writeFileSync(join(tempDir, 'Templates', 'meeting.md'), '---\nid: {{UUID}}\n---\n\n{{content}}');
            const cmd = createCaptureCommand();

            await executeAction(cmd, '內容', { title: 'uuid測試', template: 'meeting' });

            const content = readFileSync(join(tempDir, 'uuid測試.md'), 'utf-8');
            expect(content).not.toContain('{{UUID}}');
            expect(content).toMatch(/id: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
        });

        it('built-in placeholder {{TITLE}}、{{UUID}}、{{DATE}} 不應觸發 warning', async () => {
            writeFileSync(
                join(tempDir, 'Templates', 'meeting.md'),
                '---\nid: {{UUID}}\ncreated: {{DATE}}\n---\n\n# {{TITLE}}\n\n{{content}}'
            );
            const cmd = createCaptureCommand();

            const warnings: string[] = [];
            const originalWarn = console.warn;
            console.warn = (msg: string) => warnings.push(msg);

            try {
                await executeAction(cmd, '測試內容', { title: '標題測試', template: 'meeting' });
            } finally {
                console.warn = originalWarn;
            }

            // 不應對 built-in placeholders 發出 warning
            expect(warnings.some(w => w.includes('TITLE'))).toBe(false);
            expect(warnings.some(w => w.includes('UUID'))).toBe(false);
            expect(warnings.some(w => w.includes('DATE'))).toBe(false);
        });
    });
});
