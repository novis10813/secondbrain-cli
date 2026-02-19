import { basename, extname, dirname } from 'path';
import type { Config, GraphData, FileInfo, ContentMetadata } from '../types/index.js';
import { createDatabase, type SqliteDatabase } from './sqlite-adapter.js';
import { NoteParser } from './parser.js';

/** Row shape from SELECT * FROM files */
interface FilesRow {
  path: string;
  name: string;
  basename: string;
  extension: string;
  parent: string | null;
  ctime: number;
  mtime: number;
  size: number;
  content_hash?: string;
}

export class DatabaseManager {
  private db: SqliteDatabase;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.db = createDatabase(config.dbPath);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.initTables();
  }

  private initTables(): void {
    // Drop legacy tables if they exist (breaking change - users need to re-sync)
    this.db.exec(`
      DROP TABLE IF EXISTS links;
      DROP TABLE IF EXISTS notes;
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)
    `);
    const versionRow = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      | { version: number }
      | undefined;
    const currentVersion = versionRow?.version ?? 0;
    if (currentVersion === 0) {
      this.db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(0);
    }

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

    // Sections table (document sections: frontmatter, heading-bounded regions)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sections_with_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        section_id TEXT NOT NULL,
        type TEXT NOT NULL,
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
      CREATE INDEX IF NOT EXISTS idx_sections_pos_file ON sections_with_positions(file_path);
    `);
  }


  close(): void {
    this.db.close();
  }

  private rowToFileInfo(row: FilesRow): FileInfo {
    return {
      path: row.path,
      name: row.name,
      basename: row.basename,
      extension: row.extension,
      parent: row.parent,
      stat: { ctime: row.ctime, mtime: row.mtime, size: row.size }
    };
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
    const row = this.db.prepare('SELECT * FROM files WHERE path = ?').get(path) as FilesRow | undefined;
    return row ? this.rowToFileInfo(row) : null;
  }

  deleteFile(path: string): void {
    this.db.prepare('DELETE FROM files WHERE path = ?').run(path);
  }

  getAllFiles(): FileInfo[] {
    const rows = this.db.prepare('SELECT * FROM files').all() as FilesRow[];
    return rows.map((row) => this.rowToFileInfo(row));
  }

  getFileContentHash(filePath: string): string | null {
    const row = this.db.prepare('SELECT content_hash FROM files WHERE path = ?').get(filePath) as
      | { content_hash: string }
      | undefined;
    return row?.content_hash ?? null;
  }

	/**
	 * Update link target in links_with_positions table.
	 * Finds link by source_path and start_offset, then updates target_path and target_id.
	 */
	updateLinkTarget(sourcePath: string, startOffset: number, targetPath: string | null, targetId: string | null): void {
		const stmt = this.db.prepare(`
			UPDATE links_with_positions
			SET target_path = ?, target_id = ?
			WHERE source_path = ? AND start_offset = ?
		`);
		stmt.run(targetPath, targetId, sourcePath, startOffset);
	}

  /** Get files that link to the given file path (new structure). */
  getBacklinksByPath(filePath: string): FileInfo[] {
    const rows = this.db
      .prepare(
        `
      SELECT f.path, f.name, f.basename, f.extension, f.parent, f.ctime, f.mtime, f.size
      FROM files f
      INNER JOIN (SELECT DISTINCT source_path FROM links_with_positions WHERE target_path = ?) l
        ON f.path = l.source_path
    `
      )
      .all(filePath) as FilesRow[];
    return rows.map((row) => this.rowToFileInfo(row));
  }

  /** Get files that the given file links to (outgoing links, new structure). */
  getOutlinksByPath(filePath: string): FileInfo[] {
    const rows = this.db
      .prepare(
        `
      SELECT f.path, f.name, f.basename, f.extension, f.parent, f.ctime, f.mtime, f.size
      FROM files f
      INNER JOIN (
        SELECT DISTINCT target_path FROM links_with_positions
        WHERE source_path = ? AND target_path IS NOT NULL AND target_path != ''
      ) l ON f.path = l.target_path
    `
      )
      .all(filePath) as FilesRow[];
    return rows.map((row) => this.rowToFileInfo(row));
  }

	/**
	 * Get start position of a heading in a file. Matches by exact heading text or Obsidian-style slug.
	 * @returns { line, col } (1-based) or null
	 */
	getHeadingPosition(filePath: string, headingFragment: string): { line: number; col: number } | null {
		const slug = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '-');
		const fragmentSlug = slug(headingFragment);
		const rows = this.db.prepare(
			'SELECT heading, start_line, start_col FROM headings_with_positions WHERE file_path = ?'
		).all(filePath) as { heading: string; start_line: number; start_col: number }[];
		for (const row of rows) {
			if (row.heading === headingFragment || slug(row.heading) === fragmentSlug) {
				return { line: row.start_line, col: row.start_col };
			}
		}
		return null;
	}

	/**
	 * Get start position of a block (^block-id) in a file.
	 * @returns { line, col } (1-based) or null
	 */
	getBlockPosition(filePath: string, blockId: string): { line: number; col: number } | null {
		const row = this.db.prepare(
			'SELECT start_line, start_col FROM blocks_with_positions WHERE file_path = ? AND block_id = ?'
		).get(filePath, blockId) as { start_line: number; start_col: number } | undefined;
		return row ? { line: row.start_line, col: row.start_col } : null;
	}

  /** Get files with no incoming or outgoing links (new structure). */
  getOrphanFiles(): FileInfo[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM files f
      WHERE NOT EXISTS (SELECT 1 FROM links_with_positions l WHERE l.source_path = f.path)
      AND NOT EXISTS (SELECT 1 FROM links_with_positions l WHERE l.target_path = f.path)
    `
      )
      .all() as FilesRow[];
    return rows.map((row) => this.rowToFileInfo(row));
  }

	/** Search files by path/basename, optional tags, path prefix, links-to target, heading, or mtime (new structure). */
	searchFiles(
		query: string,
		tags?: string[],
		limit: number = 20,
		pathPrefix?: string,
		linksToPath?: string,
		headingQuery?: string,
		modifiedAfter?: number,
		modifiedBefore?: number
	): Array<{ file: FileInfo; tags: string[] }> {
		const like = `%${query}%`;
		let sql = `
			SELECT f.*, (SELECT group_concat(DISTINCT tag) FROM tags_with_positions WHERE file_path = f.path) AS tags_str
			FROM files f
			WHERE (f.path LIKE ? OR f.basename LIKE ?)
		`;
		const params: (string | number)[] = [like, like];
		if (pathPrefix !== undefined && pathPrefix !== '') {
			sql += ` AND (f.path LIKE ? OR f.parent = ?)`;
			params.push(`${pathPrefix}%`, pathPrefix);
		}
		if (tags && tags.length > 0) {
			sql += ` AND f.path IN (SELECT file_path FROM tags_with_positions WHERE tag IN (${tags.map(() => '?').join(',')}))`;
			params.push(...tags);
		}
		if (linksToPath !== undefined && linksToPath !== '') {
			sql += ` AND f.path IN (SELECT source_path FROM links_with_positions WHERE target_path = ?)`;
			params.push(linksToPath);
		}
		if (headingQuery !== undefined && headingQuery !== '') {
			sql += ` AND f.path IN (SELECT file_path FROM headings_with_positions WHERE heading LIKE ?)`;
			params.push(`%${headingQuery}%`);
		}
		if (modifiedAfter !== undefined && Number.isFinite(modifiedAfter)) {
			sql += ` AND f.mtime >= ?`;
			params.push(modifiedAfter);
		}
		if (modifiedBefore !== undefined && Number.isFinite(modifiedBefore)) {
			sql += ` AND f.mtime <= ?`;
			params.push(modifiedBefore);
		}
    sql += ` ORDER BY f.mtime DESC LIMIT ?`;
    params.push(limit);
    const rows = this.db.prepare(sql).all(...params) as (FilesRow & { tags_str: string | null })[];
    return rows.map((row) => ({
      file: this.rowToFileInfo(row),
      tags: row.tags_str ? row.tags_str.split(',') : []
    }));
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
    const deleteSectionsStmt = this.db.prepare('DELETE FROM sections_with_positions WHERE file_path = ?');

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
      deleteSectionsStmt.run(filePath);

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

      const sectionStmt = this.db.prepare(`
        INSERT INTO sections_with_positions (
          file_path, section_id, type,
          start_line, start_col, start_offset,
          end_line, end_col, end_offset
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      // Insert sections
      if (metadata.sections && metadata.sections.length > 0) {
        for (const section of metadata.sections) {
          sectionStmt.run(
            filePath,
            section.id,
            section.type,
            section.position.start.line,
            section.position.start.col,
            section.position.start.offset,
            section.position.end.line,
            section.position.end.col,
            section.position.end.offset
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

    // Sections
    const sectionRows = this.db.prepare('SELECT * FROM sections_with_positions WHERE file_path = ?').all(filePath) as any[];
    if (sectionRows.length > 0) {
      result.sections = sectionRows.map(row => ({
        id: row.section_id,
        type: row.type,
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

  /**
   * Get sections for a file (section-level query). Returns empty array if file has no metadata.
   */
  getSectionsForFile(filePath: string): ContentMetadata['sections'] {
    const meta = this.getContentMetadata(filePath);
    return meta?.sections ?? [];
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


  getStats(): { totalNotes: number; totalLinks: number; orphans: number } {
    const totalNotes = (this.db.prepare('SELECT COUNT(*) AS count FROM files').get() as { count: number }).count;
    const totalLinks = (this.db.prepare('SELECT COUNT(*) AS count FROM links_with_positions').get() as { count: number }).count;
    const orphans = (this.db.prepare(`
      SELECT COUNT(*) AS count FROM files f
      WHERE NOT EXISTS (SELECT 1 FROM links_with_positions l WHERE l.source_path = f.path)
      AND NOT EXISTS (SELECT 1 FROM links_with_positions l WHERE l.target_path = f.path)
    `).get() as { count: number }).count;
    return { totalNotes, totalLinks, orphans };
  }

  /** Graph data from new structure (files + links_with_positions). */
  getGraphData(): GraphData {
    const fileRows = this.db.prepare(`
      SELECT f.path, f.basename,
        (SELECT group_concat(DISTINCT tag) FROM tags_with_positions WHERE file_path = f.path) AS tags_str
      FROM files f
    `).all() as { path: string; basename: string; tags_str: string | null }[];
    const edgeRows = this.db.prepare(`
      SELECT DISTINCT source_path, target_path FROM links_with_positions WHERE target_path IS NOT NULL
    `).all() as { source_path: string; target_path: string }[];

    return {
      nodes: fileRows.map(n => ({
        id: n.path,
        title: n.basename,
        path: n.path,
        tags: n.tags_str ? n.tags_str.split(',') : []
      })),
      edges: edgeRows.map(e => ({ source: e.source_path, target: e.target_path }))
    };
  }

}
