/** File stats (Obsidian FileStats): ctime/mtime in ms, size in bytes. */
export interface FileStats {
  ctime: number;
  mtime: number;
  size: number;
}

/**
 * File system info matching Obsidian's TFile.
 * path = path relative to vault root; name = filename with extension;
 * basename = filename without extension; extension = extension without leading dot.
 */
export interface FileInfo {
  path: string;
  name: string;
  basename: string;
  extension: string;
  parent: string | null;
  stat: FileStats;
}


/** Embed with position (Obsidian ![[path]]). */
export interface EmbedRef {
  target: string;
  line: number;
  column: number;
}

/** Obsidian-aligned position types (CachedMetadata). */

/** Location: line (0-based), column, and character offset from file start. */
export interface Loc {
  line: number;
  col: number;
  offset: number;
}

/** Span: start and end location. */
export interface Pos {
  start: Loc;
  end: Loc;
}

/** Base for cache items that have a position. */
export interface CacheItem {
  position: Pos;
}

/** Base for link-like caches (wikilinks, embeds). */
export interface ReferenceCache extends CacheItem {
  link: string;
  original: string;
  displayText?: string;
}

/** Wikilink [[target]] or [[target|display]]. */
export interface LinkCache extends ReferenceCache {}

/** Embed ![[path]] or ![[path|display]]. */
export interface EmbedCache extends ReferenceCache {}

/** Tag #tag (tag is the name without #). */
export interface TagCache extends CacheItem {
  tag: string;
}

/** Heading H1–H6. */
export interface HeadingCache extends CacheItem {
  heading: string;
  level: number;
}

/** Block for ^block-id references. */
export interface BlockCache extends CacheItem {
  id: string;
}

/** Frontmatter position in file. */
export interface FrontMatterCache {
  position: Pos;
}

/** Footnote definition. */
export interface FootnoteCache extends CacheItem {
  id: string;
  content: string;
}

/** Footnote reference in text. */
export interface FootnoteRefCache extends CacheItem {
  id: string;
}

/** Document section (e.g. frontmatter, content). */
export interface SectionCache extends CacheItem {
  id: string;
  type: string;
}

/** List item with optional task state. */
export interface ListItemCache extends CacheItem {
  task?: string;
}

/**
 * Content-derived metadata matching Obsidian's CachedMetadata.
 * Returned by MetadataCache.getFileCache(file). All fields optional.
 */
export interface ContentMetadata {
  links?: LinkCache[];
  embeds?: EmbedCache[];
  tags?: TagCache[];
  headings?: HeadingCache[];
  footnotes?: FootnoteCache[];
  footnoteRefs?: FootnoteRefCache[];
  blocks?: BlockCache[];
  frontmatter?: FrontMatterCache;
  sections?: SectionCache[];
  listItems?: ListItemCache[];
}

/** Heading with position (H1–H6). */
export interface HeadingRef {
  level: number;
  text: string;
  line: number;
  column: number;
}


export interface SearchResult {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  tags: string[];
  linksCount: number;
  backlinksCount: number;
  score: number;
}

export interface SearchResponse {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  total: number;
}

export interface SearchFilters {
  tags?: string[];
  path?: string;
  limit?: number;
}

export interface Config {
  vaultPath: string;
  dailyNotesFolder: string;
  templatesFolder: string;
  dbPath: string;
}

export interface Template {
  name: string;
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  requiredFields: string[];
}

export interface LintIssue {
  noteId: string;
  type: 'missing-tags' | 'missing-title' | 'missing-frontmatter' | 'broken-link' | 'orphan-note';
  severity: 'error' | 'warning' | 'info';
  message: string;
  path: string;
}

export interface GraphNode {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 單一 Vault 的註冊資訊 */
export interface VaultEntry {
  name: string;
  path: string;
}

/** 全域設定檔結構 (~/.config/secondbrain/vaults.json) */
export interface GlobalConfig {
  vaults: VaultEntry[];
  default?: string;
}