# Obsidian alignment guide

## Obsidian file metadata model

Obsidian uses a **layered model** to represent file metadata.

### 1. TFile (file-level info)
Represents filesystem-level information, derived from `TAbstractFile`:

```typescript
// TAbstractFile (base)
{
  vault: Vault;           // Owning vault
  path: string;           // Full path (relative to vault root)
  name: string;           // File name (with extension)
  parent: TFolder | null; // Parent folder
}

// TFile extends TAbstractFile
{
  stat: FileStats;        // File stats
  basename: string;       // File name without extension
  extension: string;      // Extension (without dot)
}

// FileStats
{
  ctime: number;         // Created at (Unix timestamp, ms)
  mtime: number;         // Modified at (Unix timestamp, ms)
  size: number;          // File size (bytes)
}
```

### 2. CachedMetadata (content-level info)
Represents parsed content metadata, accessed via `MetadataCache.getFileCache(file)`:

```typescript
interface CachedMetadata {
  links?: LinkCache[];           // Wikilinks
  embeds?: EmbedCache[];         // Embedded files/images
  tags?: TagCache[];             // Tags
  headings?: HeadingCache[];     // Headings
  footnotes?: FootnoteCache[];   // Footnote definitions
  footnoteRefs?: FootnoteRefCache[]; // Footnote references
  blocks?: BlockCache[];         // Block IDs (for block refs)
  frontmatter?: FrontMatterCache; // Frontmatter position
  sections?: SectionCache[];     // Document sections
  listItems?: ListItemCache[];  // List items
}
```

### 3. CacheItem (position information)
All cache items share a common position structure:

```typescript
interface CacheItem {
  position: Pos;  // Location in the file
}

interface Pos {
  start: Loc;  // Start position
  end: Loc;    // End position
}

interface Loc {
  line: number;   // Line (0-based)
  col: number;    // Column
  offset: number; // Character offset from file start
}
```

### 4. Concrete cache types

```typescript
// LinkCache - wikilink
interface LinkCache extends ReferenceCache {
  link: string;        // Link target (path or title)
  original: string;    // Original text (e.g. [[page|display]])
  displayText?: string;// Display text (if any)
  position: Pos;       // Position in the file
}

// TagCache - tag
interface TagCache extends CacheItem {
  tag: string;         // Tag name (without #)
  position: Pos;
}

// HeadingCache - heading
interface HeadingCache extends CacheItem {
  heading: string;     // Heading text
  level: number;       // Level (1-6)
  position: Pos;
}

// BlockCache - block
interface BlockCache extends CacheItem {
  id: string;          // Block ID (for ^block-id references)
  position: Pos;
}

// EmbedCache - embed
interface EmbedCache extends ReferenceCache {
  link: string;        // Embedded file path
  original: string;
  displayText?: string;
  position: Pos;
}
```

## Current CLI structures

```typescript
interface Note {
  id: string;                    // Content hash
  path: string;                  // Relative path
  title: string;                 // Title (derived from content)
  content: string;               // Full content
  frontmatter: Record<string, unknown>; // Frontmatter object
  tags: string[];                // Tags (no positions)
  links: string[];               // Linked note IDs
  backlinks: string[];           // IDs of notes linking here
  hash: string;                  // Content hash
  createdAt: string;             // ISO 8601
  modifiedAt: string;            // ISO 8601
}
```

## Alignment approach

### Phase 1: Split file info and content metadata

Split `Note` into two parts mirroring Obsidian’s `TFile` and `CachedMetadata`:

```typescript
// File-level info (TFile-like)
interface FileInfo {
  path: string;              // Relative path
  name: string;              // File name (with extension)
  basename: string;          // File name without extension
  extension: string;         // Extension
  parent: string | null;     // Parent folder path
  stat: {
    ctime: number;           // Unix timestamp (ms)
    mtime: number;           // Unix timestamp (ms)
    size: number;            // bytes
  };
}

// Content-level info (CachedMetadata-like)
interface ContentMetadata {
  links?: LinkInfo[];        // Links (with positions)
  embeds?: EmbedInfo[];      // Embeds
  tags?: TagInfo[];          // Tags (with positions)
  headings?: HeadingInfo[];  // Headings
  blocks?: BlockInfo[];      // Blocks
  frontmatter?: {
    start: Pos;
    end: Pos;
  };
  // ... 其他
}

// Position info
interface Pos {
  start: { line: number; col: number; offset: number };
  end: { line: number; col: number; offset: number };
}

interface LinkInfo {
  link: string;              // Target path/title
  original: string;          // Original text
  displayText?: string;      // Display text
  position: Pos;
}

interface TagInfo {
  tag: string;               // Tag name
  position: Pos;
}

interface HeadingInfo {
  heading: string;           // Heading text
  level: number;             // 1-6
  position: Pos;
}

interface BlockInfo {
  id: string;                // Block ID
  position: Pos;
}
```

