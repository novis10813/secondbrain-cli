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

    it('does not extract tags inside code blocks', () => {
      const content = `# Doc

Real #tag in body.

\`\`\`
#fake-tag in fenced block
\`\`\`

Inline \`#code-tag\` ignored.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.tags).toHaveLength(1);
      expect(parsed.tags[0].name).toBe('tag');
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

    it('truncates title from first line to 100 characters', () => {
      const long = 'a'.repeat(150);
      const content = long + '\n\nrest of body';
      const parsed = NoteParser.parse(content);
      expect(parsed.title).toHaveLength(100);
      expect(parsed.title).toBe('a'.repeat(100));
    });

    it('treats invalid YAML frontmatter as no frontmatter and uses full content as body', () => {
      const content = `---
title: unclosed
tags: [a
---

# Real Title

Body.`;
      const parsed = NoteParser.parse(content);
      expect(parsed.frontmatter).toEqual({});
      expect(parsed.title).toBe('Real Title');
      expect(parsed.content).toContain('---');
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

    it('headings include level, text, and position (line and column)', () => {
      const content = `# One

## Two

### Three`;

      const parsed = NoteParser.parse(content);

      expect(parsed.headings).toHaveLength(3);
      expect(parsed.headings[0]).toMatchObject({ level: 1, text: 'One', line: 1, column: 1 });
      expect(parsed.headings[1]).toMatchObject({ level: 2, text: 'Two', line: 3, column: 1 });
      expect(parsed.headings[2]).toMatchObject({ level: 3, text: 'Three', line: 5, column: 1 });
    });

    it('headings with frontmatter use body-relative line numbers', () => {
      const content = `---
tags: [a]
---

# Title

## Section`;

      const parsed = NoteParser.parse(content);

      expect(parsed.headings).toHaveLength(2);
      expect(parsed.headings[0]).toMatchObject({ level: 1, text: 'Title', line: 1, column: 1 });
      expect(parsed.headings[1]).toMatchObject({ level: 2, text: 'Section', line: 3, column: 1 });
    });

    it('does not extract headings inside code blocks', () => {
      const content = `# Real

\`\`\`
# Fake in fenced block
## Also fake
\`\`\`

## Real Two

Inline \`# not heading\` ignored.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.headings).toHaveLength(2);
      expect(parsed.headings[0]).toMatchObject({ level: 1, text: 'Real' });
      expect(parsed.headings[1]).toMatchObject({ level: 2, text: 'Real Two' });
    });

    it('extracts all heading levels H1 through H6 with correct level and position', () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

      const parsed = NoteParser.parse(content);

      expect(parsed.headings).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(parsed.headings[i].level).toBe(i + 1);
        expect(parsed.headings[i].text).toBe(`H${i + 1}`);
        expect(parsed.headings[i].line).toBe(i + 1);
        expect(parsed.headings[i].column).toBe(1);
      }
    });

    describe('heading structure extraction', () => {
      it('builds hierarchical structure from flat heading list', () => {
        const content = `# Chapter 1
## Section 1.1
### Subsection 1.1.1
## Section 1.2
# Chapter 2
## Section 2.1`;

        const parsed = NoteParser.parse(content);

        expect(parsed.headingStructure).toHaveLength(2);
        expect(parsed.headingStructure[0].text).toBe('Chapter 1');
        expect(parsed.headingStructure[0].children).toHaveLength(2);
        expect(parsed.headingStructure[0].children[0].text).toBe('Section 1.1');
        expect(parsed.headingStructure[0].children[0].children).toHaveLength(1);
        expect(parsed.headingStructure[0].children[0].children[0].text).toBe('Subsection 1.1.1');
        expect(parsed.headingStructure[0].children[1].text).toBe('Section 1.2');
        expect(parsed.headingStructure[1].text).toBe('Chapter 2');
        expect(parsed.headingStructure[1].children).toHaveLength(1);
        expect(parsed.headingStructure[1].children[0].text).toBe('Section 2.1');
      });

      it('handles multiple root-level headings', () => {
        const content = `# First
# Second
# Third`;

        const parsed = NoteParser.parse(content);

        expect(parsed.headingStructure).toHaveLength(3);
        expect(parsed.headingStructure[0].text).toBe('First');
        expect(parsed.headingStructure[1].text).toBe('Second');
        expect(parsed.headingStructure[2].text).toBe('Third');
        expect(parsed.headingStructure[0].children).toHaveLength(0);
        expect(parsed.headingStructure[1].children).toHaveLength(0);
        expect(parsed.headingStructure[2].children).toHaveLength(0);
      });

      it('handles deep nesting correctly', () => {
        const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

        const parsed = NoteParser.parse(content);

        expect(parsed.headingStructure).toHaveLength(1);
        let node = parsed.headingStructure[0];
        expect(node.text).toBe('H1');
        expect(node.children).toHaveLength(1);
        node = node.children[0];
        expect(node.text).toBe('H2');
        expect(node.children).toHaveLength(1);
        node = node.children[0];
        expect(node.text).toBe('H3');
        expect(node.children).toHaveLength(1);
        node = node.children[0];
        expect(node.text).toBe('H4');
        expect(node.children).toHaveLength(1);
        node = node.children[0];
        expect(node.text).toBe('H5');
        expect(node.children).toHaveLength(1);
        node = node.children[0];
        expect(node.text).toBe('H6');
        expect(node.children).toHaveLength(0);
      });

      it('handles skipped heading levels (e.g., H1 -> H3)', () => {
        const content = `# H1
### H3
## H2
### H3`;

        const parsed = NoteParser.parse(content);

        expect(parsed.headingStructure).toHaveLength(1);
        expect(parsed.headingStructure[0].text).toBe('H1');
        expect(parsed.headingStructure[0].children).toHaveLength(2);
        expect(parsed.headingStructure[0].children[0].text).toBe('H3');
        expect(parsed.headingStructure[0].children[1].text).toBe('H2');
        expect(parsed.headingStructure[0].children[1].children).toHaveLength(1);
        expect(parsed.headingStructure[0].children[1].children[0].text).toBe('H3');
      });

      it('handles empty headings list', () => {
        const content = `No headings here
Just regular text`;

        const parsed = NoteParser.parse(content);

        expect(parsed.headings).toHaveLength(0);
        expect(parsed.headingStructure).toHaveLength(0);
      });

      it('preserves heading properties in structure', () => {
        const content = `# Title
## Subtitle`;

        const parsed = NoteParser.parse(content);

        expect(parsed.headingStructure[0]).toMatchObject({
          level: 1,
          text: 'Title',
          line: 1,
          column: 1
        });
        expect(parsed.headingStructure[0].position).toBeDefined();
        expect(parsed.headingStructure[0].children[0]).toMatchObject({
          level: 2,
          text: 'Subtitle',
          line: 2,
          column: 1
        });
        expect(parsed.headingStructure[0].children[0].position).toBeDefined();
      });

      it('handles complex nested structure with multiple branches', () => {
        const content = `# Main
## A
### A1
### A2
## B
### B1
#### B1a
### B2
# Another Main
## C`;

        const parsed = NoteParser.parse(content);

        expect(parsed.headingStructure).toHaveLength(2);
        const main = parsed.headingStructure[0];
        expect(main.text).toBe('Main');
        expect(main.children).toHaveLength(2);
        expect(main.children[0].text).toBe('A');
        expect(main.children[0].children).toHaveLength(2);
        expect(main.children[0].children[0].text).toBe('A1');
        expect(main.children[0].children[1].text).toBe('A2');
        expect(main.children[1].text).toBe('B');
        expect(main.children[1].children).toHaveLength(2);
        expect(main.children[1].children[0].text).toBe('B1');
        expect(main.children[1].children[0].children).toHaveLength(1);
        expect(main.children[1].children[0].children[0].text).toBe('B1a');
        expect(main.children[1].children[1].text).toBe('B2');
        expect(parsed.headingStructure[1].text).toBe('Another Main');
        expect(parsed.headingStructure[1].children).toHaveLength(1);
        expect(parsed.headingStructure[1].children[0].text).toBe('C');
      });
    });

    describe('buildSections', () => {
      it('builds frontmatter section and one section per heading', () => {
        const content = `---
title: Test
---

# First

Intro.

## Second

More.`;

        const parsed = NoteParser.parse(content);
        const sections = NoteParser.buildSections(parsed, content);

        expect(sections).toHaveLength(3);
        expect(sections[0].id).toBe('frontmatter');
        expect(sections[0].type).toBe('frontmatter');
        expect(sections[0].position.start.offset).toBe(0);
        expect(sections[1].id).toBe('0');
        expect(sections[1].type).toBe('heading');
        expect(sections[2].id).toBe('1');
        expect(sections[2].type).toBe('heading');
      });

      it('builds single content section when no headings', () => {
        const content = `---
tags: [a]
---

Body only.`;

        const parsed = NoteParser.parse(content);
        const sections = NoteParser.buildSections(parsed, content);

        expect(sections).toHaveLength(2);
        expect(sections[0].id).toBe('frontmatter');
        expect(sections[0].type).toBe('frontmatter');
        expect(sections[1].id).toBe('0');
        expect(sections[1].type).toBe('content');
        expect(sections[1].position.start.offset).toBeGreaterThan(0);
        expect(sections[1].position.end.offset).toBe(content.length);
      });

      it('builds heading sections only when no frontmatter', () => {
        const content = `# One

Text.

## Two

More.`;

        const parsed = NoteParser.parse(content);
        const sections = NoteParser.buildSections(parsed, content);

        expect(sections).toHaveLength(2);
        expect(sections[0].id).toBe('0');
        expect(sections[0].type).toBe('heading');
        expect(sections[1].id).toBe('1');
        expect(sections[1].type).toBe('heading');
        expect(sections[1].position.end.offset).toBe(content.length);
      });
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

    it('extracts block refs from wikilink targets [[path#^block-id]]', () => {
      const content = `# Doc

See [[other#^abc123]] and [[note#^xyz-99]].`;

      const parsed = NoteParser.parse(content);
      expect(parsed.links.map(l => l.target)).toEqual(['other#^abc123', 'note#^xyz-99']);
      expect(parsed.blockRefs.map(b => b.blockId).sort()).toEqual(['abc123', 'xyz-99']);
    });

    it('extracts block refs from embed targets ![[path#^block-id]]', () => {
      const content = `# Doc

![[page#^embed-block]].`;

      const parsed = NoteParser.parse(content);
      expect(parsed.embeds[0].target).toBe('page#^embed-block');
      expect(parsed.blockRefs.map(b => b.blockId)).toContain('embed-block');
    });

    it('deduplicates block ref from both body and link', () => {
      const content = 'Ref ^id and link [[x#^id]].';
      const parsed = NoteParser.parse(content);
      expect(parsed.blockRefs).toHaveLength(1);
      expect(parsed.blockRefs[0].blockId).toBe('id');
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

    it('extracts links from frontmatter fields (e.g. string with wikilinks)', () => {
      const content = `---
seealso: "[[Note A]] and [[Note B|Label]]"
---

# Doc

Body.`;
      const parsed = NoteParser.parse(content);
      expect(parsed.links.some(l => l.target === 'Note A')).toBe(true);
      expect(parsed.links.some(l => l.target === 'Note B')).toBe(true);
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

    it('does not extract embeds inside code blocks', () => {
      const content = `# Doc

Real embed ![[image.png]].

\`\`\`md
![[code-block-embed]]
\`\`\`

Inline \`![[fake]]\` ignored.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.embeds).toHaveLength(1);
      expect(parsed.embeds[0].target).toBe('image.png');
    });
  });

  describe('list structure extraction', () => {
    it('extracts simple unordered list items', () => {
      const content = `# Doc

- Item 1
- Item 2
- Item 3`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(3);
      expect(parsed.listItems[0].level).toBe(0);
      expect(parsed.listItems[1].level).toBe(0);
      expect(parsed.listItems[2].level).toBe(0);
      expect(parsed.listItems[0].task).toBeUndefined();
    });

    it('extracts nested list items with hierarchy', () => {
      const content = `# Doc

- Level 0
  - Level 1
    - Level 2
  - Level 1 again
- Back to Level 0`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(5);
      expect(parsed.listItems[0].level).toBe(0);
      expect(parsed.listItems[1].level).toBe(1);
      expect(parsed.listItems[2].level).toBe(2);
      expect(parsed.listItems[3].level).toBe(1);
      expect(parsed.listItems[4].level).toBe(0);
    });

    it('extracts ordered list items', () => {
      const content = `# Doc

1. First item
2. Second item
3. Third item`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(3);
      expect(parsed.listItems[0].level).toBe(0);
      expect(parsed.listItems[1].level).toBe(0);
      expect(parsed.listItems[2].level).toBe(0);
    });

    it('extracts task items with checkboxes', () => {
      const content = `# Doc

- [ ] Unchecked task
- [x] Checked task
- [X] Checked task uppercase
- Regular item`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(4);
      expect(parsed.listItems[0].task).toBeUndefined(); // unchecked
      expect(parsed.listItems[1].task).toBe('x'); // checked
      expect(parsed.listItems[2].task).toBe('x'); // checked uppercase
      expect(parsed.listItems[3].task).toBeUndefined(); // non-task
    });

    it('extracts nested task items', () => {
      const content = `# Doc

- [ ] Parent task
  - [x] Child task
    - [ ] Grandchild task`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(3);
      expect(parsed.listItems[0].level).toBe(0);
      expect(parsed.listItems[0].task).toBeUndefined();
      expect(parsed.listItems[1].level).toBe(1);
      expect(parsed.listItems[1].task).toBe('x');
      expect(parsed.listItems[2].level).toBe(2);
      expect(parsed.listItems[2].task).toBeUndefined();
    });

    it('list items include position (line, column)', () => {
      const content = `# Doc

- First item
  - Nested item
- Second item`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(3);
      expect(parsed.listItems[0].line).toBe(2);
      expect(parsed.listItems[0].column).toBeGreaterThan(0);
      expect(parsed.listItems[1].line).toBe(4);
      expect(parsed.listItems[2].line).toBe(5);
    });

    it('list items have position with start/end Loc and offset', () => {
      const content = `# Doc

- Item with position`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(1);
      expect(parsed.listItems[0].position).toBeDefined();
      expect(parsed.listItems[0].position.start).toMatchObject({ line: 1, col: 0 });
      expect(parsed.listItems[0].position.end.offset).toBeGreaterThan(
        parsed.listItems[0].position.start.offset
      );
    });

    it('does not extract list items inside code blocks', () => {
      const content = `# Doc

Real list:
- Real item

\`\`\`
- Fake in code block
\`\`\`

Inline \`- fake\` ignored.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(1);
      expect(parsed.listItems[0].level).toBe(0);
    });

    it('handles mixed list types (unordered and ordered)', () => {
      const content = `# Doc

- Unordered item
1. Ordered item
- Another unordered
2. Another ordered`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(4);
      expect(parsed.listItems[0].level).toBe(0);
      expect(parsed.listItems[1].level).toBe(0);
      expect(parsed.listItems[2].level).toBe(0);
      expect(parsed.listItems[3].level).toBe(0);
    });

    it('handles list items with frontmatter', () => {
      const content = `---
tags: [test]
---

# Doc

- Item 1
- Item 2`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(2);
      expect(parsed.listItems[0].line).toBe(2); // body-relative line
      expect(parsed.listItems[1].line).toBe(4);
    });

    it('handles empty list', () => {
      const content = `# Doc

No lists here.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(0);
    });

    it('handles list items with asterisk and plus markers', () => {
      const content = `# Doc

* Item with asterisk
+ Item with plus
- Item with dash`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(3);
      expect(parsed.listItems[0].level).toBe(0);
      expect(parsed.listItems[1].level).toBe(0);
      expect(parsed.listItems[2].level).toBe(0);
    });

    it('handles deeply nested lists', () => {
      const content = `# Doc

- Level 0
    - Level 1
        - Level 2
            - Level 3`;

      const parsed = NoteParser.parse(content);

      expect(parsed.listItems).toHaveLength(4);
      expect(parsed.listItems[0].level).toBe(0);
      expect(parsed.listItems[1].level).toBe(2); // 4 spaces = level 2
      expect(parsed.listItems[2].level).toBe(4); // 8 spaces = level 4
      expect(parsed.listItems[3].level).toBe(6); // 12 spaces = level 6
    });
  });

  describe('position extraction', () => {
    it('links have position with start/end Loc and offset', () => {
      const content = `# Doc

See [[First]] here.`;
      const parsed = NoteParser.parse(content);
      const link = parsed.links.find(l => l.target === 'First')!;
      expect(link.position).toBeDefined();
      expect(link.position.start).toMatchObject({ line: 2, col: 4 });
      expect(link.position.end).toMatchObject({ line: 2, col: 13 });
      expect(link.position.end.offset).toBeGreaterThan(link.position.start.offset);
    });

    it('tags have position with start/end Loc and offset', () => {
      const content = `# Doc

Text with #foo and #bar.`;
      const parsed = NoteParser.parse(content);
      const tag = parsed.tags.find(t => t.name === 'foo')!;
      expect(tag.position).toBeDefined();
      expect(tag.position.start.line).toBe(2);
      expect(tag.position.end.line).toBe(2);
      expect(tag.position.end.offset).toBeGreaterThan(tag.position.start.offset);
    });

    it('headings have position with start/end Loc and offset', () => {
      const content = `# Title

Body`;
      const parsed = NoteParser.parse(content);
      expect(parsed.headings[0].position).toBeDefined();
      expect(parsed.headings[0].position.start).toMatchObject({ line: 0, col: 0 });
      expect(parsed.headings[0].position.end.offset).toBeGreaterThan(
        parsed.headings[0].position.start.offset
      );
    });

    it('block refs have position with start/end Loc and offset', () => {
      const content = `# Doc

Text ^block1 more.`;
      const parsed = NoteParser.parse(content);
      const block = parsed.blockRefs.find(b => b.blockId === 'block1')!;
      expect(block.position).toBeDefined();
      expect(block.position.start).toMatchObject({ line: 2, col: 5 });
      expect(block.position.end.offset).toBeGreaterThan(block.position.start.offset);
    });

    it('embeds have position with start/end Loc and offset', () => {
      const content = `# Doc

![[image.png]]`;
      const parsed = NoteParser.parse(content);
      expect(parsed.embeds[0].position).toBeDefined();
      expect(parsed.embeds[0].position.start).toMatchObject({ line: 2, col: 0 });
      expect(parsed.embeds[0].position.end.offset).toBeGreaterThan(
        parsed.embeds[0].position.start.offset
      );
    });

    it('frontmatterPosition is set when frontmatter exists', () => {
      const content = `---
tags: [a]
---

# Title`;
      const parsed = NoteParser.parse(content);
      expect(parsed.frontmatterPosition).toBeDefined();
      expect(parsed.frontmatterPosition!.start).toMatchObject({
        line: 0,
        col: 0,
        offset: 0
      });
      expect(parsed.frontmatterPosition!.end.offset).toBeGreaterThan(0);
    });

    it('frontmatterPosition is undefined when no frontmatter', () => {
      const content = `# Title

Body`;
      const parsed = NoteParser.parse(content);
      expect(parsed.frontmatterPosition).toBeUndefined();
    });

    it('body element positions are content-relative (after frontmatter)', () => {
      const content = `---
tags: [x]
---

# H

[[link]]`;
      const parsed = NoteParser.parse(content);
      const link = parsed.links.find(l => l.target === 'link')!;
      // Body starts after frontmatter; link position offset is in full content
      expect(link.position.start.offset).toBeGreaterThan(parsed.frontmatterPosition!.end.offset);
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

  describe('headingsToCache', () => {
    it('converts HeadingRef[] to HeadingCache[] with heading property', () => {
      const content = `# Title
## Section
### Subsection`;
      const parsed = NoteParser.parse(content);
      const cache = NoteParser.headingsToCache(parsed.headings);

      expect(cache).toHaveLength(3);
      expect(cache[0]).toMatchObject({
        heading: 'Title',
        level: 1,
        position: parsed.headings[0].position
      });
      expect(cache[1]).toMatchObject({
        heading: 'Section',
        level: 2,
        position: parsed.headings[1].position
      });
      expect(cache[2]).toMatchObject({
        heading: 'Subsection',
        level: 3,
        position: parsed.headings[2].position
      });
    });

    it('handles empty headings array', () => {
      const cache = NoteParser.headingsToCache([]);
      expect(cache).toHaveLength(0);
    });

    it('preserves position information', () => {
      const content = `# Test Heading`;
      const parsed = NoteParser.parse(content);
      const cache = NoteParser.headingsToCache(parsed.headings);

      expect(cache[0].position).toBeDefined();
      expect(cache[0].position.start).toEqual(parsed.headings[0].position.start);
      expect(cache[0].position.end).toEqual(parsed.headings[0].position.end);
    });
  });

  describe('listItemsToCache', () => {
    it('converts ListItemRef[] to ListItemCache[] with task and position', () => {
      const content = `# Doc

- [ ] Unchecked task
- [x] Checked task
- Regular item`;

      const parsed = NoteParser.parse(content);
      const cache = NoteParser.listItemsToCache(parsed.listItems);

      expect(cache).toHaveLength(3);
      expect(cache[0].task).toBeUndefined(); // unchecked
      expect(cache[0].position).toBeDefined();
      expect(cache[1].task).toBe('x'); // checked
      expect(cache[1].position).toBeDefined();
      expect(cache[2].task).toBeUndefined(); // non-task
      expect(cache[2].position).toBeDefined();
    });

    it('handles empty list items array', () => {
      const cache = NoteParser.listItemsToCache([]);
      expect(cache).toHaveLength(0);
    });

    it('preserves position information', () => {
      const content = `# Doc

- Item with position`;

      const parsed = NoteParser.parse(content);
      const cache = NoteParser.listItemsToCache(parsed.listItems);

      expect(cache[0].position.start).toBeDefined();
      expect(cache[0].position.end).toBeDefined();
      expect(cache[0].position.start.offset).toBeLessThan(cache[0].position.end.offset);
    });
  });

  describe('heading links support', () => {
    it('extracts heading links like [[note#heading]]', () => {
      const content = `# Doc

See [[other#Section Title]] and [[note#Another Heading]].`;

      const parsed = NoteParser.parse(content);

      expect(parsed.links).toHaveLength(2);
      expect(parsed.links[0].target).toBe('other#Section Title');
      expect(parsed.links[1].target).toBe('note#Another Heading');
    });

    it('extracts heading links with display text [[note#heading|display]]', () => {
      const content = `# Doc

Link [[page#Section|Custom Text]].`;

      const parsed = NoteParser.parse(content);

      expect(parsed.links).toHaveLength(1);
      expect(parsed.links[0].target).toBe('page#Section');
    });

    it('extracts heading links with block refs [[note#heading#^block-id]]', () => {
      const content = `# Doc

See [[other#Heading#^block123]].`;

      const parsed = NoteParser.parse(content);

      expect(parsed.links).toHaveLength(1);
      expect(parsed.links[0].target).toBe('other#Heading#^block123');
      // Block ref should also be extracted
      expect(parsed.blockRefs.some(b => b.blockId === 'block123')).toBe(true);
    });
  });

  describe('footnote extraction', () => {
    it('extracts footnote references [^id] from body', () => {
      const content = `# Doc

Text with [^1] and [^note] here.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.footnoteRefs).toHaveLength(2);
      expect(parsed.footnoteRefs.map(r => r.id)).toEqual(['1', 'note']);
    });

    it('extracts footnote definitions [^id]: content at line start', () => {
      const content = `# Doc

Some text.

[^1]: First footnote content
[^note]: Second footnote here.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.footnotes).toHaveLength(2);
      expect(parsed.footnotes[0]).toMatchObject({ id: '1', content: 'First footnote content' });
      expect(parsed.footnotes[1]).toMatchObject({ id: 'note', content: 'Second footnote here.' });
    });

    it('does not treat definition [^id]: as a reference', () => {
      const content = `# Doc

[^1]: Only definition, no ref in text.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.footnotes).toHaveLength(1);
      expect(parsed.footnotes[0].id).toBe('1');
      expect(parsed.footnoteRefs).toHaveLength(0);
    });

    it('footnote refs and definitions include position (line, column)', () => {
      const content = `# Doc

See [^1] here.

[^1]: The footnote.`;

      const parsed = NoteParser.parse(content);

      const ref = parsed.footnoteRefs.find(r => r.id === '1');
      const def = parsed.footnotes.find(f => f.id === '1');
      expect(ref).toBeDefined();
      expect(ref!.line).toBe(3);
      expect(ref!.column).toBeGreaterThan(0);
      expect(def).toBeDefined();
      expect(def!.line).toBeGreaterThan(ref!.line);
      expect(def!.content).toBe('The footnote.');
    });

    it('does not extract footnotes inside code blocks', () => {
      const content = `# Doc

Real ref [^1].

\`\`\`
[^fake]: in code block
\`\`\`

Inline \`[^also-fake]\` ignored.`;

      const parsed = NoteParser.parse(content);

      expect(parsed.footnoteRefs).toHaveLength(1);
      expect(parsed.footnoteRefs[0].id).toBe('1');
      expect(parsed.footnotes).toHaveLength(0);
    });

    it('extracts multiple refs to same id', () => {
      const content = `# Doc

First [^1] and again [^1].`;

      const parsed = NoteParser.parse(content);

      expect(parsed.footnoteRefs).toHaveLength(2);
      expect(parsed.footnoteRefs[0].id).toBe('1');
      expect(parsed.footnoteRefs[1].id).toBe('1');
    });

    it('parsedToContentMetadata includes footnotes and footnoteRefs', () => {
      const content = `# Doc

See [^a] and [^b].

[^a]: Def A
[^b]: Def B`;

      const parsed = NoteParser.parse(content);
      const meta = NoteParser.parsedToContentMetadata(parsed, content);

      expect(meta.footnotes).toHaveLength(2);
      expect(meta.footnotes!.some(f => f.id === 'a' && f.content === 'Def A')).toBe(true);
      expect(meta.footnotes!.some(f => f.id === 'b' && f.content === 'Def B')).toBe(true);
      expect(meta.footnoteRefs).toHaveLength(2);
      expect(meta.footnoteRefs!.map(r => r.id)).toEqual(['a', 'b']);
    });
  });

  describe('parsedToContentMetadata', () => {
    it('converts ParsedNote to ContentMetadata with links, tags, headings, blocks', () => {
      const content = `# Title

See [[target]] and #tag. Text ^block-1.`;
      const parsed = NoteParser.parse(content);
      const meta = NoteParser.parsedToContentMetadata(parsed, content);

      expect(meta.links).toHaveLength(1);
      expect(meta.links![0].link).toBe('target');
      expect(meta.tags).toHaveLength(1);
      expect(meta.tags![0].tag).toBe('tag');
      expect(meta.headings).toHaveLength(1);
      expect(meta.headings![0].heading).toBe('Title');
      expect(meta.blocks).toHaveLength(1);
      expect(meta.blocks![0].id).toBe('block-1');
    });

    it('includes displayText for link when original content has [[path|display]]', () => {
      const content = `# Doc

Link [[page|Display Label]].`;
      const parsed = NoteParser.parse(content);
      const meta = NoteParser.parsedToContentMetadata(parsed, content);

      expect(meta.links).toHaveLength(1);
      expect(meta.links![0].displayText).toBe('Display Label');
      expect(meta.links![0].original).toBe('[[page|Display Label]]');
    });

    it('includes sections when originalContent is provided', () => {
      const content = `# Title

Body.`;
      const parsed = NoteParser.parse(content);
      const meta = NoteParser.parsedToContentMetadata(parsed, content);

      expect(meta.sections).toBeDefined();
      expect(meta.sections!.length).toBeGreaterThanOrEqual(1);
      expect(meta.sections!.some(s => s.type === 'heading' && s.id === '0')).toBe(true);
    });

    it('omits sections when originalContent is not provided', () => {
      const content = `# Title

Body.`;
      const parsed = NoteParser.parse(content);
      const meta = NoteParser.parsedToContentMetadata(parsed);

      expect(meta.sections).toBeUndefined();
    });
  });
});
