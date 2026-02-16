import { basename, extname } from 'path';
import type { Note, Config, GraphData, FileInfo, ContentMetadata } from '../types/index.js';
import { Database } from 'bun:sqlite';

export class DatabaseManager {
  private db: Database;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.db = new Database(config.dbPath);
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON');
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
        block_refs TEXT NOT NULL DEFAULT '[]',
        embeds TEXT NOT NULL DEFAULT '[]',
        headings TEXT NOT NULL DEFAULT '[]',
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      )
    `);

    // Migration: add block_refs to existing tables
    try {
      this.db.exec(`ALTER TABLE notes ADD COLUMN block_refs TEXT NOT NULL DEFAULT '[]'`);
    } catch {
      // Column already exists
    }

    // Migration: add embeds to existing tables
    try {
      this.db.exec(`ALTER TABLE notes ADD COLUMN embeds TEXT NOT NULL DEFAULT '[]'`);
    } catch {
      // Column already exists
    }

    // Migration: add headings to existing tables
    try {
      this.db.exec(`ALTER TABLE notes ADD COLUMN headings TEXT NOT NULL DEFAULT '[]'`);
    } catch {
      // Column already exists
    }

    // TFile-aligned columns (parent, basename, ctime, mtime, size)
    for (const col of [
      'parent TEXT',
      'basename TEXT',
      'ctime INTEGER',
      'mtime INTEGER',
      'size INTEGER'
    ]) {
      try {
        this.db.exec(`ALTER TABLE notes ADD COLUMN ${col}`);
      } catch {
        // Column already exists
      }
    }

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

    // New Obsidian-aligned tables
    this.initObsidianTables();
  }

  private initObsidianTables(): void {
    // Files table (FileInfo/TFile equivalent)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        basename TEXT NOT NULL,
        extension TEXT NOT NULL,
        parent TEXT,
        ctime INTEGER NOT NULL,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        content_hash TEXT NOT NULL
      )
    `);

    // Content metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_metadata (
        file_path TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        frontmatter_start_line INTEGER,
        frontmatter_start_col INTEGER,
        frontmatter_start_offset INTEGER,
        frontmatter_end_line INTEGER,
        frontmatter_end_col INTEGER,
        frontmatter_end_offset INTEGER,
        FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
      )
    `);

    // Links table with positions (new structure)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS links_with_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_path TEXT NOT NULL,
        target_path TEXT,
        target_id TEXT,
        original TEXT NOT NULL,
        display_text TEXT,
        start_line INTEGER NOT NULL,
        start_col INTEGER NOT NULL,
        start_offset INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        end_col INTEGER NOT NULL,
        end_offset INTEGER NOT NULL,
        FOREIGN KEY (source_path) REFERENCES files(path) ON DELETE CASCADE
      )
    `);

    // Tags table with positions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags_with_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        tag TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        start_col INTEGER NOT NULL,
        start_offset INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        end_col INTEGER NOT NULL,
        end_offset INTEGER NOT NULL,
        FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
      )
    `);

    // Headings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS headings_with_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        heading TEXT NOT NULL,
        level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 6),
        start_line INTEGER NOT NULL,
        start_col INTEGER NOT NULL,
        start_offset INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        end_col INTEGER NOT NULL,
        end_offset INTEGER NOT NULL,
        FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
      )
    `);

    // Blocks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blocks_with_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        block_id TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        start_col INTEGER NOT NULL,
        start_offset INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        end_col INTEGER NOT NULL,
        end_offset INTEGER NOT NULL,
        FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE,
        UNIQUE(file_path, block_id)
      )
    `);

    // Embeds table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embeds_with_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        original TEXT NOT NULL,
        display_text TEXT,
        start_line INTEGER NOT NULL,
        start_col INTEGER NOT NULL,
        start_offset INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        end_col INTEGER NOT NULL,
        end_offset INTEGER NOT NULL,
        FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
      )
    `);

    // Create indexes for new tables
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
      CREATE INDEX IF NOT EXISTS idx_links_pos_source ON links_with_positions(source_path);
      CREATE INDEX IF NOT EXISTS idx_links_pos_target ON links_with_positions(target_path);
      CREATE INDEX IF NOT EXISTS idx_tags_pos_file ON tags_with_positions(file_path);
      CREATE INDEX IF NOT EXISTS idx_tags_pos_tag ON tags_with_positions(tag);
      CREATE INDEX IF NOT EXISTS idx_headings_pos_file ON headings_with_positions(file_path);
      CREATE INDEX IF NOT EXISTS idx_blocks_pos_file ON blocks_with_positions(file_path);
      CREATE INDEX IF NOT EXISTS idx_embeds_pos_file ON embeds_with_positions(file_path);
    `);
  }

  close(): void {
    this.db.close();
  }

  // FileInfo operations
  upsertFile(file: FileInfo, contentHash: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, name, basename, extension, parent, ctime, mtime, size, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        basename = excluded.basename,
        extension = excluded.extension,
        parent = excluded.parent,
        ctime = excluded.ctime,
        mtime = excluded.mtime,
        size = excluded.size,
        content_hash = excluded.content_hash
    `);

    stmt.run(
      file.path,
      file.name,
      file.basename,
      file.extension,
      file.parent,
      file.stat.ctime,
      file.stat.mtime,
      file.stat.size,
      contentHash
    );
  }

  getFileByPath(path: string): FileInfo | null {
    const row = this.db.prepare('SELECT * FROM files WHERE path = ?').get(path) as any;
    if (!row) return null;

    return {
      path: row.path,
      name: row.name,
      basename: row.basename,
      extension: row.extension,
      parent: row.parent,
      stat: {
        ctime: row.ctime,
        mtime: row.mtime,
        size: row.size
      }
    };
  }

  deleteFile(path: string): void {
    this.db.prepare('DELETE FROM files WHERE path = ?').run(path);
  }

  // ContentMetadata operations
  upsertContentMetadata(filePath: string, metadata: ContentMetadata, contentHash: string): void {
    // Prepare statements outside transaction
    const metadataStmt = this.db.prepare(`
      INSERT INTO content_metadata (
        file_path, content_hash,
        frontmatter_start_line, frontmatter_start_col, frontmatter_start_offset,
        frontmatter_end_line, frontmatter_end_col, frontmatter_end_offset
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        content_hash = excluded.content_hash,
        frontmatter_start_line = excluded.frontmatter_start_line,
        frontmatter_start_col = excluded.frontmatter_start_col,
        frontmatter_start_offset = excluded.frontmatter_start_offset,
        frontmatter_end_line = excluded.frontmatter_end_line,
        frontmatter_end_col = excluded.frontmatter_end_col,
        frontmatter_end_offset = excluded.frontmatter_end_offset
    `);

    const deleteLinksStmt = this.db.prepare('DELETE FROM links_with_positions WHERE source_path = ?');
    const deleteTagsStmt = this.db.prepare('DELETE FROM tags_with_positions WHERE file_path = ?');
    const deleteHeadingsStmt = this.db.prepare('DELETE FROM headings_with_positions WHERE file_path = ?');
    const deleteBlocksStmt = this.db.prepare('DELETE FROM blocks_with_positions WHERE file_path = ?');
    const deleteEmbedsStmt = this.db.prepare('DELETE FROM embeds_with_positions WHERE file_path = ?');

    // Use transaction for atomicity
    const transaction = this.db.transaction(() => {
      const frontmatter = metadata.frontmatter;
      metadataStmt.run(
        filePath,
        contentHash,
        frontmatter?.position.start.line ?? null,
        frontmatter?.position.start.col ?? null,
        frontmatter?.position.start.offset ?? null,
        frontmatter?.position.end.line ?? null,
        frontmatter?.position.end.col ?? null,
        frontmatter?.position.end.offset ?? null
      );

      // Delete existing metadata items
      deleteLinksStmt.run(filePath);
      deleteTagsStmt.run(filePath);
      deleteHeadingsStmt.run(filePath);
      deleteBlocksStmt.run(filePath);
      deleteEmbedsStmt.run(filePath);

      // Prepare INSERT statements inside transaction
      const linkStmt = this.db.prepare(`
        INSERT INTO links_with_positions (
          source_path, target_path, target_id, original, display_text,
          start_line, start_col, start_offset,
          end_line, end_col, end_offset
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const tagStmt = this.db.prepare(`
        INSERT INTO tags_with_positions (
          file_path, tag,
          start_line, start_col, start_offset,
          end_line, end_col, end_offset
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const headingStmt = this.db.prepare(`
        INSERT INTO headings_with_positions (
          file_path, heading, level,
          start_line, start_col, start_offset,
          end_line, end_col, end_offset
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const blockStmt = this.db.prepare(`
        INSERT INTO blocks_with_positions (
          file_path, block_id,
          start_line, start_col, start_offset,
          end_line, end_col, end_offset
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const embedStmt = this.db.prepare(`
        INSERT INTO embeds_with_positions (
          file_path, target_path, original, display_text,
          start_line, start_col, start_offset,
          end_line, end_col, end_offset
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Insert links
      if (metadata.links && metadata.links.length > 0) {
        for (const link of metadata.links) {
          linkStmt.run(
            filePath,
            link.link,
            null, // target_id will be resolved later
            link.original,
            link.displayText ?? null,
            link.position.start.line,
            link.position.start.col,
            link.position.start.offset,
            link.position.end.line,
            link.position.end.col,
            link.position.end.offset
          );
        }
      }

      // Insert tags
      if (metadata.tags && metadata.tags.length > 0) {
        for (const tag of metadata.tags) {
          tagStmt.run(
            filePath,
            tag.tag,
            tag.position.start.line,
            tag.position.start.col,
            tag.position.start.offset,
            tag.position.end.line,
            tag.position.end.col,
            tag.position.end.offset
          );
        }
      }

      // Insert headings
      if (metadata.headings && metadata.headings.length > 0) {
        for (const heading of metadata.headings) {
          headingStmt.run(
            filePath,
            heading.heading,
            heading.level,
            heading.position.start.line,
            heading.position.start.col,
            heading.position.start.offset,
            heading.position.end.line,
            heading.position.end.col,
            heading.position.end.offset
          );
        }
      }

      // Insert blocks
      if (metadata.blocks && metadata.blocks.length > 0) {
        for (const block of metadata.blocks) {
          blockStmt.run(
            filePath,
            block.id,
            block.position.start.line,
            block.position.start.col,
            block.position.start.offset,
            block.position.end.line,
            block.position.end.col,
            block.position.end.offset
          );
        }
      }

      // Insert embeds
      if (metadata.embeds && metadata.embeds.length > 0) {
        for (const embed of metadata.embeds) {
          embedStmt.run(
            filePath,
            embed.link,
            embed.original,
            embed.displayText ?? null,
            embed.position.start.line,
            embed.position.start.col,
            embed.position.start.offset,
            embed.position.end.line,
            embed.position.end.col,
            embed.position.end.offset
          );
        }
      }
    });

    transaction();
  }

  getContentMetadata(filePath: string): ContentMetadata | null {
    const metadataRow = this.db.prepare('SELECT * FROM content_metadata WHERE file_path = ?').get(filePath) as any;
    if (!metadataRow) return null;

    const result: ContentMetadata = {};

    // Frontmatter
    if (
      metadataRow.frontmatter_start_line != null &&
      metadataRow.frontmatter_start_offset != null &&
      metadataRow.frontmatter_end_offset != null
    ) {
      result.frontmatter = {
        position: {
          start: {
            line: metadataRow.frontmatter_start_line,
            col: metadataRow.frontmatter_start_col,
            offset: metadataRow.frontmatter_start_offset
          },
          end: {
            line: metadataRow.frontmatter_end_line,
            col: metadataRow.frontmatter_end_col,
            offset: metadataRow.frontmatter_end_offset
          }
        }
      };
    }

    // Links
    const linkRows = this.db.prepare('SELECT * FROM links_with_positions WHERE source_path = ?').all(filePath) as any[];
    if (linkRows.length > 0) {
      result.links = linkRows.map(row => ({
        link: row.target_path || row.target_id || '',
        original: row.original,
        displayText: row.display_text ?? undefined,
        position: {
          start: {
            line: row.start_line,
            col: row.start_col,
            offset: row.start_offset
          },
          end: {
            line: row.end_line,
            col: row.end_col,
            offset: row.end_offset
          }
        }
      }));
    }

    // Tags
    const tagRows = this.db.prepare('SELECT * FROM tags_with_positions WHERE file_path = ?').all(filePath) as any[];
    if (tagRows.length > 0) {
      result.tags = tagRows.map(row => ({
        tag: row.tag,
        position: {
          start: {
            line: row.start_line,
            col: row.start_col,
            offset: row.start_offset
          },
          end: {
            line: row.end_line,
            col: row.end_col,
            offset: row.end_offset
          }
        }
      }));
    }

    // Headings
    const headingRows = this.db.prepare('SELECT * FROM headings_with_positions WHERE file_path = ?').all(filePath) as any[];
    if (headingRows.length > 0) {
      result.headings = headingRows.map(row => ({
        heading: row.heading,
        level: row.level,
        position: {
          start: {
            line: row.start_line,
            col: row.start_col,
            offset: row.start_offset
          },
          end: {
            line: row.end_line,
            col: row.end_col,
            offset: row.end_offset
          }
        }
      }));
    }

    // Blocks
    const blockRows = this.db.prepare('SELECT * FROM blocks_with_positions WHERE file_path = ?').all(filePath) as any[];
    if (blockRows.length > 0) {
      result.blocks = blockRows.map(row => ({
        id: row.block_id,
        position: {
          start: {
            line: row.start_line,
            col: row.start_col,
            offset: row.start_offset
          },
          end: {
            line: row.end_line,
            col: row.end_col,
            offset: row.end_offset
          }
        }
      }));
    }

    // Embeds
    const embedRows = this.db.prepare('SELECT * FROM embeds_with_positions WHERE file_path = ?').all(filePath) as any[];
    if (embedRows.length > 0) {
      result.embeds = embedRows.map(row => ({
        link: row.target_path,
        original: row.original,
        displayText: row.display_text ?? undefined,
        position: {
          start: {
            line: row.start_line,
            col: row.start_col,
            offset: row.start_offset
          },
          end: {
            line: row.end_line,
            col: row.end_col,
            offset: row.end_offset
          }
        }
      }));
    }

    return result;
  }

  // Batch operations
  upsertFilesBatch(files: Array<{ file: FileInfo; contentHash: string }>): void {
    if (files.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO files (path, name, basename, extension, parent, ctime, mtime, size, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        basename = excluded.basename,
        extension = excluded.extension,
        parent = excluded.parent,
        ctime = excluded.ctime,
        mtime = excluded.mtime,
        size = excluded.size,
        content_hash = excluded.content_hash
    `);

    const transaction = this.db.transaction(() => {
      for (const { file, contentHash } of files) {
        stmt.run(
          file.path,
          file.name,
          file.basename,
          file.extension,
          file.parent,
          file.stat.ctime,
          file.stat.mtime,
          file.stat.size,
          contentHash
        );
      }
    });

    transaction();
  }

  upsertContentMetadataBatch(items: Array<{ filePath: string; metadata: ContentMetadata; contentHash: string }>): void {
    if (items.length === 0) return;

    // Note: upsertContentMetadata already uses a transaction internally,
    // so we don't need to wrap it again
    for (const { filePath, metadata, contentHash } of items) {
      this.upsertContentMetadata(filePath, metadata, contentHash);
    }
  }

  // Note operations
  upsertNote(note: Note): void {
    const stmt = this.db.prepare(`
      INSERT INTO notes (id, path, title, content, frontmatter, tags, block_refs, embeds, headings, hash, created_at, modified_at, parent, basename, ctime, mtime, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        id = excluded.id,
        title = excluded.title,
        content = excluded.content,
        frontmatter = excluded.frontmatter,
        tags = excluded.tags,
        block_refs = excluded.block_refs,
        embeds = excluded.embeds,
        headings = excluded.headings,
        hash = excluded.hash,
        modified_at = excluded.modified_at,
        parent = excluded.parent,
        basename = excluded.basename,
        ctime = excluded.ctime,
        mtime = excluded.mtime,
        size = excluded.size
    `);

    const ctime = note.stat?.ctime ?? null;
    const mtime = note.stat?.mtime ?? null;
    const size = note.stat?.size ?? null;

    stmt.run(
      note.id,
      note.path,
      note.title,
      note.content,
      JSON.stringify(note.frontmatter),
      JSON.stringify(note.tags),
      JSON.stringify(note.blockRefs),
      JSON.stringify(note.embeds),
      JSON.stringify(note.headings),
      note.hash,
      note.createdAt,
      note.modifiedAt,
      note.parent ?? null,
      note.basename ?? null,
      ctime,
      mtime,
      size
    );

    // Update links
    this.updateLinks(note.id, note.links);
  }

  private updateLinks(noteId: string, targetIds: string[]): void {
    // Get existing links
    const existingLinks = this.db.prepare('SELECT target_id FROM links WHERE source_id = ?')
      .all(noteId)
      .map((row: any) => row.target_id);
    
    // Calculate diff
    const existingSet = new Set(existingLinks);
    const newSet = new Set(targetIds);
    
    // Links to add (in newSet but not in existingSet)
    const toAdd = targetIds.filter(id => !existingSet.has(id));
    
    // Links to remove (in existingSet but not in newSet)
    const toRemove = existingLinks.filter(id => !newSet.has(id));
    
    // Skip if no changes
    if (toAdd.length === 0 && toRemove.length === 0) {
      return;
    }
    
    // Remove links that no longer exist
    if (toRemove.length > 0) {
      const placeholders = toRemove.map(() => '?').join(',');
      this.db.prepare(`DELETE FROM links WHERE source_id = ? AND target_id IN (${placeholders})`)
        .run(noteId, ...toRemove);
    }
    
    // Add new links (only if target exists)
    if (toAdd.length > 0) {
      const insertStmt = this.db.prepare('INSERT OR IGNORE INTO links (source_id, target_id) VALUES (?, ?)');
      const targetExistsStmt = this.db.prepare('SELECT 1 FROM notes WHERE id = ?');
      
      for (const targetId of toAdd) {
        // Only insert if target exists
        const targetExists = targetExistsStmt.get(targetId);
        if (targetExists) {
          insertStmt.run(noteId, targetId);
        }
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

  getNoteByTitle(title: string): Note | null {
    const row = this.db.prepare('SELECT * FROM notes WHERE title = ? COLLATE NOCASE').get(title);
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
    return this.rowsToNotes(rows as any[]);
  }

  getBacklinks(noteId: string): Note[] {
    const sql = `
      SELECT n.* FROM notes n
      JOIN links l ON n.id = l.source_id
      WHERE l.target_id = ?
    `;
    const rows = this.db.prepare(sql).all(noteId);
    return this.rowsToNotes(rows as any[]);
  }

  getOrphans(): Note[] {
    const sql = `
      SELECT n.* FROM notes n
      LEFT JOIN links l1 ON n.id = l1.source_id
      LEFT JOIN links l2 ON n.id = l2.target_id
      WHERE l1.source_id IS NULL AND l2.target_id IS NULL
    `;
    const rows = this.db.prepare(sql).all();
    return this.rowsToNotes(rows as any[]);
  }

  getAllNotes(): Note[] {
    const rows = this.db.prepare('SELECT * FROM notes').all();
    return this.rowsToNotes(rows as any[]);
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
    const ext = extname(row.path) || '.md';
    const name = basename(row.path, ext) || basename(row.path);
    const stat =
      row.ctime != null && row.mtime != null && row.size != null
        ? { ctime: row.ctime, mtime: row.mtime, size: row.size }
        : undefined;

    return {
      id: row.id,
      path: row.path,
      name,
      extension: ext,
      title: row.title,
      content: row.content,
      frontmatter: JSON.parse(row.frontmatter),
      tags: JSON.parse(row.tags),
      links: links.map((l: any) => l.target_id),
      backlinks: backlinks.map((l: any) => l.source_id),
      blockRefs: JSON.parse(row.block_refs ?? '[]'),
      embeds: JSON.parse(row.embeds ?? '[]'),
      headings: JSON.parse(row.headings ?? '[]'),
      hash: row.hash,
      createdAt: row.created_at,
      modifiedAt: row.modified_at,
      parent: row.parent ?? undefined,
      basename: row.basename ?? undefined,
      stat
    };
  }

  private getNotesWithLinksBatch(noteIds: string[]): Map<string, { links: string[], backlinks: string[] }> {
    if (noteIds.length === 0) return new Map();
    
    const placeholders = noteIds.map(() => '?').join(',');
    
    // Single query to get all links for all notes
    const linksSql = `
      SELECT source_id, json_group_array(target_id) as targets
      FROM links
      WHERE source_id IN (${placeholders})
      GROUP BY source_id
    `;
    
    const backlinksSql = `
      SELECT target_id, json_group_array(source_id) as sources
      FROM links
      WHERE target_id IN (${placeholders})
      GROUP BY target_id
    `;
    
    const result = new Map<string, { links: string[], backlinks: string[] }>();
    
    // Initialize with empty arrays
    for (const id of noteIds) {
      result.set(id, { links: [], backlinks: [] });
    }
    
    // Populate links
    const linksRows = this.db.prepare(linksSql).all(...noteIds) as any[];
    for (const row of linksRows) {
      const targets = JSON.parse(row.targets);
      result.get(row.source_id)!.links = targets;
    }
    
    // Populate backlinks
    const backlinksRows = this.db.prepare(backlinksSql).all(...noteIds) as any[];
    for (const row of backlinksRows) {
      const sources = JSON.parse(row.sources);
      result.get(row.target_id)!.backlinks = sources;
    }
    
    return result;
  }

  private rowsToNotes(rows: any[]): Note[] {
    if (rows.length === 0) return [];
    
    // Extract all note IDs
    const noteIds = rows.map(row => row.id);
    
    // Batch load all links and backlinks in 2 queries
    const linkData = this.getNotesWithLinksBatch(noteIds);
    
    // Map rows to notes using batched link data
    return rows.map(row => {
      const links = linkData.get(row.id)?.links || [];
      const backlinks = linkData.get(row.id)?.backlinks || [];
      const ext = extname(row.path) || '.md';
      const name = basename(row.path, ext) || basename(row.path);
      const stat =
        row.ctime != null && row.mtime != null && row.size != null
          ? { ctime: row.ctime, mtime: row.mtime, size: row.size }
          : undefined;

      return {
        id: row.id,
        path: row.path,
        name,
        extension: ext,
        title: row.title,
        content: row.content,
        frontmatter: JSON.parse(row.frontmatter),
        tags: JSON.parse(row.tags),
        links,
        backlinks,
        blockRefs: JSON.parse(row.block_refs ?? '[]'),
        embeds: JSON.parse(row.embeds ?? '[]'),
        headings: JSON.parse(row.headings ?? '[]'),
        hash: row.hash,
        createdAt: row.created_at,
        modifiedAt: row.modified_at,
        parent: row.parent ?? undefined,
        basename: row.basename ?? undefined,
        stat
      };
    });
  }
}