### Phase 2: Update database schema

```sql
-- File info table (TFile-like)
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  basename TEXT NOT NULL,
  extension TEXT NOT NULL,
  parent TEXT,
  ctime INTEGER NOT NULL,     -- Unix timestamp (ms)
  mtime INTEGER NOT NULL,     -- Unix timestamp (ms)
  size INTEGER NOT NULL,      -- bytes
  content_hash TEXT NOT NULL  -- For change tracking
);

-- Content metadata table (CachedMetadata-like)
CREATE TABLE content_metadata (
  file_path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  frontmatter_start_line INTEGER,
  frontmatter_end_line INTEGER,
  FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
);

-- Links with positions
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  target_path TEXT,          -- Resolved target path
  target_id TEXT,            -- Resolved note ID
  original TEXT NOT NULL,    -- Original wikilink text
  display_text TEXT,
  start_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  FOREIGN KEY (source_path) REFERENCES files(path) ON DELETE CASCADE
);

-- Tags with positions
CREATE TABLE tags (
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
);

-- Headings with positions
CREATE TABLE headings (
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
);

-- Blocks with positions
CREATE TABLE blocks (
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
);
```

### Phase 3: Update the parser

Extend `NoteParser` to extract positions for links, tags, headings, and blocks:

```typescript
export class NoteParser {
  static parseWithPositions(content: string): ParsedNoteWithPositions {
    const lines = content.split('\n');

    const frontmatterPos = this.extractFrontmatterPosition(content, lines);
    const links = this.extractLinksWithPositions(content, lines);
    const tags = this.extractTagsWithPositions(content, lines);
    const headings = this.extractHeadingsWithPositions(content, lines);
    const blocks = this.extractBlocksWithPositions(content, lines);

    return {
      frontmatter: frontmatterPos.data,
      frontmatterPosition: frontmatterPos.position,
      links,
      tags,
      headings,
      blocks,
      // ...
    };
  }
  
  private static calculatePosition(
    content: string,
    match: RegExpMatchArray,
    lines: string[]
  ): Pos {
    const startOffset = match.index!;
    const endOffset = startOffset + match[0].length;

    let line = 0;
    let col = 0;
    let currentOffset = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline
      if (currentOffset + lineLength > startOffset) {
        line = i;
        col = startOffset - currentOffset;
        break;
      }
      currentOffset += lineLength;
    }
    
    let endLine = line;
    let endCol = col;
    currentOffset = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1;
      if (currentOffset + lineLength > endOffset) {
        endLine = i;
        endCol = endOffset - currentOffset;
        break;
      }
      currentOffset += lineLength;
    }
    
    return {
      start: { line, col, offset: startOffset },
      end: { line: endLine, col: endCol, offset: endOffset }
    };
  }
}
```

### Phase 4: API alignment

Expose VaultManager methods that mirror Obsidian’s APIs:

```typescript
export class VaultManager {
  // Similar to app.vault.getAbstractFileByPath()
  getFileByPath(path: string): FileInfo | null {
    // ...
  }
  
  // Similar to app.metadataCache.getFileCache()
  getFileCache(file: FileInfo): ContentMetadata | null {
    // ...
  }
  
  // Similar to app.metadataCache.getFirstLinkpathDest()
  getFirstLinkpathDest(linkpath: string, sourcePath: string): FileInfo | null {
    // ...
  }
}
```

## Example: aligned query

```typescript
const file = vault.getFileByPath('Projects/api-design.md');
const cache = vault.getFileCache(file);

cache.links?.forEach(link => {
  console.log(`Link to ${link.link} at line ${link.position.start.line}`);
});

cache.headings?.forEach(heading => {
  console.log(`${'#'.repeat(heading.level)} ${heading.heading}`);
});

const target = vault.getFirstLinkpathDest('api-design', 'current-file.md');
```

## References

- [Obsidian API: TFile](https://docs.obsidian.md/Reference/TypeScript+API/TFile)
- [Obsidian API: CachedMetadata](https://docs.obsidian.md/Reference/TypeScript+API/CachedMetadata)
- [Obsidian API: MetadataCache](https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache)
- [Obsidian API Type Definitions](https://github.com/obsidianmd/obsidian-api)

