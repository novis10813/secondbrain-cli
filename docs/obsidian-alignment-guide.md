# Obsidian 對齊指南

## Obsidian 的檔案 Metadata 架構

Obsidian 使用**分層架構**來組織檔案的 metadata：

### 1. TFile (檔案外部資訊)
代表檔案系統層級的資訊，繼承自 `TAbstractFile`：

```typescript
// TAbstractFile (基礎)
{
  vault: Vault;           // 所屬的 vault
  path: string;           // 完整路徑（相對於 vault root）
  name: string;           // 檔名（含副檔名）
  parent: TFolder | null; // 父資料夾
}

// TFile extends TAbstractFile
{
  stat: FileStats;        // 檔案統計資訊
  basename: string;       // 不含副檔名的檔名
  extension: string;      // 副檔名（不含點）
}

// FileStats
{
  ctime: number;         // 建立時間（Unix timestamp, milliseconds）
  mtime: number;         // 修改時間（Unix timestamp, milliseconds）
  size: number;          // 檔案大小（bytes）
}
```

### 2. CachedMetadata (檔案內部資訊)
代表檔案內容解析後的 metadata，透過 `MetadataCache.getFileCache(file)` 取得：

```typescript
interface CachedMetadata {
  links?: LinkCache[];           // 連結（wikilinks）
  embeds?: EmbedCache[];         // 嵌入的檔案/圖片
  tags?: TagCache[];             // 標籤
  headings?: HeadingCache[];     // 標題
  footnotes?: FootnoteCache[];   // 腳註定義
  footnoteRefs?: FootnoteRefCache[]; // 腳註引用
  blocks?: BlockCache[];        // 區塊 ID（用於區塊引用）
  frontmatter?: FrontMatterCache; // Frontmatter 位置資訊
  sections?: SectionCache[];     // 文件區段
  listItems?: ListItemCache[];  // 列表項目
}
```

### 3. CacheItem (位置資訊基礎)
所有 cache 項目都包含位置資訊：

```typescript
interface CacheItem {
  position: Pos;  // 位置資訊
}

interface Pos {
  start: Loc;  // 起始位置
  end: Loc;    // 結束位置
}

interface Loc {
  line: number;   // 行號（0-based）
  col: number;     // 列號
  offset: number;  // 從檔案開頭的字符偏移量
}
```

### 4. 具體 Cache 類型

```typescript
// LinkCache - 連結
interface LinkCache extends ReferenceCache {
  link: string;        // 目標路徑/標題
  original: string;    // 原始文字（如 [[page|display]]）
  displayText?: string; // 顯示文字（如果有）
  position: Pos;       // 位置
}

// TagCache - 標籤
interface TagCache extends CacheItem {
  tag: string;         // 標籤名稱（不含 #）
  position: Pos;
}

// HeadingCache - 標題
interface HeadingCache extends CacheItem {
  heading: string;     // 標題文字
  level: number;      // 層級（1-6）
  position: Pos;
}

// BlockCache - 區塊
interface BlockCache extends CacheItem {
  id: string;          // 區塊 ID（用於 ^block-id 引用）
  position: Pos;
}

// EmbedCache - 嵌入
interface EmbedCache extends ReferenceCache {
  link: string;        // 嵌入的檔案路徑
  original: string;
  displayText?: string;
  position: Pos;
}
```

## 當前 CLI 的結構

```typescript
interface Note {
  id: string;                    // content hash
  path: string;                  // 相對路徑
  title: string;                 // 標題（從內容提取）
  content: string;               // 完整內容
  frontmatter: Record<string, unknown>; // Frontmatter 物件
  tags: string[];                // 標籤陣列（無位置）
  links: string[];               // 連結到的筆記 ID
  backlinks: string[];           // 連結到此筆記的 ID
  hash: string;                  // 內容雜湊
  createdAt: string;             // ISO 8601
  modifiedAt: string;            // ISO 8601
}
```

## 對齊 Obsidian 的實作建議

### 階段 1: 分離檔案資訊與內容資訊

將 `Note` 拆分為兩個部分，對應 Obsidian 的 `TFile` 和 `CachedMetadata`：

```typescript
// 檔案外部資訊（對應 TFile）
interface FileInfo {
  path: string;              // 相對路徑
  name: string;              // 檔名（含副檔名）
  basename: string;          // 不含副檔名
  extension: string;         // 副檔名
  parent: string | null;     // 父資料夾路徑
  stat: {
    ctime: number;           // Unix timestamp (ms)
    mtime: number;           // Unix timestamp (ms)
    size: number;            // bytes
  };
}

// 檔案內部資訊（對應 CachedMetadata）
interface ContentMetadata {
  links?: LinkInfo[];        // 連結（含位置）
  embeds?: EmbedInfo[];      // 嵌入
  tags?: TagInfo[];          // 標籤（含位置）
  headings?: HeadingInfo[];  // 標題
  blocks?: BlockInfo[];      // 區塊
  frontmatter?: {
    start: Pos;
    end: Pos;
  };
  // ... 其他
}

// 位置資訊
interface Pos {
  start: { line: number; col: number; offset: number };
  end: { line: number; col: number; offset: number };
}

interface LinkInfo {
  link: string;              // 目標路徑/標題
  original: string;           // 原始文字
  displayText?: string;      // 顯示文字
  position: Pos;
}

interface TagInfo {
  tag: string;               // 標籤名稱
  position: Pos;
}

interface HeadingInfo {
  heading: string;           // 標題文字
  level: number;             // 1-6
  position: Pos;
}

interface BlockInfo {
  id: string;                // 區塊 ID
  position: Pos;
}
```

