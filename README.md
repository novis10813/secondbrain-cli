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
# 使用 npm
npm install -g secondbrain-cli

# 或使用 bun
bun install secondbrain-cli
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
sb backlinks <note-id>

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

sb get <note-id>                     # 取得單一筆記
sb backlinks <note-id>               # 取得 backlinks
```

### Vault 維護

```bash
sb sync                              # 同步索引
sb stats                             # 統計資訊
sb orphans                           # 孤兒筆記
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

# 執行測試
bun test
```

## License

MIT
