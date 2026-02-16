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

      expect(parsed.tags.some(t => t.name === 'tag1')).toBe(true);
      expect(parsed.tags.some(t => t.name === 'tag2/sub')).toBe(true);
    });

    it('應該從內文提取 Obsidian 連結', () => {
      const content = `---
title: Linked Note
---

# Test

請參考 [[另一篇筆記]] 和 [[筆記名稱|顯示文字]]`;

      const parsed = NoteParser.parse(content);

      expect(parsed.links.some(l => l.target === '另一篇筆記')).toBe(true);
      expect(parsed.links.some(l => l.target === '筆記名稱')).toBe(true);
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

    it('links include position (line, column)', () => {
      const content = `# Doc

See [[First]] and [[Second|label]].`;

      const parsed = NoteParser.parse(content);

      const first = parsed.links.find(l => l.target === 'First');
      const second = parsed.links.find(l => l.target === 'Second');
      expect(first).toBeDefined();
      expect(first!.line).toBe(3);
      expect(first!.column).toBeGreaterThan(0);
      expect(second).toBeDefined();
      expect(second!.line).toBe(3);
    });

    it('tags include position (line, column)', () => {
      const content = `# Doc

Text with #foo and #bar/baz.`;

      const parsed = NoteParser.parse(content);

      const foo = parsed.tags.find(t => t.name === 'foo');
      const bar = parsed.tags.find(t => t.name === 'bar/baz');
      expect(foo).toBeDefined();
      expect(foo!.line).toBe(3);
      expect(bar).toBeDefined();
      expect(bar!.line).toBe(3);
    });

    it('headings include level, text, and position', () => {
      const content = `# One

## Two

### Three`;

      const parsed = NoteParser.parse(content);

      expect(parsed.headings).toHaveLength(3);
      expect(parsed.headings[0]).toEqual({ level: 1, text: 'One', line: 1, column: 1 });
      expect(parsed.headings[1]).toEqual({ level: 2, text: 'Two', line: 3, column: 1 });
      expect(parsed.headings[2]).toEqual({ level: 3, text: 'Three', line: 5, column: 1 });
    });

    it('extracts block references ^block-id from body', () => {
      const content = `# Doc

Paragraph with ^abc123 at end.

Another ^xyz-99 and ^ref_id.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.blockRefs).toHaveLength(3);
      expect(parsed.blockRefs.map(b => b.blockId)).toEqual(['abc123', 'xyz-99', 'ref_id']);
    });

    it('block refs include position (line, column)', () => {
      const content = `# Doc

Text ^block1 more ^block2.`;

      const parsed = NoteParser.parse(content);

      const b1 = parsed.blockRefs.find(b => b.blockId === 'block1');
      const b2 = parsed.blockRefs.find(b => b.blockId === 'block2');
      expect(b1).toBeDefined();
      expect(b1!.line).toBe(3);
      expect(b2).toBeDefined();
      expect(b2!.line).toBe(3);
    });

    it('deduplicates block refs by blockId', () => {
      const content = 'Same ^id and again ^id.';
      const parsed = NoteParser.parse(content);
      expect(parsed.blockRefs).toHaveLength(1);
      expect(parsed.blockRefs[0].blockId).toBe('id');
    });

    it('does not extract block refs inside code blocks', () => {
      const content = `# Doc

Normal ^real.

\`\`\`
code with ^fake-id
\`\`\`

Inline \`^also-fake\` ignored.`;

      const parsed = NoteParser.parse(content);
      expect(parsed.blockRefs).toHaveLength(1);
      expect(parsed.blockRefs[0].blockId).toBe('real');
    });

    it('frontmatter tags have position line 1, body link has body-relative line', () => {
      const content = `---
tags: [a, b]
---

# T

[[x]]`;

      const parsed = NoteParser.parse(content);

      expect(parsed.tags.filter(t => t.name === 'a' || t.name === 'b').every(t => t.line === 1)).toBe(true);
      const link = parsed.links.find(l => l.target === 'x');
      expect(link).toBeDefined();
      expect(link!.line).toBe(3); // body line (first line of body is # T)
    });

    it('extracts embeds ![[path]] and ![[path|display]] with positions', () => {
      const content = `# Doc

Embed ![[image.png]] and ![[note|label]].`;

      const parsed = NoteParser.parse(content);

      expect(parsed.embeds).toHaveLength(2);
      expect(parsed.embeds.map(e => e.target)).toEqual(['image.png', 'note']);
      expect(parsed.embeds[0].line).toBe(3);
      expect(parsed.embeds[0].column).toBeGreaterThan(0);
      expect(parsed.embeds[1].line).toBe(3);
    });

    it('embeds are not included in links', () => {
      const content = `# Doc

Link [[page]] and embed ![[other]].`;

      const parsed = NoteParser.parse(content);

      expect(parsed.links).toHaveLength(1);
      expect(parsed.links[0].target).toBe('page');
      expect(parsed.embeds).toHaveLength(1);
      expect(parsed.embeds[0].target).toBe('other');
    });

    it('links and embeds both have correct positions', () => {
      const content = `# Doc

First [[a]] then ![[b]] then [[c]].`;

      const parsed = NoteParser.parse(content);

      const linkA = parsed.links.find(l => l.target === 'a');
      const linkC = parsed.links.find(l => l.target === 'c');
      const embedB = parsed.embeds.find(e => e.target === 'b');
      expect(linkA).toBeDefined();
      expect(linkC).toBeDefined();
      expect(embedB).toBeDefined();
      expect(parsed.links).toHaveLength(2);
      expect(parsed.embeds).toHaveLength(1);
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
