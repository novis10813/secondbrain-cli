import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VaultManager } from '../../src/utils/vault';
import { ConfigManager } from '../../src/utils/config';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NoteParser } from '../../src/utils/parser';

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
      
      const file = vaultManager.getFileByPath('test.md');
      const content = vaultManager.readNote('test.md');
      const parsed = NoteParser.parse(content!);
      expect(parsed.title).toBe('My Title');
    });

    it('應該解析筆記標籤', async () => {
      vaultManager.writeNote('tagged.md', '# Tagged\n\n#tag1 #tag2');
      await vaultManager.sync();
      
      const file = vaultManager.getFileByPath('tagged.md');
      const cache = vaultManager.getFileCache(file!);
      const tagNames = cache?.tags?.map(t => t.tag) || [];
      expect(tagNames).toContain('tag1');
      expect(tagNames).toContain('tag2');
    });

    it('應該解析筆記連結', async () => {
      vaultManager.writeNote('target.md', '# Target\n\n內容');
      await vaultManager.sync();

      vaultManager.writeNote('source.md', '# Source\n\n連結到 [[target]]');
      await vaultManager.sync();

      // New structure: links are in links_with_positions; verify via backlinks
      const backlinks = vaultManager.getBacklinksByPath('target.md');
      expect(backlinks.length).toBeGreaterThan(0);
      expect(backlinks.some(b => b.path === 'source.md')).toBe(true);
    });

    it('應該解析並追蹤 block references', async () => {
      vaultManager.writeNote('blocks.md', '# Blocks\n\nParagraph ^abc123.\n\nList ^xyz-99');
      await vaultManager.sync();

      const file = vaultManager.getFileByPath('blocks.md');
      const cache = vaultManager.getFileCache(file!);
      const blockIds = cache?.blocks?.map(b => b.id) || [];
      expect(blockIds).toContain('abc123');
      expect(blockIds).toContain('xyz-99');
    });

    it('應該解析並儲存 headings 到資料庫', async () => {
      vaultManager.writeNote('outline.md', '# Main Title\n\nIntro.\n\n## Section A\n\nContent A.\n\n### Subsection\n\nDetail.');
      await vaultManager.sync();

      const file = vaultManager.getFileByPath('outline.md');
      const cache = vaultManager.getFileCache(file!);
      expect(cache?.headings).toBeDefined();
      expect(cache?.headings?.length).toBe(3);
      expect(cache?.headings?.[0].heading).toBe('Main Title');
      expect(cache?.headings?.[0].level).toBe(1);
      expect(cache?.headings?.[1].heading).toBe('Section A');
      expect(cache?.headings?.[1].level).toBe(2);
      expect(cache?.headings?.[2].heading).toBe('Subsection');
      expect(cache?.headings?.[2].level).toBe(3);
    });
  });

  describe('searchFiles (new structure)', () => {
    beforeEach(async () => {
      vaultManager.writeNote('api-design.md', '# API Design\n\nRESTful API 設計原則');
      vaultManager.writeNote('backend.md', '# Backend\n\n後端開發注意事項');
      vaultManager.writeNote('frontend.md', '# Frontend\n\n前端設計');
      
      await vaultManager.sync();
    });

    it('應該依 path/basename 搜尋', () => {
      const results = vaultManager.searchFiles('api');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.file.basename === 'api-design')).toBe(true);
    });

    it('應該依 basename 搜尋', () => {
      const results = vaultManager.searchFiles('backend');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.file.basename === 'backend')).toBe(true);
    });

    it('應該支援標籤過濾', async () => {
      vaultManager.writeNote('tagged.md', '---\ntags: [work]\n---\n\n# Tagged Note');
      await vaultManager.sync();
      
      const results = vaultManager.searchFiles('', ['work']);
      
      expect(results.some(r => r.file.basename === 'tagged')).toBe(true);
    });

    it('應該限制結果數量', () => {
      const results = vaultManager.searchFiles('', undefined, 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('應該依 path prefix 過濾結果', async () => {
      vaultManager.writeNote('Daily/2024-01-01.md', '# Daily\n\nNote in Daily');
      vaultManager.writeNote('Projects/task.md', '# Task\n\nNote in Projects');
      await vaultManager.sync();

      const dailyResults = vaultManager.searchFiles('', undefined, 20, 'Daily');
      const projectResults = vaultManager.searchFiles('', undefined, 20, 'Projects');

      expect(dailyResults.every(r => r.file.path.startsWith('Daily'))).toBe(true);
      expect(projectResults.every(r => r.file.path.startsWith('Projects'))).toBe(true);
      expect(dailyResults.some(r => r.file.basename === '2024-01-01')).toBe(true);
      expect(projectResults.some(r => r.file.basename === 'task')).toBe(true);
    });

    it('應該支援 modified-after / modified-before 過濾', async () => {
      const resultsAll = vaultManager.searchFiles(
        '', undefined, 20, undefined, undefined, undefined, 0
      );
      expect(resultsAll.length).toBeGreaterThan(0);

      const resultsNone = vaultManager.searchFiles(
        '', undefined, 20, undefined, undefined, undefined, Date.now() + 86400000
      );
      expect(resultsNone.length).toBe(0);
    });
  });

  describe('getBacklinksByPath (new structure)', () => {
    it('應該找到連結到指定筆記的其他筆記', async () => {
      vaultManager.writeNote('target.md', '# Target\n\n目標筆記');
      await vaultManager.sync();
      
      vaultManager.writeNote('link1.md', '# Link1\n\n連結到 [[target]]');
      vaultManager.writeNote('link2.md', '# Link2\n\n連結到 [[target]]');
      await vaultManager.sync();
      
      const backlinks = vaultManager.getBacklinksByPath('target.md');
      
      expect(backlinks.length).toBe(2);
      expect(backlinks.some(f => f.basename === 'link1')).toBe(true);
      expect(backlinks.some(f => f.basename === 'link2')).toBe(true);
    });
  });

  describe('getOutlinksByPath (new structure)', () => {
    it('應該找到指定筆記連結出去的其他筆記', async () => {
      vaultManager.writeNote('target.md', '# Target\n\n目標筆記');
      vaultManager.writeNote('other.md', '# Other\n\n其他筆記');
      await vaultManager.sync();

      vaultManager.writeNote('source.md', '# Source\n\n連結到 [[target]] 與 [[other]]');
      await vaultManager.sync();

      const outlinks = vaultManager.getOutlinksByPath('source.md');

      expect(outlinks.length).toBe(2);
      expect(outlinks.some(f => f.basename === 'target')).toBe(true);
      expect(outlinks.some(f => f.basename === 'other')).toBe(true);
    });
  });

  describe('getOrphanFiles (new structure)', () => {
    it('應該找到沒有被連結的筆記', async () => {
      vaultManager.writeNote('linked.md', '# Linked\n\n連結到 [[other]]');
      vaultManager.writeNote('other.md', '# Other\n\n被連結');
      vaultManager.writeNote('orphan.md', '# Orphan\n\n孤兒筆記');
      
      await vaultManager.sync();
      
      const orphans = vaultManager.getOrphanFiles();
      
      expect(orphans.some(f => f.basename === 'orphan')).toBe(true);
      expect(orphans.some(f => f.basename === 'linked')).toBe(false);
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

  describe('getGraphData', () => {
    it('returns nodes and edges after sync', async () => {
      vaultManager.writeNote('a.md', '# A\n\nContent');
      vaultManager.writeNote('b.md', '# B\n\nLink to [[a]]');
      await vaultManager.sync();

      const graph = vaultManager.getGraphData();
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
      expect(graph.nodes.length).toBe(2);
      expect(graph.nodes.every(n => 'id' in n && 'title' in n && 'path' in n && 'tags' in n)).toBe(true);
      expect(graph.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('uses new structure: node id is path, edges use paths', async () => {
      vaultManager.writeNote('from.md', '# From\n\nLink to [[to]]');
      vaultManager.writeNote('to.md', '# To\n\nContent');
      await vaultManager.sync();

      const graph = vaultManager.getGraphData();
      const fromNode = graph.nodes.find(n => n.path === 'from.md');
      const toNode = graph.nodes.find(n => n.path === 'to.md');
      expect(fromNode).toBeDefined();
      expect(toNode).toBeDefined();
      expect(fromNode?.id).toBe('from.md');
      expect(toNode?.id).toBe('to.md');
      const edge = graph.edges.find(e => e.source === 'from.md' && e.target === 'to.md');
      expect(edge).toBeDefined();
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

    describe('getMarkdownFiles', () => {
      it('should return all markdown files in vault', () => {
        const files = vaultManager.getMarkdownFiles();
        expect(files.length).toBe(4);
        const paths = files.map(f => f.path).sort();
        expect(paths).toEqual(['folder/nested.md', 'note with spaces.md', 'simple.md', 'with-heading.md']);
      });

      it('should return FileInfo with path, name, basename, extension', () => {
        const files = vaultManager.getMarkdownFiles();
        const simple = files.find(f => f.path === 'simple.md');
        expect(simple).not.toBeUndefined();
        expect(simple?.path).toBe('simple.md');
        expect(simple?.name).toBe('simple.md');
        expect(simple?.basename).toBe('simple');
        expect(simple?.extension).toBe('md');
      });
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

    describe('resolvePathOrBasename', () => {
      it('should resolve by exact path', () => {
        const file = vaultManager.resolvePathOrBasename('simple.md');
        expect(file).not.toBeNull();
        expect(file?.path).toBe('simple.md');
        expect(file?.basename).toBe('simple');
      });

      it('should resolve by path without extension', () => {
        const file = vaultManager.resolvePathOrBasename('simple');
        expect(file).not.toBeNull();
        expect(file?.path).toBe('simple.md');
      });

      it('should resolve by basename only', () => {
        const file = vaultManager.resolvePathOrBasename('nested');
        expect(file).not.toBeNull();
        expect(file?.path).toBe('folder/nested.md');
        expect(file?.basename).toBe('nested');
      });

      it('should resolve nested path', () => {
        const file = vaultManager.resolvePathOrBasename('folder/nested.md');
        expect(file).not.toBeNull();
        expect(file?.path).toBe('folder/nested.md');
      });

      it('should return null for non-existent path or basename', () => {
        expect(vaultManager.resolvePathOrBasename('nonexistent')).toBeNull();
        expect(vaultManager.resolvePathOrBasename('nonexistent.md')).toBeNull();
      });
    });

    describe('readFile', () => {
      it('should return file content for FileInfo', () => {
        const file = vaultManager.getFileByPath('simple.md');
        expect(file).not.toBeNull();
        const content = vaultManager.readFile(file!);
        expect(content).toBe('# Simple Note\n\nContent');
      });

      it('should return null when file does not exist on disk', () => {
        const file: FileInfo = {
          path: 'nonexistent.md',
          name: 'nonexistent.md',
          basename: 'nonexistent',
          extension: 'md',
          parent: null,
          stat: { ctime: 0, mtime: 0, size: 0 }
        };
        expect(vaultManager.readFile(file)).toBeNull();
      });
    });

    describe('getBacklinksForFile', () => {
      it('should return FileInfo[] of files that link to the given file', async () => {
        vaultManager.writeNote('backlink-a.md', '# A\n\n[[simple]]');
        vaultManager.writeNote('backlink-b.md', '# B\n\n[[simple]]');
        await vaultManager.sync();

        const file = vaultManager.getFileByPath('simple.md');
        expect(file).not.toBeNull();
        const backlinks = vaultManager.getBacklinksForFile(file!);
        expect(backlinks.length).toBe(2);
        const paths = backlinks.map(f => f.path).sort();
        expect(paths).toEqual(['backlink-a.md', 'backlink-b.md']);
      });

      it('should return empty array when file has no backlinks', () => {
        const file = vaultManager.getFileByPath('with-heading.md');
        expect(file).not.toBeNull();
        const backlinks = vaultManager.getBacklinksForFile(file!);
        expect(backlinks).toEqual([]);
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
