/** File system info (TFile equivalent): path, name, stat. Source: filesystem only. */
export interface VaultFile {
  path: string;
  name: string;
  extension: string;
  createdAt: string;
  modifiedAt: string;
}

/** Embed with position (Obsidian ![[path]]). */
export interface EmbedRef {
  target: string;
  line: number;
  column: number;
}

/** Content-derived metadata: parsed from file content. Source: parser + hash. */
export interface NoteContent {
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: string[];
  blockRefs: string[];
  embeds: EmbedRef[];
  hash: string;
}

/** Note = VaultFile + NoteContent + id (content hash) + backlinks (computed by DB). */
export interface Note extends VaultFile, NoteContent {
  id: string;
  backlinks: string[];
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