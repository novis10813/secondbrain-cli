import { describe, it, expect } from 'bun:test';
import type {
  ContentMetadata,
  Loc,
  Pos,
  CacheItem,
  LinkCache,
  EmbedCache,
  TagCache,
  HeadingCache,
  BlockCache,
  FrontMatterCache,
  FootnoteCache,
  FootnoteRefCache,
  SectionCache,
  ListItemCache
} from '../../src/types';

function loc(line: number, col: number, offset: number): Loc {
  return { line, col, offset };
}

function pos(start: Loc, end: Loc): Pos {
  return { start, end };
}

describe('ContentMetadata (Obsidian CachedMetadata alignment)', () => {
  it('accepts empty ContentMetadata (all optional)', () => {
    const meta: ContentMetadata = {};
    expect(meta).toEqual({});
  });

  it('accepts ContentMetadata with links (LinkCache[])', () => {
    const linkPos = pos(loc(1, 0, 10), loc(1, 12, 22));
    const links: LinkCache[] = [
      { link: 'other-note', original: '[[other-note]]', position: linkPos },
      {
        link: 'page',
        original: '[[page|Display]]',
        displayText: 'Display',
        position: linkPos
      }
    ];
    const meta: ContentMetadata = { links };
    expect(meta.links).toHaveLength(2);
    expect(meta.links![0].link).toBe('other-note');
    expect(meta.links![1].displayText).toBe('Display');
  });

  it('accepts ContentMetadata with embeds (EmbedCache[])', () => {
    const embedPos = pos(loc(2, 0, 30), loc(2, 15, 45));
    const embeds: EmbedCache[] = [
      { link: 'image.png', original: '![[image.png]]', position: embedPos }
    ];
    const meta: ContentMetadata = { embeds };
    expect(meta.embeds![0].link).toBe('image.png');
  });

  it('accepts ContentMetadata with tags (TagCache[])', () => {
    const tagPos = pos(loc(0, 5, 5), loc(0, 10, 10));
    const tags: TagCache[] = [{ tag: 'todo', position: tagPos }];
    const meta: ContentMetadata = { tags };
    expect(meta.tags![0].tag).toBe('todo');
  });

  it('accepts ContentMetadata with headings (HeadingCache[])', () => {
    const headPos = pos(loc(3, 0, 50), loc(3, 8, 58));
    const headings: HeadingCache[] = [
      { heading: 'Section', level: 2, position: headPos }
    ];
    const meta: ContentMetadata = { headings };
    expect(meta.headings![0].heading).toBe('Section');
    expect(meta.headings![0].level).toBe(2);
  });

  it('accepts ContentMetadata with blocks (BlockCache[])', () => {
    const blockPos = pos(loc(4, 0, 60), loc(4, 12, 72));
    const blocks: BlockCache[] = [{ id: 'abc123', position: blockPos }];
    const meta: ContentMetadata = { blocks };
    expect(meta.blocks![0].id).toBe('abc123');
  });

  it('accepts ContentMetadata with frontmatter (FrontMatterCache)', () => {
    const fmPos = pos(loc(0, 0, 0), loc(5, 0, 50));
    const frontmatter: FrontMatterCache = { position: fmPos };
    const meta: ContentMetadata = { frontmatter };
    expect(meta.frontmatter!.position.end.offset).toBe(50);
  });

  it('accepts ContentMetadata with footnotes and footnoteRefs', () => {
    const fnPos = pos(loc(10, 0, 100), loc(10, 20, 120));
    const footnotes: FootnoteCache[] = [
      { id: '1', content: 'Footnote text', position: fnPos }
    ];
    const refPos = pos(loc(5, 10, 60), loc(5, 12, 62));
    const footnoteRefs: FootnoteRefCache[] = [{ id: '1', position: refPos }];
    const meta: ContentMetadata = { footnotes, footnoteRefs };
    expect(meta.footnotes![0].content).toBe('Footnote text');
    expect(meta.footnoteRefs![0].id).toBe('1');
  });

  it('accepts ContentMetadata with sections and listItems', () => {
    const secPos = pos(loc(0, 0, 0), loc(100, 0, 500));
    const sections: SectionCache[] = [
      { id: 'sec-1', type: 'content', position: secPos }
    ];
    const liPos = pos(loc(6, 0, 70), loc(6, 10, 80));
    const listItems: ListItemCache[] = [
      { position: liPos },
      { task: 'x', position: liPos }
    ];
    const meta: ContentMetadata = { sections, listItems };
    expect(meta.sections![0].type).toBe('content');
    expect(meta.listItems![1].task).toBe('x');
  });

  it('CacheItem requires position with start/end Loc', () => {
    const item: CacheItem = {
      position: {
        start: { line: 0, col: 0, offset: 0 },
        end: { line: 0, col: 5, offset: 5 }
      }
    };
    expect(item.position.start.offset).toBe(0);
    expect(item.position.end.line).toBe(0);
  });

  it('Pos uses 0-based line (Obsidian convention)', () => {
    const p = pos(loc(0, 0, 0), loc(1, 2, 10));
    expect(p.start.line).toBe(0);
    expect(p.end.line).toBe(1);
  });
});
