import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import type { Note, Config, FileInfo, ContentMetadata } from '../types/index.js';
import { DatabaseManager } from './database.js';
import { NoteParser } from './parser.js';

export class VaultManager {
  private config: Config;
  private db: DatabaseManager;

  constructor(config: Config) {
    this.config = config;
    this.db = new DatabaseManager(config);
  }

  close(): void {
    this.db.close();
  }

	// Sync entire vault
	async sync(): Promise<{ added: number; updated: number; removed: number }> {
		let added = 0;
		let updated = 0;
		let removed = 0;

		// Migrate any existing data from old schema first
		const migrationResult = this.db.migrateFromOldSchema();
		if (migrationResult.migrated > 0) {
			added += migrationResult.migrated;
		}

		const currentPaths = new Set<string>();
		const markdownFiles = this.findMarkdownFiles();

		// Pass 1: Collect all files and upsert FileInfo + ContentMetadata
		for (const filePath of markdownFiles) {
			const relativePath = relative(this.config.vaultPath, filePath);
			currentPaths.add(relativePath);

			const content = readFileSync(filePath, 'utf-8');
			const hash = NoteParser.computeHash(content);

			// Check if file exists and if content hash changed
			const existingFile = this.db.getFileByPath(relativePath);
			const isNew = !existingFile;
			// Check if content hash changed
			const existingHash = this.db.getFileContentHash(relativePath);
			const isUpdated = existingHash !== null && existingHash !== hash;

			if (isNew || isUpdated) {
				// Create FileInfo from file system
				const fileInfo = this.createFileInfo(relativePath, filePath);
				
				// Parse content to get ContentMetadata
				const parsed = NoteParser.parse(content);
				const contentMetadata = NoteParser.parsedToContentMetadata(parsed, content);

				// Upsert FileInfo and ContentMetadata separately (new structure)
				this.db.upsertFile(fileInfo, hash);
				this.db.upsertContentMetadata(relativePath, contentMetadata, hash);

				// Also update notes table for backward compatibility
				// Resolve links to note IDs for the Note object
				const linkIds: string[] = [];
				for (const link of parsed.links) {
					const linkedNote = this.findNoteByTitleOrPath(link.target);
					if (linkedNote) {
						linkIds.push(linkedNote.id);
					}
				}
				const note = await this.createNoteFromFile(relativePath, content, hash, linkIds);
				if (!isNew) {
					// Preserve ID for updated notes
					const existingNote = this.db.getNoteByPath(relativePath);
					if (existingNote) {
						note.id = existingNote.id;
					}
				}
				this.db.upsertNote(note);

				if (isNew) {
					added++;
				} else {
					updated++;
				}
			}
		}

		// Pass 2: Resolve link targets against populated database
		// Update links_with_positions table with resolved target_path and target_id
		for (const filePath of markdownFiles) {
			const relativePath = relative(this.config.vaultPath, filePath);
			const content = readFileSync(filePath, 'utf-8');
			const parsed = NoteParser.parse(content);
			
			// Resolve each link target and update links_with_positions table
			for (const link of parsed.links) {
				const linkedNote = this.findNoteByTitleOrPath(link.target);
				if (linkedNote) {
					// Update link target in database
					this.db.updateLinkTarget(relativePath, link.position.start.offset, linkedNote.path, linkedNote.id);
				}
			}
		}

		// Remove files that no longer exist in filesystem
		const allFiles = this.db.getAllFiles();
		for (const file of allFiles) {
			if (!currentPaths.has(file.path)) {
				this.db.deleteFile(file.path);
				removed++;
			}
		}

		return { added, updated, removed };
	}

