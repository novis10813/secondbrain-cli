import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import type { Config, FileInfo, ContentMetadata } from '../types/index.js';
import { DatabaseManager } from './database.js';
import { NoteParser, type ParsedNote } from './parser.js';

export class VaultManager {
  private _config: Config;
  private db: DatabaseManager;

  constructor(config: Config) {
    this._config = config;
    this.db = new DatabaseManager(config);
  }

  get config(): Config {
    return this._config;
  }

  close(): void {
    this.db.close();
  }

  // Sync entire vault
  async sync(): Promise<{ added: number; updated: number; removed: number }> {
    let added = 0;
    let updated = 0;
    let removed = 0;

    const currentPaths = new Set<string>();
    const markdownFiles = this.findMarkdownFiles();
    const parsedByPath = new Map<string, ParsedNote>();

    // Pass 1: Collect all files, parse once, upsert FileInfo + ContentMetadata
    for (const filePath of markdownFiles) {
      const relativePath = relative(this._config.vaultPath, filePath);
      currentPaths.add(relativePath);

      const content = readFileSync(filePath, 'utf-8');
      const hash = NoteParser.computeHash(content);

      const existingHash = this.db.getFileContentHash(relativePath);

      if (existingHash === hash) {
        // Skip parsing, load existing metadata for Pass 2 link resolution
        const existingMetadata = this.db.getContentMetadata(relativePath);
        if (existingMetadata) {
          parsedByPath.set(relativePath, {
            title: '',
            content: '',
            frontmatter: {},
            tags: [],
            links: existingMetadata.links ?? [],
            headings: [],
            blocks: []
          } as any);
          continue;
        }
      }

      const parsed = NoteParser.parse(content);
      parsedByPath.set(relativePath, parsed);

      const existingFile = this.db.getFileByPath(relativePath);
      const isNew = !existingFile;

      const fileInfo = this.createFileInfo(relativePath, filePath);
      const contentMetadata = NoteParser.parsedToContentMetadata(parsed, content);

      this.db.upsertFile(fileInfo, hash);
      this.db.upsertContentMetadata(relativePath, contentMetadata, hash);

      if (isNew) {
        added++;
      } else {
        updated++;
      }
    }

    // Pass 2: Resolve link targets using cached parsed data (no second read/parse)
    for (const [relativePath, parsed] of parsedByPath) {
      for (const link of parsed.links) {
        // Guard: skip links with undefined/non-string targets (e.g. from template placeholders)
        if (!link.target || typeof link.target !== 'string') continue;
        const linkedFile = this.getFirstLinkpathDest(link.target, relativePath);
        if (linkedFile) {
          this.db.updateLinkTarget(relativePath, link.position.start.offset, linkedFile.path, null);
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

  /**
   * Rapidly index a single file without a full vault scan.
   * Useful for capture or real-time updates.
   */
  indexSingleFile(relativePath: string): void {
    const fullPath = join(this._config.vaultPath, relativePath);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = readFileSync(fullPath, 'utf-8');
    const hash = NoteParser.computeHash(content);
    const fileInfo = this.createFileInfo(relativePath, fullPath);
    const parsed = NoteParser.parse(content);
    const contentMetadata = NoteParser.parsedToContentMetadata(parsed, content);

    this.db.upsertFile(fileInfo, hash);
    this.db.upsertContentMetadata(relativePath, contentMetadata, hash);

    // Resolve outlinks of this file immediately
    for (const link of parsed.links) {
      // Guard: skip links with undefined/non-string targets (e.g. from template placeholders)
      if (!link.target || typeof link.target !== 'string') continue;
      const linkedFile = this.getFirstLinkpathDest(link.target, relativePath);
      if (linkedFile) {
        this.db.updateLinkTarget(relativePath, link.position.start.offset, linkedFile.path, null);
      }
    }
  }

  private findMarkdownFiles(): string[] {
    const files: string[] = [];
    const excludeDirs = ['.git', '.secondbrain', 'node_modules'];

    const walk = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
          // Skip symlinked directories to avoid cycles and duplicate traversal
          if (!entry.isSymbolicLink()) {
            walk(fullPath);
          }
        } else if (entry.isFile() && extname(entry.name) === '.md') {
          files.push(fullPath);
        }
      }
    };

    walk(this._config.vaultPath);
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


  // Write note to file
  writeNote(path: string, content: string): void {
    const fullPath = join(this._config.vaultPath, path);

    // Ensure directory exists
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
  }

  readNote(path: string): string | null {
    const fullPath = join(this._config.vaultPath, path);
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
    return join(this._config.dailyNotesFolder, `${dateStr}.md`);
  }

  // Get template path
  getTemplatePath(templateName: string): string {
    return join(this._config.templatesFolder, `${templateName}.md`);
  }

  getStats() {
    return this.db.getStats();
  }

  // New structure (files + content_metadata + links_with_positions)
  getBacklinksByPath(filePath: string): FileInfo[] {
    return this.db.getBacklinksByPath(filePath);
  }

  getOutlinksByPath(filePath: string): FileInfo[] {
    return this.db.getOutlinksByPath(filePath);
  }

  getOrphanFiles(): FileInfo[] {
    return this.db.getOrphanFiles();
  }

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
    return this.db.searchFiles(
      query, tags, limit, pathPrefix, linksToPath, headingQuery, modifiedAfter, modifiedBefore
    );
  }

  getGraphData() {
    return this.db.getGraphData();
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
    const base = pathOrBasename.replace(/\.md$/i, '');
    return this.db.getFileByBasename(base);
  }

  /**
   * Read file content by FileInfo (Obsidian-style API).
   * Equivalent to Obsidian's Vault.read(file).
   * @param file FileInfo object
   * @returns File content or null if not found
   */
  readFile(file: FileInfo): string | null {
    return this.readNote(file.path);
  }

  /**
   * Get backlinks for a file by FileInfo (Obsidian-style API).
   * Equivalent to Obsidian's MetadataCache.getBacklinksForFile(file).
   * @param file FileInfo object
   * @returns Array of FileInfo that link to this file
   */
  getBacklinksForFile(file: FileInfo): FileInfo[] {
    return this.getBacklinksByPath(file.path);
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
    // Guard: reject undefined, null, or non-string values (e.g. from template placeholders in frontmatter)
    if (!linkpath || typeof linkpath !== 'string') return null;
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
    const basenameToMatch = filePart.replace(/\.md$/, '');
    return this.db.getFileByBasename(basenameToMatch);
  }

  /**
   * Resolve a linkpath to a file and position (line, col) for editor navigation.
   * Supports note, note#heading, note#^block-id, and note#heading#^block-id.
   * @returns { path, line, col } (1-based) or null if file not found
   */
  resolveLinkToPosition(
    linkpath: string,
    sourcePath: string
  ): { path: string; line: number; col: number } | null {
    const parts = linkpath.split('#').map(p => p.trim());
    const filePart = parts[0];
    if (!filePart) return null;

    const file = this.getFirstLinkpathDest(filePart, sourcePath);
    if (!file) return null;

    const fragments = parts.slice(1);
    if (fragments.length === 0) {
      return { path: file.path, line: 1, col: 1 };
    }

    const last = fragments[fragments.length - 1];
    const blockId = last.startsWith('^') ? last.slice(1) : null;
    const headingFragment =
      blockId && fragments.length > 1
        ? fragments.slice(0, -1).join(' ')
        : fragments.join(' ');

    if (blockId) {
      const pos = this.db.getBlockPosition(file.path, blockId);
      if (pos) return { path: file.path, ...pos };
    }
    if (headingFragment) {
      const pos = this.db.getHeadingPosition(file.path, headingFragment);
      if (pos) return { path: file.path, ...pos };
    }
    return { path: file.path, line: 1, col: 1 };
  }
}