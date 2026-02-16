# Product Requirements Document: SecondBrain CLI Obsidian Alignment

## Overview

Enhance SecondBrain CLI to fully align with Obsidian's metadata architecture, implementing a two-layer system that separates file system information (TFile) from content metadata (CachedMetadata), and adding position information to all extracted elements.

## Goals

1. **Architectural Alignment**: Separate file information from content metadata to match Obsidian's structure
2. **Position Tracking**: Add precise position information (line, column, offset) to all extracted elements
3. **Enhanced Metadata**: Support Obsidian features like block references, embeds, footnotes, and list structures
4. **Backward Compatibility**: Maintain compatibility with existing CLI functionality while adding new features

## Development Approach: TDD

- **One feature, one test cycle**: After completing each feature (or small group of related subtasks), run the test suite (`bun test`) and add or update tests as needed. Do not proceed to the next feature until tests pass.
- **Order**: Implement the minimal code for the feature → add or extend tests that cover it → run `bun test` → fix until green → then move on.
- **Test types**: Unit tests for new types and utilities; integration tests for database and parser changes; keep tests close to the code they cover.
- **When using Ralphy**: The project config runs `bun test` after tasks; each completed feature should leave the suite green.

## Success Criteria

- [x] File system information (TFile equivalent) is separated from content metadata
- [x] All links, tags, headings include position information
- [x] Block references (`^block-id`) are extracted and tracked
- [x] Embed files are tracked with positions
- [x] Heading structure is fully extracted with levels and positions
- [x] Database schema supports new metadata structure
- [x] Existing CLI commands continue to work
- [x] Performance remains acceptable with new metadata extraction

## Tasks

### Phase 1: Core Architecture Refactoring

- [x] Create `FileInfo` interface matching Obsidian's `TFile`
  - [ ] Add `basename` and `extension` fields
  - [ ] Add `stat` object with `ctime`, `mtime`, `size`
  - [ ] Add `parent` field for folder hierarchy
  - [ ] Add tests for FileInfo (construction, shape); run `bun test`

- [x] Create `ContentMetadata` interface matching Obsidian's `CachedMetadata`
  - [ ] Define `LinkInfo` with position information
  - [ ] Define `TagInfo` with position information
  - [ ] Define `HeadingInfo` with level and position
  - [ ] Define `BlockInfo` for block references
  - [ ] Define `EmbedInfo` for embedded files
  - [ ] Define `Pos` interface for position tracking
  - [ ] Add tests for ContentMetadata types and Pos; run `bun test`

- [x] Update database schema to support new structure
  - [ ] Create `files` table for file system information
  - [ ] Create `content_metadata` table
  - [ ] Create `links` table with position columns
  - [ ] Create `tags` table with position columns
  - [ ] Create `headings` table with level and position
  - [ ] Create `blocks` table for block references
  - [ ] Create `embeds` table for embedded files
  - [ ] Write migration script from old schema
  - [ ] Add tests for schema creation and migration; run `bun test`

### Phase 2: Position Information Extraction

- [x] Implement position calculation utility
  - [ ] Calculate line numbers from offset
  - [ ] Calculate column numbers from offset
  - [ ] Handle multi-byte characters correctly
  - [ ] Handle different line endings (LF/CRLF)
  - [ ] Add unit tests for position calculation; run `bun test`

- [x] Update `NoteParser` to extract positions
  - [ ] Extract link positions with `Pos` information
  - [ ] Extract tag positions with `Pos` information
  - [ ] Extract heading positions with level and `Pos`
  - [ ] Extract frontmatter start/end positions
  - [ ] Handle edge cases (links in code blocks, etc.)
  - [ ] Add tests for link/tag/heading/frontmatter position extraction; run `bun test`

- [x] Add position extraction tests
  - [ ] Test line/column calculation accuracy
  - [ ] Test multi-line element positions
  - [ ] Test edge cases (empty files, single line, etc.)
  - [ ] Run full test suite; ensure all pass

### Phase 3: Enhanced Metadata Extraction

- [x] Implement block reference extraction
  - [ ] Parse `^block-id` syntax
  - [ ] Extract block IDs from headings
  - [ ] Store block positions
  - [ ] Support block references in links: `[[note#^block-id]]`
  - [ ] Add tests for block reference extraction; run `bun test`

- [x] Implement embed extraction
  - [ ] Parse `![[image.png]]` syntax
  - [ ] Extract embedded file paths
  - [ ] Store embed positions
  - [ ] Support display text: `![[image.png|alt text]]`
  - [ ] Add tests for embed extraction; run `bun test`

- [ ] Implement heading structure extraction
  - [ ] Extract all headings (H1-H6)
  - [ ] Store heading levels
  - [ ] Store heading text and positions
  - [ ] Support heading links: `[[note#heading]]`
  - [ ] Add tests for heading extraction; run `bun test`

- [ ] Implement list structure extraction (optional, Phase 3.5)
  - [ ] Extract list items with hierarchy
  - [ ] Track task status (checkbox)
  - [ ] Store list item positions
  - [ ] Add tests for list extraction (if implemented); run `bun test`

### Phase 4: Database Integration

