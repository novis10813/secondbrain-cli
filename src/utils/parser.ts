import { createHash } from 'crypto';
import * as yaml from 'yaml';

import type {
	Pos,
	HeadingCache,
	ListItemCache,
	ContentMetadata,
	LinkCache,
	TagCache,
	EmbedCache,
	BlockCache,
	FrontMatterCache,
	FootnoteCache,
	FootnoteRefCache
} from '../types/index.js';
import { rangeToPos } from './position.js';

export interface Position {
  line: number;
  column: number;
}

export interface LinkRef {
  target: string;
  line: number;
  column: number;
  position: Pos;
}

export interface TagRef {
  name: string;
  line: number;
  column: number;
  position: Pos;
}

export interface HeadingRef {
  level: number;
  text: string;
  line: number;
  column: number;
  position: Pos;
}

export interface HeadingStructure {
  level: number;
  text: string;
  line: number;
  column: number;
  position: Pos;
  children: HeadingStructure[];
}

export interface BlockRef {
  blockId: string;
  line: number;
  column: number;
  position: Pos;
}

export interface EmbedRef {
  target: string;
  line: number;
  column: number;
  position: Pos;
}

export interface ListItemRef {
  level: number;
  task?: string;
  line: number;
  column: number;
  position: Pos;
}

export interface FootnoteRef {
  id: string;
  line: number;
  column: number;
  position: Pos;
}

export interface FootnoteDef {
  id: string;
  content: string;
  line: number;
  column: number;
  position: Pos;
}

export interface ParsedNote {
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  frontmatterPosition?: Pos;
  tags: TagRef[];
  links: LinkRef[];
  headings: HeadingRef[];
  headingStructure: HeadingStructure[];
  blockRefs: BlockRef[];
  embeds: EmbedRef[];
  listItems: ListItemRef[];
  footnotes: FootnoteDef[];
  footnoteRefs: FootnoteRef[];
}

export class NoteParser {
  static parse(content: string): ParsedNote {
    const { frontmatter, body, bodyStartIndex } = this.extractFrontmatter(content);
    const codeRanges = this.getCodeBlockRanges(body);
    const title = this.extractTitle(body);
    const frontmatterPosition =
      bodyStartIndex > 0 ? rangeToPos(content, 0, bodyStartIndex) : undefined;
    const tags = this.extractTags(
      frontmatter,
      body,
      codeRanges,
      content,
      bodyStartIndex,
      frontmatterPosition
    );
    const links = this.extractLinks(
      frontmatter,
      body,
      content,
      bodyStartIndex,
      frontmatterPosition
    );
    const headings = this.extractHeadings(body, codeRanges, content, bodyStartIndex);
    const headingStructure = this.buildHeadingStructure(headings);
    const bodyBlockRefs = this.extractBlockRefs(body, codeRanges, content, bodyStartIndex);
    const embeds = this.extractEmbeds(body, codeRanges, content, bodyStartIndex);
    const blockRefs = this.mergeBlockRefsFromLinks(bodyBlockRefs, links, embeds);
    const listItems = this.extractListItems(body, codeRanges, content, bodyStartIndex);
    const footnotes = this.extractFootnoteDefinitions(body, codeRanges, content, bodyStartIndex);
    const footnoteRefs = this.extractFootnoteRefs(body, codeRanges, content, bodyStartIndex);

    return {
      title,
      content: body,
      frontmatter,
      frontmatterPosition,
      tags,
      links,
      headings,
      headingStructure,
      blockRefs,
      embeds,
      listItems,
      footnotes,
      footnoteRefs
    };
  }

  /** Extract block ID from link/embed target like "path#^block-id" or "path#heading#^block-id". */
  private static parseBlockIdFromTarget(target: string): string | null {
    const m = target.match(/#\^([a-zA-Z0-9_-]+)$/);
    return m ? m[1] : null;
  }

  private static mergeBlockRefsFromLinks(
    bodyBlockRefs: BlockRef[],
    links: LinkRef[],
    embeds: EmbedRef[]
  ): BlockRef[] {
    const result = [...bodyBlockRefs];
    const seen = new Set(bodyBlockRefs.map(b => b.blockId));
    for (const link of links) {
      const blockId = this.parseBlockIdFromTarget(link.target);
      if (blockId && !seen.has(blockId)) {
        seen.add(blockId);
        result.push({
          blockId,
          line: link.line,
          column: link.column,
          position: link.position
        });
      }
    }
    for (const embed of embeds) {
      const blockId = this.parseBlockIdFromTarget(embed.target);
      if (blockId && !seen.has(blockId)) {
        seen.add(blockId);
        result.push({
          blockId,
          line: embed.line,
          column: embed.column,
          position: embed.position
        });
      }
    }
    return result;
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

  private static extractFrontmatter(
    content: string
  ): { frontmatter: Record<string, unknown>; body: string; bodyStartIndex: number } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const frontmatter = yaml.parse(match[1]) || {};
        const body = content.slice(match[0].length);
        return { frontmatter, body, bodyStartIndex: match[0].length };
      } catch {
        // Invalid YAML, treat as no frontmatter
      }
    }

