# Obsidian vs SecondBrain CLI Metadata 比較

## 概述

本文檔比較 Obsidian 程式內儲存的 metadata 與 SecondBrain CLI 儲存的 metadata 差異。

> **重要更新**: Obsidian 使用**分層架構**來組織 metadata：
> - **TFile**: 檔案外部資訊（檔案系統層級）
> - **CachedMetadata**: 檔案內部資訊（內容解析）
> 
> 詳細的對齊指南請參考 [obsidian-alignment-guide.md](./obsidian-alignment-guide.md)

## Obsidian 的 Metadata (CachedMetadata)

根據 Obsidian API (`obsidian.d.ts`)，Obsidian 在記憶體中快取的 metadata 包含以下結構：

```typescript
interface CachedMetadata {
  links?: LinkCache[];           // 連結（wikilinks）
  embeds?: EmbedCache[];          // 嵌入的檔案/圖片
  tags?: TagCache[];              // 標籤（包含位置資訊）
  headings?: HeadingCache[];      // 標題層級結構
  footnotes?: FootnoteCache[];    // 腳註
  blocks?: BlockCache[];          // 區塊 ID（用於區塊引用）
  frontmatter?: FrontMatterCache; // Frontmatter（位置資訊）
  sections?: SectionCache[];      // 文件區段
  listItems?: ListItemCache[];    // 列表項目
}
```

### 詳細說明

1. **LinkCache**: 包含連結目標、顯示文字、位置（行號、列號）
2. **EmbedCache**: 嵌入的檔案路徑、位置資訊
3. **TagCache**: 標籤名稱、位置（行號、列號）
4. **HeadingCache**: 標題文字、層級（H1-H6）、位置、可能的區塊 ID
5. **FootnoteCache**: 腳註定義和引用位置
6. **BlockCache**: 區塊 ID（用於 `^block-id` 引用）
7. **FrontMatterCache**: Frontmatter 的起始和結束位置
8. **SectionCache**: 文件的不同區段（frontmatter、內容等）
9. **ListItemCache**: 列表項目的層級、位置、任務狀態（checkbox）

### 特點

- **位置資訊豐富**: 每個元素都包含精確的行號、列號位置
- **結構化資訊**: 包含標題層級、列表層級等結構資訊
- **區塊引用支援**: 支援 Obsidian 的區塊引用功能
- **即時快取**: 在記憶體中維護，檔案變更時自動更新
- **不持久化**: 這些 metadata 不會寫入檔案，只存在於 Obsidian 的記憶體快取中

## SecondBrain CLI 的 Metadata

CLI 使用 **雙層結構**：與 Obsidian 對齊的 `files` + `content_metadata` + 位置表，以及相容舊版的 `notes` + `links`（可透過 `sb migrate` 遷移）。主要查詢與同步以新結構為準。

### 新結構：files + content_metadata（TFile / CachedMetadata 對齊）

**files**（對應 TFile / FileStats）：

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  basename TEXT NOT NULL,
  extension TEXT NOT NULL,
  parent TEXT,
  ctime INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL,
  content_hash TEXT NOT NULL
);
```

**content_metadata**（frontmatter 位置等）：

```sql
CREATE TABLE content_metadata (
  file_path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  frontmatter_start_line INTEGER, ...
);
```

**位置表**（含行/列/offset，對應 Obsidian CacheItem）：

- `links_with_positions`：連結目標、original、display_text、start/end line/col/offset
- `tags_with_positions`：tag、位置
- `headings_with_positions`：heading、level (1–6)、位置
- `blocks_with_positions`：block_id（區塊引用）
- `embeds_with_positions`：target_path、original、display_text、位置
- `sections_with_positions`：section_id、type、位置

### 舊結構（notes + links，遷移後仍可並存）

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  frontmatter TEXT NOT NULL,
  tags TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  ...
);

CREATE TABLE links (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id)
);
```

### 特點

