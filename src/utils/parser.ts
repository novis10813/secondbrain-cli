import { createHash } from 'crypto';
import * as yaml from 'yaml';

export interface Position {
  line: number;
  column: number;
}

export interface LinkRef {
  target: string;
  line: number;
  column: number;
}

export interface TagRef {
  name: string;
  line: number;
  column: number;
}

export interface HeadingRef {
  level: number;
  text: string;
  line: number;
  column: number;
}

export interface BlockRef {
  blockId: string;
  line: number;
  column: number;
}

export interface EmbedRef {
  target: string;
  line: number;
  column: number;
}

export interface ParsedNote {
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: TagRef[];
  links: LinkRef[];
  headings: HeadingRef[];
  blockRefs: BlockRef[];
  embeds: EmbedRef[];
}

export class NoteParser {
  static parse(content: string): ParsedNote {
    const { frontmatter, body } = this.extractFrontmatter(content);
    const codeRanges = this.getCodeBlockRanges(body);
    const title = this.extractTitle(body);
    const tags = this.extractTags(frontmatter, body, codeRanges);
    const links = this.extractLinks(frontmatter, body);
    const headings = this.extractHeadings(body, codeRanges);
    const blockRefs = this.extractBlockRefs(body, codeRanges);
    const embeds = this.extractEmbeds(body);

    return {
      title,
      content: body,
      frontmatter,
      tags,
      links,
      headings,
      blockRefs,
      embeds
    };
  }

  private static indexToPosition(content: string, index: number): Position {
    const before = content.slice(0, index);
    const lastNewline = before.lastIndexOf('\n');
    const line = (before.match(/\n/g)?.length ?? 0) + 1;
    const column = lastNewline === -1 ? index + 1 : index - lastNewline;
    return { line, column };
  }

  private static getCodeBlockRanges(content: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    const fenced = /```[^`]*?```/g;
    let m;
    while ((m = fenced.exec(content)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
    }
    const inline = /`[^`]*`/g;
    while ((m = inline.exec(content)) !== null) {
      if (!ranges.some(([s, e]) => m!.index >= s && m!.index < e)) {
        ranges.push([m.index, m.index + m[0].length]);
      }
    }
    return ranges;
  }

  private static isInCodeBlock(index: number, ranges: Array<[number, number]>): boolean {
    return ranges.some(([s, e]) => index >= s && index < e);
  }

  static computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private static extractFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const frontmatter = yaml.parse(match[1]) || {};
        const body = content.slice(match[0].length);
        return { frontmatter, body };
      } catch {
        // Invalid YAML, treat as no frontmatter
      }
    }

    return { frontmatter: {}, body: content };
  }

  private static extractTitle(content: string): string {
    // Look for first H1 heading
    const h1Match = content.match(/^# (.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }

    // Look for first line that's not empty
    const firstLine = content.split('\n').find(line => line.trim());
    if (firstLine) {
      return firstLine.trim().slice(0, 100);
    }

    return 'Untitled';
  }

  private static extractTags(
    frontmatter: Record<string, unknown>,
    body: string,
    codeRanges: Array<[number, number]>
  ): TagRef[] {
    const seen = new Set<string>();
    const result: TagRef[] = [];
    const fmLine = { line: 1, column: 1 };

    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        for (const tag of frontmatter.tags) {
          const name = String(tag).replace(/^#/, '');
          if (name && !seen.has(name)) {
            seen.add(name);
            result.push({ name, ...fmLine });
          }
        }
      } else if (typeof frontmatter.tags === 'string') {
        for (const tag of frontmatter.tags.split(/[,\s]+/)) {
          const name = tag.replace(/^#/, '');
          if (name && !seen.has(name)) {
            seen.add(name);
            result.push({ name, ...fmLine });
          }
        }
      }
    }

    const tagRegex = /#([\w/-]+)/g;
    let match;
    while ((match = tagRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const charBefore = match.index === 0 ? '\n' : body[match.index - 1];
      const atLineStart = charBefore === '\n' || charBefore === '\r';
      if (atLineStart && body.slice(match.index).match(/^#{1,6}\s+/)) continue; // heading
      if (!atLineStart && !/[\s]/.test(charBefore)) continue; // require space/newline before #tag
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);
      const pos = this.indexToPosition(body, match.index);
      result.push({ name, line: pos.line, column: pos.column });
    }

    return result;
  }

  private static extractLinks(frontmatter: Record<string, unknown>, body: string): LinkRef[] {
    const result: LinkRef[] = [];
    const seen = new Set<string>();
    const fmPos = { line: 1, column: 1 };

    this.extractLinksFromObject(frontmatter, (target) => {
      if (!seen.has(target)) {
        seen.add(target);
        result.push({ target, ...fmPos });
      }
    });

    // Obsidian links [[x]] or [[x|label]]; exclude embeds ![[x]]
    const linkRegex = /(?<!!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = linkRegex.exec(body)) !== null) {
      const target = match[1].trim();
      if (seen.has(target)) continue;
      seen.add(target);
      const pos = this.indexToPosition(body, match.index);
      result.push({ target, line: pos.line, column: pos.column });
    }

    return result;
  }

  private static extractEmbeds(body: string): EmbedRef[] {
    const result: EmbedRef[] = [];
    const seen = new Set<string>();
    // Obsidian embeds: ![[path]] or ![[path|display]]
    const embedRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = embedRegex.exec(body)) !== null) {
      const target = match[1].trim();
      if (seen.has(target)) continue;
      seen.add(target);
      const pos = this.indexToPosition(body, match.index);
      result.push({ target, line: pos.line, column: pos.column });
    }
    return result;
  }

  private static extractLinksFromObject(obj: unknown, onLink: (target: string) => void): void {
    if (typeof obj === 'string') {
      const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
      let match;
      while ((match = linkRegex.exec(obj)) !== null) {
        onLink(match[1].trim());
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => this.extractLinksFromObject(item, onLink));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(value => this.extractLinksFromObject(value, onLink));
    }
  }

  private static extractHeadings(
    body: string,
    codeRanges: Array<[number, number]>
  ): HeadingRef[] {
    const result: HeadingRef[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const level = match[1].length;
      const text = match[2].trim();
      const pos = this.indexToPosition(body, match.index);
      result.push({ level, text, line: pos.line, column: pos.column });
    }
    return result;
  }

  private static extractBlockRefs(
    body: string,
    codeRanges: Array<[number, number]>
  ): BlockRef[] {
    const result: BlockRef[] = [];
    const seen = new Set<string>();
    // Obsidian block ref: ^block-id (alphanumeric, hyphens, underscores)
    const blockRefRegex = /\^([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = blockRefRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const blockId = match[1];
      if (seen.has(blockId)) continue;
      seen.add(blockId);
      const pos = this.indexToPosition(body, match.index);
      result.push({ blockId, line: pos.line, column: pos.column });
    }
    return result;
  }

  static generateNoteContent(
    title: string,
    content: string,
    frontmatter: Record<string, unknown> = {}
  ): string {
    const fm = yaml.stringify(frontmatter).trim();
    return `---\n${fm}\n---\n\n# ${title}\n\n${content}`;
  }

  static generateDailyNoteContent(date: Date, content: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const frontmatter = {
      date: dateStr,
      tags: ['daily'],
      type: 'daily-note'
    };
    return this.generateNoteContent(dateStr, content, frontmatter);
  }
}