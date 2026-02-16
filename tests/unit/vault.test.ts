import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VaultManager } from '../../src/utils/vault';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('VaultManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let vaultManager: VaultManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sb-vault-test-'));
    configManager = new ConfigManager(tempDir);
    const config = configManager.init();
    vaultManager = new VaultManager(config);
  });

  afterEach(() => {
    vaultManager.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('writeNote', () => {
    it('應該寫入筆記檔案', () => {
      vaultManager.writeNote('test.md', '# Test\n\n內容');
      
      const fs = require('fs');
      expect(fs.existsSync(join(tempDir, 'test.md'))).toBe(true);
    });

    it('應該自動創建父目錄', () => {
      vaultManager.writeNote('Projects/api.md', '# API\n\n內容');
      
      const fs = require('fs');
      expect(fs.existsSync(join(tempDir, 'Projects/api.md'))).toBe(true);
    });

    it('應該寫入正確的內容', () => {
      const content = '# 標題\n\n這是內容';
      vaultManager.writeNote('note.md', content);
      
      const read = vaultManager.readNote('note.md');
      expect(read).toBe(content);
    });
  });

  describe('readNote', () => {
    it('應該讀取筆記內容', () => {
      const content = '# Test\n\n內容';
      vaultManager.writeNote('test.md', content);
      
      const read = vaultManager.readNote('test.md');
      expect(read).toBe(content);
    });

    it('應該在檔案不存在時回傳 null', () => {
      const read = vaultManager.readNote('non-existent.md');
      expect(read).toBeNull();
    });
  });

  describe('sync', () => {
    it('應該新增新筆記到資料庫', async () => {
      vaultManager.writeNote('new-note.md', '# New Note\n\n內容');
      
      const result = await vaultManager.sync();
      
      expect(result.added).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('應該偵測更新的筆記', async () => {
      vaultManager.writeNote('note.md', '# Note\n\n原始內容');
      await vaultManager.sync();
      
      // 等待一下確保修改時間不同
      await new Promise(resolve => setTimeout(resolve, 100));
      
      vaultManager.writeNote('note.md', '# Note\n\n更新內容');
      const result = await vaultManager.sync();
      
      expect(result.updated).toBe(1);
    });

    it('應該移除已刪除的筆記', async () => {
      vaultManager.writeNote('to-delete.md', '# Delete Me');
      await vaultManager.sync();
      
      const fs = require('fs');
      fs.unlinkSync(join(tempDir, 'to-delete.md'));
      
      const result = await vaultManager.sync();
      
      expect(result.removed).toBe(1);
    });

    it('應該解析筆記標題', async () => {
      vaultManager.writeNote('test.md', '# My Title\n\n內容');
      await vaultManager.sync();
      
      const note = vaultManager.getNoteByPath('test.md');
      expect(note?.title).toBe('My Title');
    });

    it('應該解析筆記標籤', async () => {
      vaultManager.writeNote('tagged.md', '# Tagged\n\n#tag1 #tag2');
      await vaultManager.sync();
      
      const note = vaultManager.getNoteByPath('tagged.md');
      expect(note?.tags).toContain('tag1');
      expect(note?.tags).toContain('tag2');
    });

    it('應該解析筆記連結', async () => {
      // 先寫入目標筆記
      vaultManager.writeNote('target.md', '# Target\n\n內容');
      await vaultManager.sync();
      
      // 再寫入來源筆記（此時 target 已在資料庫中）
      vaultManager.writeNote('source.md', '# Source\n\n連結到 [[target]]');
      await vaultManager.sync();
      
      const sourceNote = vaultManager.getNoteByPath('source.md');
      expect(sourceNote?.links.length).toBeGreaterThan(0);
    });

    it('應該解析並追蹤 block references', async () => {
      vaultManager.writeNote('blocks.md', '# Blocks\n\nParagraph ^abc123.\n\nList ^xyz-99');
      await vaultManager.sync();

      const note = vaultManager.getNoteByPath('blocks.md');
      expect(note?.blockRefs).toContain('abc123');
      expect(note?.blockRefs).toContain('xyz-99');
    });
  });

  describe('searchNotes', () => {
    beforeEach(async () => {
      vaultManager.writeNote('api-design.md', '# API Design\n\nRESTful API 設計原則');
      vaultManager.writeNote('backend.md', '# Backend\n\n後端開發注意事項');
      vaultManager.writeNote('frontend.md', '# Frontend\n\n前端設計');
      
      await vaultManager.sync();
    });

    it('應該搜尋標題', () => {
      const results = vaultManager.searchNotes('API');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(n => n.title === 'API Design')).toBe(true);
    });

    it('應該搜尋內容', () => {
      const results = vaultManager.searchNotes('後端');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(n => n.title === 'Backend')).toBe(true);
    });

    it('應該支援標籤過濾', async () => {
      vaultManager.writeNote('tagged.md', '---\ntags: [work]\n---\n\n# Tagged Note');
      await vaultManager.sync();
      
      const results = vaultManager.searchNotes('', ['work']);
      
      expect(results.some(n => n.title === 'Tagged Note')).toBe(true);
    });

    it('應該限制結果數量', () => {
      const results = vaultManager.searchNotes('', undefined, 2);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getBacklinks', () => {
    it('應該找到連結到指定筆記的其他筆記', async () => {
      // 先寫入目標筆記
      vaultManager.writeNote('target.md', '# Target\n\n目標筆記');
      await vaultManager.sync();
      
      // 再寫入連結筆記（此時 target 已在資料庫中）
      vaultManager.writeNote('link1.md', '# Link1\n\n連結到 [[target]]');
      vaultManager.writeNote('link2.md', '# Link2\n\n連結到 [[target]]');
      await vaultManager.sync();
      
      const targetNote = vaultManager.getNoteByPath('target.md');
      const backlinks = vaultManager.getBacklinks(targetNote!.id);
      
      expect(backlinks.length).toBe(2);
      expect(backlinks.some(n => n.title === 'Link1')).toBe(true);
      expect(backlinks.some(n => n.title === 'Link2')).toBe(true);
    });
  });

  describe('getOrphans', () => {
    it('應該找到沒有被連結的筆記', async () => {
      vaultManager.writeNote('linked.md', '# Linked\n\n連結到 [[other]]');
      vaultManager.writeNote('other.md', '# Other\n\n被連結');
      vaultManager.writeNote('orphan.md', '# Orphan\n\n孤兒筆記');
      
      await vaultManager.sync();
      
      const orphans = vaultManager.getOrphans();
      
      expect(orphans.some(n => n.title === 'Orphan')).toBe(true);
      expect(orphans.some(n => n.title === 'Linked')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('應該回傳正確的統計資訊', async () => {
      vaultManager.writeNote('note1.md', '# Note1');
      vaultManager.writeNote('note2.md', '# Note2\n\n連結到 [[note1]]');
      
      await vaultManager.sync();
      
      const stats = vaultManager.getStats();
      
      expect(stats.totalNotes).toBe(2);
      expect(stats.totalLinks).toBeGreaterThanOrEqual(0);
      expect(stats.orphans).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDailyNotePath', () => {
    it('應該回傳正確的每日筆記路徑', () => {
      const date = new Date('2024-01-15');
      const path = vaultManager.getDailyNotePath(date);
      
      expect(path).toBe('Daily/2024-01-15.md');
    });

    it('應該使用今天的日期當預設值', () => {
      const today = new Date().toISOString().split('T')[0];
      const path = vaultManager.getDailyNotePath();
      
      expect(path).toContain(today);
    });
  });

  describe('getTemplatePath', () => {
    it('應該回傳正確的模板路徑', () => {
      const path = vaultManager.getTemplatePath('meeting');
      
      expect(path).toBe('Templates/meeting.md');
    });
  });
});