  private findMarkdownFiles(): string[] {
    const files: string[] = [];
    const excludeDirs = ['.git', '.secondbrain', 'node_modules'];

    const walk = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
          walk(fullPath);
        } else if (entry.isFile() && extname(entry.name) === '.md') {
          files.push(fullPath);
        }
      }
    };

    walk(this.config.vaultPath);
    return files;
  }

	/**
	 * Create FileInfo from file path and stats.
	 * Separates file system information from content parsing.
	 */
	private createFileInfo(relativePath: string, fullPath: string): FileInfo {
		const stats = statSync(fullPath);
		const ext = extname(relativePath) || '.md';
		const name = basename(relativePath);
		const basenameWithoutExt = basename(relativePath, ext) || basename(relativePath);
		const parentDir = dirname(relativePath);
		const parent = parentDir === '.' ? null : parentDir;

		return {
			path: relativePath,
			name,
			basename: basenameWithoutExt,
			extension: ext.replace(/^\./, ''), // Remove leading dot
			parent,
			stat: {
				ctime: stats.birthtimeMs,
				mtime: stats.mtimeMs,
				size: stats.size
			}
		};
	}

	/**
	 * Legacy method for backward compatibility.
	 * Creates a Note object combining FileInfo and NoteContent.
	 * @deprecated Use createFileInfo + NoteParser.parse + parsedToContentMetadata instead
	 */
	async createNoteFromFile(path: string, content: string, hash: string, links: string[] = []): Promise<Note> {
		const parsed = NoteParser.parse(content);
		const fullPath = join(this.config.vaultPath, path);
		const stats = statSync(fullPath);

		const ext = extname(path) || '.md';
		const name = basename(path, ext) || basename(path);
		const parentDir = dirname(path);
		const parent = parentDir === '.' ? null : parentDir;

		return {
			id: hash,
			path,
			name,
			extension: ext,
			title: parsed.title,
			content: parsed.content,
			frontmatter: parsed.frontmatter,
			tags: parsed.tags.map(t => t.name),
			links: links,
			blockRefs: parsed.blockRefs.map(b => b.blockId),
			embeds: parsed.embeds,
			headings: parsed.headings.map(h => ({ level: h.level, text: h.text, line: h.line, column: h.column })),
			backlinks: [], // Will be computed by database
			hash,
			createdAt: stats.birthtime.toISOString(),
			modifiedAt: stats.mtime.toISOString(),
			parent,
			basename: name,
			stat: {
				ctime: stats.birthtimeMs,
				mtime: stats.mtimeMs,
				size: stats.size
			}
		};
	}

  private findNoteByTitleOrPath(titleOrPath: string): Note | null {
    // Try exact path match first
    const note = this.db.getNoteByPath(titleOrPath + '.md');
    if (note) return note;

    // Try with different extensions or paths
    const variations = [
      titleOrPath + '.md',
      titleOrPath,
      titleOrPath.replace(/ /g, '-') + '.md',
      titleOrPath.replace(/ /g, '_') + '.md'
    ];

    for (const variation of variations) {
      const note = this.db.getNoteByPath(variation);
      if (note) return note;
    }

    // Search by title using SQL (case-insensitive)
    const byTitle = this.db.getNoteByTitle(titleOrPath);
    if (byTitle) return byTitle;

    return null;
  }

  // Write note to file
  writeNote(path: string, content: string): void {
    const fullPath = join(this.config.vaultPath, path);
    
    // Ensure directory exists
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
  }

  readNote(path: string): string | null {
    const fullPath = join(this.config.vaultPath, path);
    if (!existsSync(fullPath)) {
      return null;
    }
    return readFileSync(fullPath, 'utf-8');
  }

  // Get daily note path
  getDailyNotePath(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return join(this.config.dailyNotesFolder, `${dateStr}.md`);
  }

  // Get template path
  getTemplatePath(templateName: string): string {
    return join(this.config.templatesFolder, `${templateName}.md`);
  }

  // Database proxy methods (legacy note-based, used by sync/capture)
  getNoteById(id: string): Note | null {
    return this.db.getNoteById(id);
  }

  getNoteByPath(path: string): Note | null {
    return this.db.getNoteByPath(path);
  }

  searchNotes(query: string, tags?: string[], limit: number = 20): Note[] {
    return this.db.searchNotes(query, tags, limit);
  }

  getBacklinks(noteId: string): Note[] {
    return this.db.getBacklinks(noteId);
  }

  getOrphans(): Note[] {
    return this.db.getOrphans();
  }

  getStats() {
    return this.db.getStats();
  }

  /** Migrate data from old schema (notes) to new schema (files + content_metadata). */
  migrateFromOldSchema(): { migrated: number; skipped: number; errors: number } {
    return this.db.migrateFromOldSchema();
  }

  // New structure (files + content_metadata + links_with_positions)
  getBacklinksByPath(filePath: string): FileInfo[] {
    return this.db.getBacklinksByPath(filePath);
  }

  getOrphanFiles(): FileInfo[] {
    return this.db.getOrphanFiles();
  }

  searchFiles(
    query: string,
    tags?: string[],
    limit: number = 20,
    pathPrefix?: string
  ): Array<{ file: FileInfo; tags: string[] }> {
    return this.db.searchFiles(query, tags, limit, pathPrefix);
  }

  getGraphData() {
    return this.db.getGraphData();
  }

  // Database proxy methods
  upsertNote(note: Note): void {
    return this.db.upsertNote(note);
  }

  // Obsidian-style API methods

  /**
   * Get all markdown files in the vault (Obsidian-style API).
   * Equivalent to Obsidian's Vault.getMarkdownFiles().
   * @returns Array of FileInfo for every .md file in the vault
   */
  getMarkdownFiles(): FileInfo[] {
    return this.db.getAllFiles();
  }

  /**
   * Get FileInfo by path (Obsidian-style API).
   * @param path Relative path from vault root
   * @returns FileInfo or null if not found
   */
  getFileByPath(path: string): FileInfo | null {
    return this.db.getFileByPath(path);
  }

  /**
   * Resolve path or basename to FileInfo using new structure only.
   * Tries exact path, path + .md, then match by basename.
   */
  resolvePathOrBasename(pathOrBasename: string): FileInfo | null {
    let file = this.db.getFileByPath(pathOrBasename);
    if (file) return file;
    if (!pathOrBasename.endsWith('.md')) {
      file = this.db.getFileByPath(pathOrBasename + '.md');
      if (file) return file;
    }
    const base = pathOrBasename.replace(/\.md$/i, '').toLowerCase();
    const all = this.db.getAllFiles();
    return all.find(f => f.basename.toLowerCase() === base) ?? null;
  }

  /**
   * Get ContentMetadata for a FileInfo (Obsidian-style API).
   * Equivalent to Obsidian's MetadataCache.getFileCache(file).
   * @param file FileInfo object
   * @returns ContentMetadata or null if not found
   */
  getFileCache(file: FileInfo): ContentMetadata | null {
    return this.db.getContentMetadata(file.path);
  }

  /**
   * Resolve a linkpath to a FileInfo (Obsidian-style API).
   * Equivalent to Obsidian's MetadataCache.getFirstLinkpathDest(linkpath, sourcePath).
   * Resolves linkpaths like "note-name", "folder/note-name", "note-name#heading", etc.
   * @param linkpath Link path (may include heading/block reference after #)
   * @param sourcePath Path of the source file (for relative path resolution)
   * @returns FileInfo or null if not found
   */
  getFirstLinkpathDest(linkpath: string, sourcePath: string): FileInfo | null {
    // Strip heading/block reference (everything after #)
    const filePart = linkpath.split('#')[0].trim();
    if (!filePart) return null;

    // Try exact path match first
    let file = this.db.getFileByPath(filePart);
    if (file) return file;

    // Try with .md extension
    file = this.db.getFileByPath(filePart + '.md');
    if (file) return file;

    // Try relative to source file's directory
    if (sourcePath) {
      const sourceDir = dirname(sourcePath);
      const relativePath = sourceDir === '.' ? filePart : join(sourceDir, filePart);
      file = this.db.getFileByPath(relativePath);
      if (file) return file;

      // Try relative path with .md extension
      file = this.db.getFileByPath(relativePath + '.md');
      if (file) return file;
    }

    // Try path variations (spaces to dashes/underscores)
    const variations = [
      filePart.replace(/ /g, '-') + '.md',
      filePart.replace(/ /g, '_') + '.md',
      filePart.replace(/ /g, '-'),
      filePart.replace(/ /g, '_')
    ];

    for (const variation of variations) {
      file = this.db.getFileByPath(variation);
      if (file) return file;
    }

    // Try finding by basename (filename without extension)
    // This matches Obsidian's behavior of finding files by title
    const allFiles = this.db.getAllFiles();
    const basenameToMatch = filePart.replace(/\.md$/, '').toLowerCase();
    
    for (const candidate of allFiles) {
      if (candidate.basename.toLowerCase() === basenameToMatch) {
        return candidate;
      }
    }

    return null;
  }
}