### 階段 2: 更新資料庫結構

```sql
-- 檔案資訊表（對應 TFile）
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  basename TEXT NOT NULL,
  extension TEXT NOT NULL,
  parent TEXT,
  ctime INTEGER NOT NULL,     -- Unix timestamp (ms)
  mtime INTEGER NOT NULL,     -- Unix timestamp (ms)
  size INTEGER NOT NULL,      -- bytes
  content_hash TEXT NOT NULL  -- 用於關聯
);

-- 內容 Metadata 表（對應 CachedMetadata）
CREATE TABLE content_metadata (
  file_path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  frontmatter_start_line INTEGER,
  frontmatter_end_line INTEGER,
  FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
);

-- 連結表（含位置資訊）
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  target_path TEXT,          -- 解析後的目標路徑
  target_id TEXT,            -- 解析後的筆記 ID
  original TEXT NOT NULL,    -- 原始文字
  display_text TEXT,
  start_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  FOREIGN KEY (source_path) REFERENCES files(path) ON DELETE CASCADE
);

-- 標籤表（含位置資訊）
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

-- 標題表
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

-- 區塊表
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

### 階段 3: 更新 Parser

擴展 `NoteParser` 以提取位置資訊：

```typescript
export class NoteParser {
  static parseWithPositions(content: string): ParsedNoteWithPositions {
    const lines = content.split('\n');
    let offset = 0;
    
    // 提取 frontmatter 位置
    const frontmatterPos = this.extractFrontmatterPosition(content, lines, offset);
    
    // 提取連結（含位置）
    const links = this.extractLinksWithPositions(content, lines, offset);
    
    // 提取標籤（含位置）
    const tags = this.extractTagsWithPositions(content, lines, offset);
    
    // 提取標題（含位置）
    const headings = this.extractHeadingsWithPositions(content, lines, offset);
    
    // 提取區塊（含位置）
    const blocks = this.extractBlocksWithPositions(content, lines, offset);
    
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
    
    // 計算行號和列號
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
    
    // 計算結束位置
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

### 階段 4: 更新 API 以對齊 Obsidian

提供類似 Obsidian API 的介面：

```typescript
export class VaultManager {
  // 類似 app.vault.getAbstractFileByPath()
  getFileByPath(path: string): FileInfo | null {
    // ...
  }
  
  // 類似 app.metadataCache.getFileCache()
  getFileCache(file: FileInfo): ContentMetadata | null {
    // ...
  }
  
  // 類似 app.metadataCache.getFirstLinkpathDest()
  getFirstLinkpathDest(linkpath: string, sourcePath: string): FileInfo | null {
    // ...
  }
}
```

## 實作優先順序

### 高優先級（核心功能）
1. ✅ **分離 FileInfo 和 ContentMetadata**
   - 將檔案系統資訊與內容 metadata 分開
   - 更新資料庫結構

2. ✅ **位置資訊提取**
   - 為連結、標籤添加位置資訊
   - 更新 parser 以計算行號、列號、偏移量

3. ✅ **標題結構提取**
   - 提取所有標題及其層級
   - 儲存標題位置資訊

### 中優先級（增強功能）
4. **區塊引用支援**
   - 提取區塊 ID（`^block-id`）
   - 支援區塊引用查詢

5. **嵌入檔案追蹤**
   - 追蹤 `![[image.png]]` 等嵌入
   - 儲存嵌入位置資訊

6. **列表結構**
   - 提取列表項目層級
   - 追蹤任務狀態（checkbox）

### 低優先級（進階功能）
7. **腳註支援**
   - 提取腳註定義和引用
   - 建立腳註關聯

8. **Section 資訊**
   - 追蹤文件的不同區段
   - 支援區段層級的查詢

## 遷移策略

### 步驟 1: 擴展現有結構（向後相容）
- 在現有 `Note` 介面中添加可選的位置資訊欄位
- 保持現有 API 不變，新增帶位置資訊的方法

### 步驟 2: 資料庫遷移
- 創建新的資料表結構
- 編寫遷移腳本，從現有資料提取位置資訊
- 逐步遷移現有資料

### 步驟 3: API 更新
- 提供新的 API 方法對齊 Obsidian
- 保持舊 API 的向後相容性
- 逐步棄用舊 API

## 範例：對齊後的查詢

```typescript
// 類似 Obsidian 的使用方式
const file = vault.getFileByPath('Projects/api-design.md');
const cache = vault.getFileCache(file);

// 取得所有連結（含位置）
cache.links?.forEach(link => {
  console.log(`Link to ${link.link} at line ${link.position.start.line}`);
});

// 取得所有標題
cache.headings?.forEach(heading => {
  console.log(`${'#'.repeat(heading.level)} ${heading.heading}`);
});

// 解析連結目標
const target = vault.getFirstLinkpathDest('api-design', 'current-file.md');
```

## 參考資料

- [Obsidian API: TFile](https://docs.obsidian.md/Reference/TypeScript+API/TFile)
- [Obsidian API: CachedMetadata](https://docs.obsidian.md/Reference/TypeScript+API/CachedMetadata)
- [Obsidian API: MetadataCache](https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache)
- [Obsidian API Type Definitions](https://github.com/obsidianmd/obsidian-api)
