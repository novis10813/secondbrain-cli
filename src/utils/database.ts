import type { Note, Config, GraphData } from '../types/index.js';
import { Database } from 'bun:sqlite';

export class DatabaseManager {
  private db: Database;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.db = new Database(config.dbPath);
    this.initTables();
  }

  private initTables(): void {
    // Notes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        frontmatter TEXT NOT NULL,
        tags TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      )
    `);

    // Links table (many-to-many)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS links (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        PRIMARY KEY (source_id, target_id),
        FOREIGN KEY (source_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES notes(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);
      CREATE INDEX IF NOT EXISTS idx_notes_hash ON notes(hash);
      CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);
      CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
    `);
  }

  close(): void {
    this.db.close();
  }

  // Note operations
  upsertNote(note: Note): void {
    const stmt = this.db.prepare(`
      INSERT INTO notes (id, path, title, content, frontmatter, tags, hash, created_at, modified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        path = excluded.path,
        title = excluded.title,
        content = excluded.content,
        frontmatter = excluded.frontmatter,
        tags = excluded.tags,
        hash = excluded.hash,
        modified_at = excluded.modified_at
    `);

    stmt.run(
      note.id,
      note.path,
      note.title,
      note.content,
      JSON.stringify(note.frontmatter),
      JSON.stringify(note.tags),
      note.hash,
      note.createdAt,
      note.modifiedAt
    );

    // Update links
    this.updateLinks(note.id, note.links);
  }

  private updateLinks(noteId: string, targetIds: string[]): void {
    // Delete existing links
    this.db.prepare('DELETE FROM links WHERE source_id = ?').run(noteId);

    // Insert new links
    const insertStmt = this.db.prepare('INSERT OR IGNORE INTO links (source_id, target_id) VALUES (?, ?)');
    for (const targetId of targetIds) {
      // Only insert if target exists
      const targetExists = this.db.prepare('SELECT 1 FROM notes WHERE id = ?').get(targetId);
      if (targetExists) {
        insertStmt.run(noteId, targetId);
      }
    }
  }

  getNoteById(id: string): Note | null {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!row) return null;
    return this.rowToNote(row);
  }

  getNoteByPath(path: string): Note | null {
    const row = this.db.prepare('SELECT * FROM notes WHERE path = ?').get(path);
    if (!row) return null;
    return this.rowToNote(row);
  }

  searchNotes(query: string, tags?: string[], limit: number = 20): Note[] {
    let sql = 'SELECT * FROM notes WHERE (title LIKE ? OR content LIKE ?)';
    const params: (string | number)[] = [`%${query}%`, `%${query}%`];

    if (tags && tags.length > 0) {
      sql += ' AND (' + tags.map(() => 'tags LIKE ?').join(' OR ') + ')';
      params.push(...tags.map(tag => `%"${tag}"%`));
    }

    sql += ' ORDER BY modified_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row: any) => this.rowToNote(row));
  }

  getBacklinks(noteId: string): Note[] {
    const sql = `
      SELECT n.* FROM notes n
      JOIN links l ON n.id = l.source_id
      WHERE l.target_id = ?
    `;
    const rows = this.db.prepare(sql).all(noteId);
    return rows.map((row: any) => this.rowToNote(row));
  }

  getOrphans(): Note[] {
    const sql = `
      SELECT n.* FROM notes n
      LEFT JOIN links l1 ON n.id = l1.source_id
      LEFT JOIN links l2 ON n.id = l2.target_id
      WHERE l1.source_id IS NULL AND l2.target_id IS NULL
    `;
    const rows = this.db.prepare(sql).all();
    return rows.map((row: any) => this.rowToNote(row));
  }

  getAllNotes(): Note[] {
    const rows = this.db.prepare('SELECT * FROM notes').all();
    return rows.map((row: any) => this.rowToNote(row));
  }

  deleteNoteByPath(path: string): void {
    this.db.prepare('DELETE FROM notes WHERE path = ?').run(path);
  }

  getStats(): { totalNotes: number; totalLinks: number; orphans: number } {
    const totalNotes = this.db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
    const totalLinks = this.db.prepare('SELECT COUNT(*) as count FROM links').get().count;
    const orphans = this.db.prepare('SELECT COUNT(*) as count FROM notes n LEFT JOIN links l1 ON n.id = l1.source_id LEFT JOIN links l2 ON n.id = l2.target_id WHERE l1.source_id IS NULL AND l2.target_id IS NULL').get().count;
    
    return { totalNotes, totalLinks, orphans };
  }

  getGraphData(): GraphData {
    const nodes = this.db.prepare('SELECT id, title, path, tags FROM notes').all();
    const edges = this.db.prepare('SELECT source_id, target_id FROM links').all();

    return {
      nodes: nodes.map((n: any) => ({
        id: n.id,
        title: n.title,
        path: n.path,
        tags: JSON.parse(n.tags)
      })),
      edges: edges.map((e: any) => ({
        source: e.source_id,
        target: e.target_id
      }))
    };
  }

  private rowToNote(row: any): Note {
    const links = this.db.prepare('SELECT target_id FROM links WHERE source_id = ?').all(row.id);
    const backlinks = this.db.prepare('SELECT source_id FROM links WHERE target_id = ?').all(row.id);

    return {
      id: row.id,
      path: row.path,
      title: row.title,
      content: row.content,
      frontmatter: JSON.parse(row.frontmatter),
      tags: JSON.parse(row.tags),
      links: links.map((l: any) => l.target_id),
      backlinks: backlinks.map((l: any) => l.source_id),
      hash: row.hash,
      createdAt: row.created_at,
      modifiedAt: row.modified_at
    };
  }
}
