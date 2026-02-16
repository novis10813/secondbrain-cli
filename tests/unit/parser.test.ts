import { describe, it, expect } from 'bun:test';
import { NoteParser } from '../../src/utils/parser';

describe('NoteParser', () => {
  describe('parse', () => {
    it('應該解析帶有 frontmatter 的筆記', () => {
      const content = `---
title: Test Note
tags: [test, example]
---

# Hello World

這是內容`;

      const parsed = NoteParser.parse(content);

      expect(parsed.title).toBe('Hello World');
      expect(parsed.frontmatter).toEqual({ title: 'Test Note', tags: ['test', 'example'] });
      expect(parsed.content).toContain('這是內容');
    });

    it('應該解析沒有 frontmatter 的筆記', () => {
      const content = `# Simple Note

內容在這裡`;

      const parsed = NoteParser.parse(content);

      expect(parsed.title).toBe('Simple Note');
      expect(parsed.frontmatter).toEqual({});
    });

    it('應該從內文提取 Obsidian 標籤', () => {
      const content = `---
title: Note with tags
---

# Test

這是內容帶有 #tag1 和 #tag2/sub`;

      const parsed = NoteParser.parse(content);

      expect(parsed.tags).toContain('tag1');
      expect(parsed.tags).toContain('tag2/sub');
    });

    it('應該從內文提取 Obsidian 連結', () => {
      const content = `---
title: Linked Note
---

# Test

請參考 [[另一篇筆記]] 和 [[筆記名稱|顯示文字]]`;

      const parsed = NoteParser.parse(content);

      expect(parsed.links).toContain('另一篇筆記');
      expect(parsed.links).toContain('筆記名稱');
    });

    it('當沒有 H1 標題時應該使用第一行作為標題', () => {
      const content = `這是第一行
第二行
第三行`;

      const parsed = NoteParser.parse(content);

      expect(parsed.title).toBe('這是第一行');
    });

    it('當內容為空時應該回傳 Untitled', () => {
      const content = '';

      const parsed = NoteParser.parse(content);

      expect(parsed.title).toBe('Untitled');
    });
  });

  describe('computeHash', () => {
    it('應該產生 SHA256 hash', () => {
      const content = 'test content';
      const hash = NoteParser.computeHash(content);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('相同內容應該產生相同 hash', () => {
      const content = 'same content';
      const hash1 = NoteParser.computeHash(content);
      const hash2 = NoteParser.computeHash(content);

      expect(hash1).toBe(hash2);
    });

    it('不同內容應該產生不同 hash', () => {
      const hash1 = NoteParser.computeHash('content 1');
      const hash2 = NoteParser.computeHash('content 2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateNoteContent', () => {
    it('應該生成帶有 frontmatter 的筆記內容', () => {
      const frontmatter = { tags: ['test'], created: '2024-01-01' };
      const content = NoteParser.generateNoteContent('我的標題', '筆記內容', frontmatter);

      expect(content).toContain('---');
      expect(content).toContain('tags:');
      expect(content).toContain('created: 2024-01-01');
      expect(content).toContain('# 我的標題');
      expect(content).toContain('筆記內容');
    });

    it('應該正確處理空 frontmatter', () => {
      const content = NoteParser.generateNoteContent('僅標題', '僅內容', {});

      expect(content).toContain('# 僅標題');
      expect(content).toContain('僅內容');
    });
  });

  describe('generateDailyNoteContent', () => {
    it('應該生成每日筆記內容', () => {
      const date = new Date('2024-01-15');
      const content = NoteParser.generateDailyNoteContent(date, '今天的筆記');

      expect(content).toContain('date: 2024-01-15');
      expect(content).toContain('tags:');
      expect(content).toContain('type: daily-note');
      expect(content).toContain('# 2024-01-15');
      expect(content).toContain('今天的筆記');
    });
  });
});