    return { frontmatter: {}, body: content, bodyStartIndex: 0 };
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
    codeRanges: Array<[number, number]>,
    content: string,
    bodyStartIndex: number,
    frontmatterPosition?: Pos
  ): TagRef[] {
    const seen = new Set<string>();
    const result: TagRef[] = [];
    const fmLine = { line: 1, column: 1 };
    const fmPosition = frontmatterPosition ?? rangeToPos(content, 0, Math.min(1, content.length));

    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        for (const tag of frontmatter.tags) {
          const name = String(tag).replace(/^#/, '');
          if (name && !seen.has(name)) {
            seen.add(name);
            result.push({ name, ...fmLine, position: fmPosition });
          }
        }
      } else if (typeof frontmatter.tags === 'string') {
        for (const tag of frontmatter.tags.split(/[,\s]+/)) {
          const name = tag.replace(/^#/, '');
          if (name && !seen.has(name)) {
            seen.add(name);
            result.push({ name, ...fmLine, position: fmPosition });
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
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({ name, line: pos.line, column: pos.column, position });
    }

    return result;
  }

  private static extractLinks(
    frontmatter: Record<string, unknown>,
    body: string,
    content: string,
    bodyStartIndex: number,
    frontmatterPosition?: Pos
  ): LinkRef[] {
    const result: LinkRef[] = [];
    const seen = new Set<string>();
    const fmPos = { line: 1, column: 1 };
    const fmPosition =
      frontmatterPosition ?? rangeToPos(content, 0, Math.min(1, content.length));

    this.extractLinksFromObject(frontmatter, (target) => {
      if (!seen.has(target)) {
        seen.add(target);
        result.push({ target, ...fmPos, position: fmPosition });
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
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({ target, line: pos.line, column: pos.column, position });
    }

    return result;
  }

  private static extractEmbeds(
    body: string,
    codeRanges: Array<[number, number]>,
    content: string,
    bodyStartIndex: number
  ): EmbedRef[] {
    const result: EmbedRef[] = [];
    const seen = new Set<string>();
    // Obsidian embeds: ![[path]] or ![[path|display]]; skip inside code blocks
    const embedRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = embedRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const target = match[1].trim();
      if (seen.has(target)) continue;
      seen.add(target);
      const pos = this.indexToPosition(body, match.index);
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({ target, line: pos.line, column: pos.column, position });
    }
    return result;
  }

  private static extractListItems(
    body: string,
    codeRanges: Array<[number, number]>,
    content: string,
    bodyStartIndex: number
  ): ListItemRef[] {
    const result: ListItemRef[] = [];
    // Match list items: unordered (-, *, +) or ordered (1., 2., etc.)
    // Also match task items: - [ ] or - [x] or - [X]
    // Pattern: (indentation)(marker)(optional task checkbox)(content)
    const listItemRegex = /^(\s*)([-*+]|\d+\.)\s+(\[([ xX])\])?\s*(.+)$/gm;
    let match;
    while ((match = listItemRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const indent = match[1];
      const level = Math.floor(indent.length / 2); // Typically 2 spaces per level
      const taskCheckbox = match[3]; // '[x]', '[X]', '[ ]', or undefined
      const taskChar = match[4]; // 'x', 'X', ' ', or undefined
      // task is 'x' for checked tasks, undefined for unchecked/non-task items
      const task = taskCheckbox && (taskChar === 'x' || taskChar === 'X') ? 'x' : undefined;
      const pos = this.indexToPosition(body, match.index);
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({
        level,
        task,
        line: pos.line,
        column: pos.column,
        position
      });
    }
    return result;
  }

  private static extractFootnoteDefinitions(
    body: string,
    codeRanges: Array<[number, number]>,
    content: string,
    bodyStartIndex: number
  ): FootnoteDef[] {
    const result: FootnoteDef[] = [];
    const definitionRegex = /^(\s*)\[\^([^\]]+)\]:\s*(.*)$/gm;
    let match;
    while ((match = definitionRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const id = match[2].trim();
      const contentText = (match[3] ?? '').trim();
      const pos = this.indexToPosition(body, match.index);
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({ id, content: contentText, line: pos.line, column: pos.column, position });
    }
    return result;
  }

  private static extractFootnoteRefs(
    body: string,
    codeRanges: Array<[number, number]>,
    content: string,
    bodyStartIndex: number
  ): FootnoteRef[] {
    const result: FootnoteRef[] = [];
    const refRegex = /\[\^([^\]]+)\]/g;
    let match;
    while ((match = refRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const after = body[match.index + match[0].length];
      if (after === ':') continue;
      const id = match[1].trim();
      const pos = this.indexToPosition(body, match.index);
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({ id, line: pos.line, column: pos.column, position });
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
    codeRanges: Array<[number, number]>,
    content: string,
    bodyStartIndex: number
  ): HeadingRef[] {
    const result: HeadingRef[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(body)) !== null) {
      if (this.isInCodeBlock(match.index, codeRanges)) continue;
      const level = match[1].length;
      const text = match[2].trim();
      const pos = this.indexToPosition(body, match.index);
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({ level, text, line: pos.line, column: pos.column, position });
    }
    return result;
  }

  private static buildHeadingStructure(headings: HeadingRef[]): HeadingStructure[] {
    const root: HeadingStructure[] = [];
    const stack: HeadingStructure[] = [];

    for (const heading of headings) {
      const node: HeadingStructure = {
        level: heading.level,
        text: heading.text,
        line: heading.line,
        column: heading.column,
        position: heading.position,
        children: []
      };

      // Find the appropriate parent: the most recent heading with a lower level
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        // No parent found, add to root
        root.push(node);
      } else {
        // Add as child of the most recent parent
        stack[stack.length - 1].children.push(node);
      }

      // Push current node onto stack for potential children
      stack.push(node);
    }

    return root;
  }

  private static extractBlockRefs(
    body: string,
    codeRanges: Array<[number, number]>,
    content: string,
    bodyStartIndex: number
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
      const position = rangeToPos(
        content,
        bodyStartIndex + match.index,
        bodyStartIndex + match.index + match[0].length
      );
      result.push({ blockId, line: pos.line, column: pos.column, position });
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

  /**
   * Convert HeadingRef[] to HeadingCache[] for ContentMetadata.
   * Maps `text` property to `heading` property.
   */
  static headingsToCache(headings: HeadingRef[]): HeadingCache[] {
    return headings.map(h => ({
      heading: h.text,
      level: h.level,
      position: h.position
    }));
  }

	/**
	 * Convert ListItemRef[] to ListItemCache[] for ContentMetadata.
	 * Preserves task status and position information.
	 */
	static listItemsToCache(listItems: ListItemRef[]): ListItemCache[] {
		return listItems.map(li => ({
			task: li.task,
			position: li.position
		}));
	}

	/**
	 * Convert ParsedNote to ContentMetadata (Obsidian CachedMetadata format).
	 * Separates content-derived metadata from file system information.
	 */
	static parsedToContentMetadata(parsed: ParsedNote, originalContent?: string): ContentMetadata {
		const metadata: ContentMetadata = {};

		// Convert links
		if (parsed.links.length > 0) {
			metadata.links = parsed.links.map((link): LinkCache => {
				// Try to extract display text from original content if available
				let displayText: string | undefined;
				let original = `[[${link.target}]]`;
				if (originalContent) {
					const startOffset = link.position.start.offset;
					const endOffset = link.position.end.offset;
					const linkText = originalContent.slice(startOffset, endOffset);
					const match = linkText.match(/\[\[([^\]]+)\]\]/);
					if (match) {
						original = match[0];
						const parts = match[1].split('|');
						if (parts.length > 1) {
							displayText = parts.slice(1).join('|');
						}
					}
				}
				return {
					link: link.target,
					original,
					displayText,
					position: link.position
				};
			});
		}

		// Convert embeds
		if (parsed.embeds.length > 0) {
			metadata.embeds = parsed.embeds.map((embed): EmbedCache => {
				// Try to extract display text from original content if available
				let displayText: string | undefined;
				let original = `![[${embed.target}]]`;
				if (originalContent) {
					const startOffset = embed.position.start.offset;
					const endOffset = embed.position.end.offset;
					const embedText = originalContent.slice(startOffset, endOffset);
					const match = embedText.match(/!\[\[([^\]]+)\]\]/);
					if (match) {
						original = match[0];
						const parts = match[1].split('|');
						if (parts.length > 1) {
							displayText = parts.slice(1).join('|');
						}
					}
				}
				return {
					link: embed.target,
					original,
					displayText,
					position: embed.position
				};
			});
		}

		// Convert tags
		if (parsed.tags.length > 0) {
			metadata.tags = parsed.tags.map(
				(tag): TagCache => ({
					tag: tag.name,
					position: tag.position
				})
			);
		}

		// Convert headings
		if (parsed.headings.length > 0) {
			metadata.headings = this.headingsToCache(parsed.headings);
		}

		// Convert blocks
		if (parsed.blockRefs.length > 0) {
			metadata.blocks = parsed.blockRefs.map(
				(block): BlockCache => ({
					id: block.blockId,
					position: block.position
				})
			);
		}

		// Convert frontmatter position
		if (parsed.frontmatterPosition) {
			metadata.frontmatter = {
				position: parsed.frontmatterPosition
			};
		}

		// Convert list items
		if (parsed.listItems.length > 0) {
			metadata.listItems = this.listItemsToCache(parsed.listItems);
		}

		// Convert footnotes (definitions)
		if (parsed.footnotes.length > 0) {
			metadata.footnotes = parsed.footnotes.map(
				(fn): FootnoteCache => ({
					id: fn.id,
					content: fn.content,
					position: fn.position
				})
			);
		}

		// Convert footnote refs
		if (parsed.footnoteRefs.length > 0) {
			metadata.footnoteRefs = parsed.footnoteRefs.map(
				(ref): FootnoteRefCache => ({
					id: ref.id,
					position: ref.position
				})
			);
		}

		return metadata;
	}
}