- [ ] Update `DatabaseManager` class
  - [ ] Add methods for `FileInfo` operations
  - [ ] Add methods for `ContentMetadata` operations
  - [ ] Update `upsertNote` to use new structure
  - [ ] Add batch operations for performance
  - [ ] Add tests for DatabaseManager new methods; run `bun test`

- [ ] Update `VaultManager` class
  - [ ] Separate file info creation from content parsing
  - [ ] Use new metadata structure
  - [ ] Update sync process to use new schema
  - [ ] Add tests for VaultManager with new structure; run `bun test`

- [ ] Implement migration from old schema
  - [ ] Read existing notes from old tables
  - [ ] Extract positions from content (if possible)
  - [ ] Migrate to new schema
  - [ ] Verify data integrity
  - [ ] Add migration and integrity tests; run `bun test`

### Phase 5: API Alignment

- [ ] Add Obsidian-style API methods
  - [ ] `getFileByPath(path: string): FileInfo | null`
  - [ ] `getFileCache(file: FileInfo): ContentMetadata | null`
  - [ ] `getFirstLinkpathDest(linkpath: string, sourcePath: string): FileInfo | null`
  - [ ] Add tests for Obsidian-style API methods; run `bun test`

- [ ] Update existing commands to use new structure
  - [ ] Update `get` command
  - [ ] Update `search` command
  - [ ] Update `backlinks` command
  - [ ] Maintain backward compatibility
  - [ ] Add tests for updated commands; run `bun test`

- [ ] Add new query capabilities
  - [ ] Query by position ranges
  - [ ] Query blocks by ID
  - [ ] Query embeds by file type
  - [ ] Query headings by level
  - [ ] Add tests for new query capabilities; run `bun test`

### Phase 6: Testing & Documentation

- [ ] Write comprehensive tests
  - [ ] Unit tests for position calculation
  - [ ] Unit tests for metadata extraction
  - [ ] Integration tests for database operations
  - [ ] End-to-end tests for sync process

- [ ] Update documentation
  - [ ] Update README with new features
  - [ ] Document new database schema
  - [ ] Document migration process
  - [ ] Add examples of new API usage

- [ ] Performance testing
  - [ ] Benchmark metadata extraction
  - [ ] Benchmark database queries
  - [ ] Optimize slow operations
  - [ ] Test with large vaults (1000+ notes)

### Phase 7: Advanced Features (Optional)

- [ ] Implement footnote extraction
  - [ ] Extract footnote definitions
  - [ ] Extract footnote references
  - [ ] Link definitions to references
  - [ ] Add tests for footnote extraction; run `bun test`

- [ ] Implement section tracking
  - [ ] Track document sections
  - [ ] Support section-level queries
  - [ ] Add tests for section tracking; run `bun test`

- [ ] Add position-based navigation
  - [ ] Jump to specific line/column
  - [ ] Highlight elements by position
  - [ ] Add tests for position-based navigation; run `bun test`

## Technical Specifications

### FileInfo Interface
```typescript
interface FileInfo {
  path: string;              // Relative path from vault root
  name: string;               // Filename with extension
  basename: string;           // Filename without extension
  extension: string;          // Extension without dot
  parent: string | null;      // Parent folder path
  stat: {
    ctime: number;            // Creation time (Unix timestamp, ms)
    mtime: number;           // Modification time (Unix timestamp, ms)
    size: number;            // File size in bytes
  };
}
```

### ContentMetadata Interface
```typescript
interface ContentMetadata {
  links?: LinkInfo[];
  embeds?: EmbedInfo[];
  tags?: TagInfo[];
  headings?: HeadingInfo[];
  blocks?: BlockInfo[];
  frontmatter?: {
    start: Pos;
    end: Pos;
  };
}

interface Pos {
  start: { line: number; col: number; offset: number };
  end: { line: number; col: number; offset: number };
}
```

### Database Schema
See `docs/obsidian-alignment-guide.md` for complete schema.

## Dependencies

- No new external dependencies required
- Existing: `bun:sqlite`, `yaml`, `commander`

## Risks & Mitigation

1. **Performance Impact**: Adding position extraction may slow down parsing
   - Mitigation: Optimize position calculation, use batch operations

2. **Migration Complexity**: Migrating existing data may be complex
   - Mitigation: Write comprehensive migration script, test thoroughly

3. **Breaking Changes**: New structure may break existing code
   - Mitigation: Maintain backward compatibility, gradual migration

4. **Storage Overhead**: Position information increases database size
   - Mitigation: Use efficient data types, consider compression if needed

## Timeline

- **Phase 1-2**: 2-3 days (Core architecture + positions)
- **Phase 3**: 2-3 days (Enhanced extraction)
- **Phase 4**: 2 days (Database integration)
- **Phase 5**: 1-2 days (API alignment)
- **Phase 6**: 2 days (Testing & docs)
- **Phase 7**: Optional, as needed

**Total**: ~2 weeks for core features

## Notes

- This PRD aligns with the detailed guide in `docs/obsidian-alignment-guide.md`
- TDD: complete one feature → add/run tests → green → next feature. Each phase should be fully tested before moving to the next
- Maintain backward compatibility throughout the process
- Focus on quality over speed - small, focused changes

---

## Usage

Run with ralphy (if using Ralphy for automation):

```bash
ralphy --prd PRD.md
```

Or work through tasks manually, checking them off as completed.
