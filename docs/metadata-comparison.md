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

根據 `src/types/index.ts` 和 `src/utils/database.ts`，CLI 儲存在 SQLite 資料庫中的 metadata：

```typescript
interface Note {
  id: string;                    // content hash (sha256)
  path: string;                  // vault 中的相對路徑
  title: string;                // 筆記標題
  content: string;              // 完整內容
  frontmatter: Record<string, unknown>; // Frontmatter 物件
  tags: string[];               // 標籤陣列
  links: string[];               // 連結到的筆記 ID 陣列
  backlinks: string[];           // 連結到此筆記的筆記 ID 陣列
  hash: string;                  // 內容雜湊值
  createdAt: string;             // 建立時間 (ISO 8601)
  modifiedAt: string;            // 修改時間 (ISO 8601)
}
```

### 資料庫結構

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,           -- content hash
  path TEXT UNIQUE NOT NULL,     -- 相對路徑
  title TEXT NOT NULL,           -- 標題
  content TEXT NOT NULL,         -- 完整內容
  frontmatter TEXT NOT NULL,     -- JSON 字串化的 frontmatter
  tags TEXT NOT NULL,            -- JSON 字串化的標籤陣列
  hash TEXT NOT NULL,            -- 內容雜湊
  created_at TEXT NOT NULL,      -- 建立時間
  modified_at TEXT NOT NULL      -- 修改時間
);

CREATE TABLE links (
  source_id TEXT NOT NULL,       -- 來源筆記 ID
  target_id TEXT NOT NULL,       -- 目標筆記 ID
  PRIMARY KEY (source_id, target_id)
);
```

### 特點

- **持久化儲存**: 儲存在 SQLite 資料庫中，可跨會話使用
- **連結解析**: 將 wikilink 標題解析為筆記 ID，建立雙向連結關係
- **雜湊追蹤**: 使用 SHA256 追蹤內容變更
- **時間戳記**: 記錄檔案的建立和修改時間
- **簡化結構**: 不包含位置資訊，專注於內容和關係

## 主要差異對照表

| 特性 | Obsidian | SecondBrain CLI |
|------|----------|-----------------|
| **儲存位置** | 記憶體快取 | SQLite 資料庫 |
| **持久化** | ❌ 不持久化 | ✅ 持久化 |
| **位置資訊** | ✅ 行號、列號 | ❌ 無 |
| **標題結構** | ✅ 完整層級結構 | ❌ 僅提取標題文字 |
| **區塊引用** | ✅ 支援 | ❌ 不支援 |
| **腳註** | ✅ 支援 | ❌ 不支援 |
| **列表結構** | ✅ 完整結構 | ❌ 不支援 |
| **嵌入檔案** | ✅ 追蹤 | ❌ 不追蹤 |
| **連結解析** | 標題/路徑匹配 | ✅ ID 解析（更精確） |
| **雙向連結** | ✅ 自動計算 | ✅ 自動計算 |
| **時間戳記** | ❌ 無 | ✅ 建立/修改時間 |
| **內容雜湊** | ❌ 無 | ✅ SHA256 |
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
1. **區塊引用** (`^block-id`): CLI 無法追蹤或解析
2. **精確位置跳轉**: CLI 無法提供行號/列號資訊
3. **列表結構**: CLI 不追蹤列表的層級和結構
4. **腳註**: CLI 不追蹤腳註定義和引用
5. **嵌入檔案**: CLI 不追蹤嵌入的圖片或檔案

### CLI 有但 Obsidian 沒有的功能
1. **持久化查詢**: CLI 的 SQLite 索引可跨會話使用
2. **內容雜湊**: CLI 使用雜湊值追蹤內容變更
3. **時間戳記**: CLI 記錄檔案的建立和修改時間
4. **ID 解析**: CLI 將連結解析為穩定的 ID，而非標題匹配

## 建議

### 如果需要在 CLI 中支援更多 Obsidian 功能
1. **區塊引用**: 在 parser 中提取 `^block-id` 並儲存區塊 ID
2. **位置資訊**: 可選地儲存關鍵元素的位置（如標題、連結）
3. **列表結構**: 解析列表層級和任務狀態
4. **嵌入檔案**: 追蹤嵌入的檔案路徑

### 如果需要在 Obsidian 中使用 CLI 的功能
1. **內容雜湊**: 可透過 plugin 計算並儲存在 frontmatter
2. **時間戳記**: Obsidian 可透過檔案系統取得，但 CLI 的追蹤更精確
3. **ID 解析**: 可透過 plugin 實現類似的 ID 系統

## 參考資料

- [Obsidian API Documentation](https://docs.obsidian.md/)
- [Obsidian API Type Definitions](https://github.com/obsidianmd/obsidian-api)
- SecondBrain CLI Source Code: `src/types/index.ts`, `src/utils/database.ts`, `src/utils/parser.ts`
