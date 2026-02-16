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

    it('應該解析並儲存 headings 到資料庫', async () => {
      vaultManager.writeNote('outline.md', '# Main Title\n\nIntro.\n\n## Section A\n\nContent A.\n\n### Subsection\n\nDetail.');
      await vaultManager.sync();

      const note = vaultManager.getNoteByPath('outline.md');
      expect(note?.headings).toBeDefined();
      expect(note?.headings.length).toBe(3);
      expect(note?.headings[0]).toEqual({ level: 1, text: 'Main Title', line: 1, column: 1 });
      expect(note?.headings[1]).toEqual({ level: 2, text: 'Section A', line: 5, column: 1 });
      expect(note?.headings[2]).toEqual({ level: 3, text: 'Subsection', line: 9, column: 1 });
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

  describe('new structure: FileInfo and ContentMetadata', () => {
    it('應該使用新的 FileInfo 和 ContentMetadata 結構', async () => {
      const content = '# Test Note\n\nContent with [[link]] and #tag';
      vaultManager.writeNote('new-structure.md', content);
      await vaultManager.sync();

      // Check FileInfo via database
      const fileInfo = vaultManager['db'].getFileByPath('new-structure.md');
      expect(fileInfo).not.toBeNull();
      expect(fileInfo?.path).toBe('new-structure.md');
      expect(fileInfo?.name).toBe('new-structure.md');
      expect(fileInfo?.basename).toBe('new-structure');
      expect(fileInfo?.extension).toBe('md');
      expect(fileInfo?.stat).toBeDefined();
      expect(fileInfo?.stat.ctime).toBeGreaterThan(0);
      expect(fileInfo?.stat.mtime).toBeGreaterThan(0);
      expect(fileInfo?.stat.size).toBeGreaterThan(0);

      // Check ContentMetadata via database
      const contentMetadata = vaultManager['db'].getContentMetadata('new-structure.md');
      expect(contentMetadata).not.toBeNull();
      expect(contentMetadata?.links).toBeDefined();
      expect(contentMetadata?.links?.length).toBeGreaterThan(0);
      expect(contentMetadata?.tags).toBeDefined();
      expect(contentMetadata?.tags?.length).toBeGreaterThan(0);
      expect(contentMetadata?.headings).toBeDefined();
      expect(contentMetadata?.headings?.length).toBeGreaterThan(0);

      // Verify positions are stored
      if (contentMetadata?.links && contentMetadata.links.length > 0) {
        const link = contentMetadata.links[0];
        expect(link.position).toBeDefined();
        expect(link.position.start).toBeDefined();
        expect(link.position.start.line).toBeGreaterThanOrEqual(0);
        expect(link.position.start.offset).toBeGreaterThanOrEqual(0);
      }
    });

    it('應該正確處理 frontmatter 位置', async () => {
      const content = '---\ntags: [test]\n---\n\n# Note';
      vaultManager.writeNote('frontmatter.md', content);
      await vaultManager.sync();

      const contentMetadata = vaultManager['db'].getContentMetadata('frontmatter.md');
      expect(contentMetadata?.frontmatter).toBeDefined();
      expect(contentMetadata?.frontmatter?.position).toBeDefined();
      expect(contentMetadata?.frontmatter?.position.start.line).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Obsidian-style API methods', () => {
    beforeEach(async () => {
      // Set up test files
      vaultManager.writeNote('simple.md', '# Simple Note\n\nContent');
      vaultManager.writeNote('folder/nested.md', '# Nested Note\n\nNested content');
      vaultManager.writeNote('with-heading.md', '# Main\n\n## Section\n\nContent');
      vaultManager.writeNote('note with spaces.md', '# Note With Spaces\n\nContent');
      await vaultManager.sync();
    });

    describe('getFileByPath', () => {
      it('should return FileInfo for existing file', () => {
        const file = vaultManager.getFileByPath('simple.md');
        
        expect(file).not.toBeNull();
        expect(file?.path).toBe('simple.md');
        expect(file?.name).toBe('simple.md');
        expect(file?.basename).toBe('simple');
        expect(file?.extension).toBe('md');
        expect(file?.stat).toBeDefined();
      });

      it('should return null for non-existent file', () => {
        const file = vaultManager.getFileByPath('nonexistent.md');
        expect(file).toBeNull();
      });

      it('should return FileInfo for nested file', () => {
        const file = vaultManager.getFileByPath('folder/nested.md');
        
        expect(file).not.toBeNull();
        expect(file?.path).toBe('folder/nested.md');
        expect(file?.parent).toBe('folder');
      });
    });

    describe('getFileCache', () => {
      it('should return ContentMetadata for FileInfo', () => {
        const file = vaultManager.getFileByPath('simple.md');
        expect(file).not.toBeNull();
        
        const cache = vaultManager.getFileCache(file!);
        
        expect(cache).not.toBeNull();
        expect(cache?.headings).toBeDefined();
        expect(cache?.headings?.length).toBeGreaterThan(0);
        expect(cache?.headings?.[0].heading).toBe('Simple Note');
      });

      it('should return null for non-existent file', () => {
        const file: FileInfo = {
          path: 'nonexistent.md',
          name: 'nonexistent.md',
          basename: 'nonexistent',
          extension: 'md',
          parent: null,
          stat: { ctime: 0, mtime: 0, size: 0 }
        };
        
        const cache = vaultManager.getFileCache(file);
        expect(cache).toBeNull();
      });

      it('should return ContentMetadata with links and tags', async () => {
        vaultManager.writeNote('linked.md', '# Linked\n\n[[simple]] and #tag');
        await vaultManager.sync();
        
        const file = vaultManager.getFileByPath('linked.md');
        expect(file).not.toBeNull();
        
        const cache = vaultManager.getFileCache(file!);
        
        expect(cache).not.toBeNull();
        expect(cache?.links).toBeDefined();
        expect(cache?.links?.length).toBeGreaterThan(0);
        expect(cache?.tags).toBeDefined();
        expect(cache?.tags?.length).toBeGreaterThan(0);
      });
    });

    describe('getFirstLinkpathDest', () => {
      it('should resolve simple filename', () => {
        const dest = vaultManager.getFirstLinkpathDest('simple', 'source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.path).toBe('simple.md');
        expect(dest?.basename).toBe('simple');
      });

      it('should resolve filename with extension', () => {
        const dest = vaultManager.getFirstLinkpathDest('simple.md', 'source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.path).toBe('simple.md');
      });

      it('should resolve nested path', () => {
        const dest = vaultManager.getFirstLinkpathDest('folder/nested', 'source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.path).toBe('folder/nested.md');
      });

      it('should strip heading reference', () => {
        const dest = vaultManager.getFirstLinkpathDest('simple#heading', 'source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.path).toBe('simple.md');
      });

      it('should strip block reference', () => {
        const dest = vaultManager.getFirstLinkpathDest('simple#^block-id', 'source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.path).toBe('simple.md');
      });

      it('should resolve relative to source path', async () => {
        vaultManager.writeNote('folder/source.md', '# Source');
        vaultManager.writeNote('folder/target.md', '# Target');
        await vaultManager.sync();
        
        const dest = vaultManager.getFirstLinkpathDest('target', 'folder/source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.path).toBe('folder/target.md');
      });

      it('should resolve filename with spaces (dash variation)', () => {
        const dest = vaultManager.getFirstLinkpathDest('note with spaces', 'source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.path).toBe('note with spaces.md');
      });

      it('should resolve by basename match', () => {
        const dest = vaultManager.getFirstLinkpathDest('simple', 'source.md');
        
        expect(dest).not.toBeNull();
        expect(dest?.basename).toBe('simple');
      });

      it('should return null for non-existent linkpath', () => {
        const dest = vaultManager.getFirstLinkpathDest('nonexistent', 'source.md');
        
        expect(dest).toBeNull();
      });

      it('should return null for empty linkpath', () => {
        const dest = vaultManager.getFirstLinkpathDest('', 'source.md');
        
        expect(dest).toBeNull();
      });

      it('should handle linkpath with only heading reference', () => {
        const dest = vaultManager.getFirstLinkpathDest('#heading', 'source.md');
        
        expect(dest).toBeNull();
      });
    });
  });
});
