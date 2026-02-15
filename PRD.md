------

📦 SecondBrain CLI - 完整規格
技術架構

- 語言：TypeScript
- 執行：Bun/Node.js，單一 CLI 執行檔
- 儲存：SQLite 索引 + 原始 Markdown 檔案
- 輸出：JSON 為主（--format json|text）
- 安裝：npm install -g secondbrain-cli 或 bun install secondbrain-cli

---

核心資料模型
// Note Entity
{
  "id": "sha256-hash",           // content hash
  "path": "projects/api-design.md",
  "title": "API Design Notes",
  "content": "...",
  "frontmatter": {
    "tags": ["tech", "backend"],
    "created": "2024-01-15",
    "template": "meeting"
  },
  "links": ["note-id-1", "note-id-2"],      // 外連
  "backlinks": ["note-id-3"],               // 被誰連結
  "hash": "abc123..."                       // 內容 hash
}
---

CLI 指令集

# 🔧 設定

sb init                                    # 初始化 vault（建立 .secondbrain/）
sb config set daily-notes-folder "Daily"   # 設定每日筆記資料夾
sb config set templates-folder "Templates" # 模板資料夾

# 📝 Capture - 寫入（強制規範）

sb capture "會議內容..." \
  --template="meeting" \
  --tags="work,backend" \
  --title="API 設計討論"
sb capture daily "今天學到的..."           # 自動存到 Daily/2024-01-15.md

# 🔍 Retrieve - 檢索

sb search "API 設計" --tags="tech" --limit=10 --format=json
sb get <note-id>                           # 取得單一筆記完整內容
sb backlinks <note-id>                     # 誰連結到這篇
sb orphans                                 # 沒有被連結的筆記

# 🔗 Link 管理

sb link create <from-id> <to-id>           # 建立雙向連結
sb link remove <from-id> <to-id>
sb graph --export --format=dot             # 匯出連結圖（Graphviz）

# 🛠️ 品質檢查

sb lint                                    # 檢查格式問題

# 輸出: {"issues": [{"noteId": "...", "type": "missing-tags", "severity": "warning"}]}

sb fix                                     # 自動修復（加預設 tags、補 frontmatter）

# 📊 維護

sb sync                                    # 重新掃描 vault，更新索引
sb stats                                   # vault 統計（筆記數、連結數、孤兒數）
---

特色功能

1. Template 系統（解決 Agent 格式問題）

# 在 .secondbrain/templates/meeting.md

---

tags: [meeting]
date: {{date}}
participants: {{participants}}
---

# {{title}}

## 討論內容

{{content}}

## 行動項目

- [ ]
Agent 呼叫時必須提供必填欄位，否則 CLI 會回傳錯誤：
{error: Missing required field: 'participants', template: meeting}

2. Content Hash 作為 ID

- 筆記內容變動 → hash 改變 → 視為新筆記
- 方便版本追蹤與去重複

3. 每日筆記自動化
sb capture daily "學到的新東西"

# 自動建立/附加到 Daily/2024-01-15.md

# 可設定範本（如標準 Daily Log 格式）

---
輸出範例
$ sb search "API" --tags="tech" --limit=2
{
  query: API,
  filters: {tags: [tech]},
  results: [
    {
      id: a3f7...,
      title: REST API Best Practices,
      path: tech/rest-api.md,
      excerpt: ...API versioning strategies...,
      tags: [tech, backend],
      links_count: 5,
      backlinks_count: 3,
      score: 0.95
    }
  ],
  total: 15
}
