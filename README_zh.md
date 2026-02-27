## SecondBrain CLI（中文說明）

SecondBrain CLI 是一個讓 LLM Agent 與進階使用者可以安全操作 Obsidian Vault 的指令工具。
它在不破壞原有 Markdown 檔案的前提下，建立一個 SQLite 索引，讓搜尋、連結分析與
自動化流程變得更容易。

> 說明以英文版 `README.md` 為主，若有內容不一致，請以英文版本為準。

## 功能特色

- **雙層儲存架構**：保留原始 Markdown 檔案，額外用 SQLite 建立索引
- **完整連結系統**：支援 `[[wikilinks]]`、backlinks、outlinks、孤兒筆記偵測
- **Agent-First 設計**：所有查詢都可以輸出 JSON，方便給 LLM 或其他工具使用
- **Obsidian 相容**：資料結構對齊 TFile / CachedMetadata，不會破壞現有 vault
- **標準化 Capture**：透過 template 系統，讓 Agent 輸出的筆記結構一致

## 安裝

```bash
npm install -g @novis10813/secondbrain-cli
```

- 需要 **Node.js 18+**
- 建議在開發此 repo 時使用 **Bun** 來跑測試與開發指令（`bun test`, `bun run dev`）

安裝完成後可以直接使用 `sb` 這個全域指令。

## 快速開始

```bash
# 1) 在現有的 Obsidian vault 目錄初始化
cd ~/my-obsidian-vault
sb init

# 2) 建立與更新 SQLite 索引
sb sync

# 3) 建立一筆新筆記（含標題與標籤）
sb capture "這是筆記內容" \
  --title="我的筆記" \
  --tags="idea,work"

# 4) 搜尋筆記（輸出 JSON 給 Agent 使用）
sb search "API 設計" --tags="tech" --format=json

# 5) 查看 backlinks / outlinks
sb backlinks <path-or-id>
sb outlinks <path-or-id>

# 6) 解析 linkpath 成 path:line:col（給編輯器或外部工具導航）
sb open "My Note#Section"

# 7) 找出孤兒筆記（沒有連入/連出的檔案）
sb orphans
```

`<path-or-id>` 可以是：
- vault 內相對路徑（例如 `Projects/api-design.md`）
- 可以唯一辨識的檔名（basename）

## 指令群組總覽

SecondBrain CLI 將功能拆成幾個核心指令群組，每個群組都有對應的英文文件（位於
`docs/` 資料夾）：

- **Vault 管理**：`sb vault ...` — 多 vault 註冊與 active vault 切換  
  對應文件：`docs/vault.md`
- **同步索引**：`sb sync` — 掃描 Markdown 檔案並更新 SQLite 索引  
  對應文件：`docs/sync.md`
- **Capture 與模板**：`sb capture`, `sb template ...` — 建立新筆記與套用模板  
  對應文件：`docs/capture.md`, `docs/template.md`
- **搜尋**：`sb search` — 依名稱、標籤、路徑前綴、連結、標題、修改時間等條件搜尋  
  對應文件：`docs/search.md`
- **連結與導航**：`sb backlinks`, `sb outlinks`, `sb open` — 連結圖譜與位置導航  
  對應文件：`docs/backlinks.md`, `docs/open.md`
- **設定與維護**：`sb config`, `sb stats`, `sb orphans`, `sb migrate`  
  對應文件：`docs/config.md`, `docs/stats.md`, `docs/migrate.md`

若你想深入瞭解內部實作與資料結構，可以參考英文技術文件：

- `docs/architecture.md` — 整體架構與資料流
- `docs/modules.md` — 各個 utility 與指令模組說明
- `docs/database-schema.md` — SQLite 資料表結構
- `docs/metadata-comparison.md` — Obsidian vs CLI metadata 對照
- `docs/obsidian-alignment-guide.md` — 與 Obsidian API 對齊的細節

## 開發（此 repo）

```bash
# 安裝依賴
bun install

# 從原始碼執行 CLI
bun run dev

# 編譯 TypeScript 到 dist/
bun run build

# 僅檢查型別
bun run lint

# 執行測試
bun test
```

此專案以 Bun 為主要開發環境，但發佈到 npm 的套件可在一般 Node.js 18+ 環境使用。

## 授權條款

MIT