- **持久化儲存**: SQLite 資料庫，可跨會話使用
- **Obsidian 對齊**: files/content_metadata + 位置表對齊 TFile / CachedMetadata
- **位置資訊**: 新結構中連結、標籤、標題、區塊、嵌入、區段皆含行/列/offset
- **雜湊追蹤**: content_hash 追蹤內容變更
- **時間戳記**: ctime/mtime（files）、created_at/modified_at（notes）

## 主要差異對照表

| 特性 | Obsidian | SecondBrain CLI |
|------|----------|-----------------|
| **儲存位置** | 記憶體快取 | SQLite 資料庫 |
| **持久化** | ❌ 不持久化 | ✅ 持久化 |
| **位置資訊** | ✅ 行號、列號 | ✅ 新結構（*_with_positions）含 line/col/offset |
| **標題結構** | ✅ 完整層級結構 | ✅ headings_with_positions（level 1–6） |
| **區塊引用** | ✅ 支援 | ✅ blocks_with_positions 儲存 block_id |
| **腳註** | ✅ 支援 | ❌ 不支援 |
| **列表結構** | ✅ 完整結構 | ❌ 不支援 |
| **嵌入檔案** | ✅ 追蹤 | ✅ embeds_with_positions |
| **連結解析** | 標題/路徑匹配 | ✅ 路徑/ID + links_with_positions |
| **雙向連結** | ✅ 自動計算 | ✅ 自動計算 |
| **時間戳記** | ❌ 無 | ✅ ctime/mtime（files） |
| **內容雜湊** | ❌ 無 | ✅ content_hash |
| **查詢效能** | 記憶體查詢 | ✅ SQL 索引優化 |

## 設計理念差異

### Obsidian
- **編輯器導向**: 專注於提供豐富的編輯體驗
- **即時性**: 需要精確的位置資訊來支援編輯功能（如跳轉、高亮）
- **結構化編輯**: 支援區塊引用、列表操作等進階功能
- **視覺化**: 需要完整的結構資訊來渲染預覽和圖表

### SecondBrain CLI
- **Agent 導向**: 專注於提供 LLM Agent 所需的結構化資料
- **查詢效能**: 使用 SQL 索引優化搜尋和關聯查詢
- **簡化抽象**: 移除編輯器特定的位置資訊，專注於內容和關係
- **可程式化**: 提供 JSON 輸出，方便程式化處理

## 實際影響

### Obsidian 有但 CLI 沒有的功能
1. **列表結構**: CLI 不追蹤列表的層級和結構（listItems）
2. **腳註**: CLI 不追蹤腳註定義和引用（footnotes）

### CLI 有但 Obsidian 沒有的功能
1. **持久化查詢**: CLI 的 SQLite 索引可跨會話使用
2. **內容雜湊**: CLI 使用雜湊值追蹤內容變更
3. **時間戳記**: CLI 記錄檔案的建立和修改時間
4. **ID 解析**: CLI 將連結解析為穩定的 ID，而非標題匹配

## 建議

### 如果需要在 CLI 中支援更多 Obsidian 功能
1. **列表結構**: 解析列表層級和任務狀態（listItems）
2. **腳註**: 追蹤腳註定義與引用（footnotes / footnoteRefs）

### 如果需要在 Obsidian 中使用 CLI 的功能
1. **內容雜湊**: 可透過 plugin 計算並儲存在 frontmatter
2. **時間戳記**: Obsidian 可透過檔案系統取得，但 CLI 的追蹤更精確
3. **ID 解析**: 可透過 plugin 實現類似的 ID 系統

## 參考資料

- [Obsidian API Documentation](https://docs.obsidian.md/)
- [Obsidian API Type Definitions](https://github.com/obsidianmd/obsidian-api)
- [Obsidian 對齊指南](./obsidian-alignment-guide.md)
- SecondBrain CLI: `src/types/index.ts`, `src/utils/database.ts`（`initTables` + `initObsidianTables`）, `src/utils/parser.ts`
