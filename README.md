# SecondBrain CLI

一個專為 LLM Agent 設計的 Obsidian Vault CLI 工具。

## 功能特色

- **Dual-Storage 架構**: SQLite 索引 + 原始 Markdown 檔案
- **完整的連結系統**: 支援 `[[wikilinks]]`、backlinks、orphans 偵測
- **Agent-First 設計**: JSON 輸出、結構化資料、CLI 可 pipe
- **Obsidian 相容**: 100% 相容現有 Obsidian vault
- **標準化 Capture**: Template 系統強制 Agent 遵守格式

## 安裝

```bash
# npm registry（公開套件）
npm install -g @novis10813/secondbrain-cli
```

> 注意：此 CLI 目前使用 `bun:sqlite`，因此執行時需要 **Bun runtime**。如果你用 `npm` 安裝但系統沒有 `bun`，`sb` 會無法執行。

如果你用 `bun` 從 GitHub 安裝並看到 `Blocked ... postinstall/prepare`，需要先信任再重裝一次：

```bash
bun pm -g trust @novis10813/secondbrain-cli
bun add -g github:novis10813/secondbrain-cli#<tag>
```

## 快速開始

```bash
# 在 Obsidian vault 目錄初始化
cd ~/my-obsidian-vault
sb init

# 同步現有筆記
sb sync

# 建立新筆記
sb capture "這是筆記內容" --title="我的筆記" --tags="idea,work"

# 搜尋筆記
sb search "API 設計" --tags="tech" --format=json

# 取得 backlinks
sb backlinks <path-or-id>

# 取得 outlinks（此筆記連結出去的筆記）
sb outlinks <path-or-id>

# 找孤兒筆記
sb orphans
```

## CLI 指令

### 初始化與設定

```bash
sb init                              # 初始化 vault
sb config list                       # 查看設定
sb config get dailyNotesFolder       # 取得特定設定
sb config set dailyNotesFolder Daily # 修改設定
```

### 筆記管理

```bash
sb capture "內容" \                  # 建立筆記
  --title="標題" \
  --tags="tag1,tag2" \
  --template="meeting"

sb search "關鍵字" \                 # 搜尋
  --tags="work" \
  --limit=10 \
  --format=json

sb get <path-or-id>                  # 取得單一筆記（路徑或檔名）
sb backlinks <path-or-id>            # 取得 backlinks
sb outlinks <path-or-id>             # 取得 outlinks（此筆記連結出去的筆記）
```

### Vault 維護

```bash
sb sync                              # 同步索引
sb stats                             # 統計資訊
sb orphans                           # 孤兒筆記
sb migrate                           # 從舊 schema 遷移至新 schema（files + content_metadata）
```

## 資料架構

```
/your-vault/
├── Projects/
│   └── api-design.md               # 原始 Markdown
├── Daily/
│   └── 2024-01-15.md
└── .secondbrain/
    ├── config.json                 # 設定檔
    └── index.db                    # SQLite 索引
```

## 開發

```bash
# 安裝依賴
bun install

# 開發模式
bun run dev

# 建置
bun run build

# 檢查型別
bun run lint

# 執行測試
bun test
```

## License

MIT

## 發佈（npm registry）

1) 建立 GitHub Personal Access Token（classic 或 fine-grained 皆可）

- **最低需要**: `write:packages`（發佈）、`read:packages`（安裝）
- 如果 repo 是 private，通常也需要能讀取 repo 的權限（依你的帳號/組織設定而定）

2) 登入 npm registry 並發佈

```bash
npm login
npm publish --access public
```
