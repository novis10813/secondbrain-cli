import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import type { Note, Config } from '../types/index.js';
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

    const currentPaths = new Set<string>();
    const markdownFiles = this.findMarkdownFiles();

    // Pass 1: Collect all files and upsert basic metadata with empty links
    for (const filePath of markdownFiles) {
      const relativePath = relative(this.config.vaultPath, filePath);
      currentPaths.add(relativePath);

      const content = readFileSync(filePath, 'utf-8');
      const hash = NoteParser.computeHash(content);

      // Check if note exists and if hash changed
      const existingNote = this.db.getNoteByPath(relativePath);
      if (!existingNote) {
        // New note - create with empty links
        const note = await this.createNoteFromFile(relativePath, content, hash, []);
        this.db.upsertNote(note);
        added++;
      } else if (existingNote.hash !== hash) {
        // Updated note - preserve ID, use empty links initially
        const note = await this.createNoteFromFile(relativePath, content, hash, []);
        note.id = existingNote.id; // Keep same ID
        this.db.upsertNote(note);
        updated++;
      }
    }

    // Pass 2: Resolve links against populated database
    for (const filePath of markdownFiles) {
      const relativePath = relative(this.config.vaultPath, filePath);
      const content = readFileSync(filePath, 'utf-8');
      const parsed = NoteParser.parse(content);
      
      // Get the note ID
      const note = this.db.getNoteByPath(relativePath);
      if (note) {
        // Resolve link titles to note IDs
        const linkIds: string[] = [];
        for (const link of parsed.links) {
          const linkTitle = link.target;
          const linkedNote = this.findNoteByTitleOrPath(linkTitle);
          if (linkedNote) {
            linkIds.push(linkedNote.id);
          }
        }
        
        // Update note with resolved links
        note.links = linkIds;
        this.db.upsertNote(note);
      }
    }

    // Remove notes that no longer exist in filesystem
    const allNotes = this.db.getAllNotes();
    for (const note of allNotes) {
      if (!currentPaths.has(note.path)) {
        this.db.deleteNoteByPath(note.path);
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

  async createNoteFromFile(path: string, content: string, hash: string, links: string[] = []): Promise<Note> {
    const parsed = NoteParser.parse(content);
    const fullPath = join(this.config.vaultPath, path);
    const stats = statSync(fullPath);

    const ext = extname(path) || '.md';
    const name = basename(path, ext) || basename(path);
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
      backlinks: [], // Will be computed by database
      hash,
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString()
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

  // Database proxy methods
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

  getGraphData() {
    return this.db.getGraphData();
  }

  // Database proxy methods
  upsertNote(note: Note): void {
    return this.db.upsertNote(note);
  }
}