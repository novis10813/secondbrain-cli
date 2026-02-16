import { createHash } from 'crypto';
import * as yaml from 'yaml';

export interface ParsedNote {
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: string[];
}

export class NoteParser {
  static parse(content: string): ParsedNote {
    const { frontmatter, body } = this.extractFrontmatter(content);
    const title = this.extractTitle(body);
    const tags = this.extractTags(frontmatter, body);
    const links = this.extractLinks(frontmatter, body);

    return {
      title,
      content: body,
      frontmatter,
      tags,
      links
    };
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

  private static extractTags(frontmatter: Record<string, unknown>, content: string): string[] {
    const tags = new Set<string>();

    // From frontmatter
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        frontmatter.tags.forEach(tag => tags.add(String(tag)));
      } else if (typeof frontmatter.tags === 'string') {
        frontmatter.tags.split(/[,\s]+/).forEach(tag => {
          if (tag) tags.add(tag.replace(/^#/, ''));
        });
      }
    }

    // From content body (Obsidian-style #tags)
    // Strip code blocks to avoid extracting tags from code
    const contentWithoutCode = content
      .replace(/```[\s\S]*?```/g, '')  // Remove fenced code blocks
      .replace(/`[^`]*`/g, '');          // Remove inline code
    
    const tagRegex = /#([\w/-]+)/g;
    let match;
    while ((match = tagRegex.exec(contentWithoutCode)) !== null) {
      // Exclude headings
      if (!contentWithoutCode.substring(match.index - 1, match.index).match(/\n|^/)) {
        continue;
      }
      tags.add(match[1]);
    }

    return Array.from(tags);
  }

  private static extractLinks(frontmatter: Record<string, unknown>, content: string): string[] {
    const links = new Set<string>();

    // Extract from frontmatter values
    this.extractLinksFromObject(frontmatter, links);

    // Extract from content body (Obsidian wikilinks)
    const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.add(match[1].trim());
    }

    return Array.from(links);
  }

  private static extractLinksFromObject(obj: unknown, links: Set<string>): void {
    if (typeof obj === 'string') {
      const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
      let match;
      while ((match = linkRegex.exec(obj)) !== null) {
        links.add(match[1].trim());
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => this.extractLinksFromObject(item, links));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(value => this.extractLinksFromObject(value, links));
    }
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