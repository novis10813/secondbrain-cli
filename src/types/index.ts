export interface Note {
  id: string;                    // content hash (sha256)
  path: string;                  // relative path in vault
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: string[];               // note IDs this note links to
  backlinks: string[];           // note IDs that link to this note
  hash: string;                  // content hash
  createdAt: string;
  modifiedAt: string;
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