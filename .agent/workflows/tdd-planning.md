---
description: TDD planning and implementation workflow
---

# TDD Planning & Implementation Workflow

此 workflow 定義了如何以 TDD（測試驅動開發）方式進行功能規劃與實作。流程分為三個大階段：**討論設計** → **規劃** → **實作**。

---

## 階段一：充分了解需求（實作前）

開始之前，必須蒐集足夠的上下文：

1. 閱讀所有相關的程式碼檔案（功能模組、types、工具類）。
2. 閱讀現有的測試檔案，了解測試慣例與框架（測試檔案通常在 `tests/unit/` 或類似的資料夾中）。
3. 確認專案使用哪種測試框架（例如：`bun:test`、`vitest`、`jest`），以及如何執行測試（`bun test`、`npm test` 等）。

---

## 階段二：撰寫實作計畫（核心）

在開始寫程式之前，先以文件形式規劃好實作細節。這個階段是 TDD 的靈魂——**你必須在動程式碼之前，就清楚知道每一個測試案例長什麼樣子**。

---

### 2.1 Proposed Changes（擬修改的檔案）

列出本次所有要新增或修改的檔案，說明每個檔案的變動方向：

```
[NEW]    src/commands/template.ts       → 新增 sb template 指令組
[MODIFY] src/utils/config.ts            → 新增 getTemplateConfig / setTemplateConfig 方法
[MODIFY] src/types/index.ts             → 新增 TemplateConfig interface
[MODIFY] src/commands/capture.ts        → 移除 --path，加入路徑解析邏輯
```

---

### 2.2 TDD Phase 拆分原則

每個 Phase 必須滿足**原子化**原則：

> **一個 Phase = 一個程式單元（單一函式、單一 class method、單一 CLI 指令）的 Red → Green 循環**

不允許一個 Phase 同時修改多個不相關的邏輯，這樣才能確保每次 test 失敗時，你能精確定位問題所在。

---

### 2.3 每個 Phase 的標準格式

計畫中的每個 Phase 必須包含以下三個子段落：

#### 🔴 Red（先寫的失敗測試）

詳細列出要在哪個 test 檔案、哪個 `describe` 區塊中，新增哪些 `it(...)` 測試案例，並寫出測試的**具體邏輯與期望值**：

```
測試檔案: tests/unit/config.test.ts
describe 區塊: describe('template config', ...)

- it('getTemplateConfig 在沒有設定時應回傳 undefined')
  → 呼叫 configManager.getTemplateConfig('no-exist')
  → expect: undefined

- it('setTemplateConfig 應寫入 templates[name].targetFolder')
  → 呼叫 setTemplateConfig('meeting', { targetFolder: 'Meetings' })
  → 讀回 config.templates['meeting'].targetFolder
  → expect: 'Meetings'
```

測試案例要細到讓人一眼就能動手實作，不能只寫「測試 X 功能」這種模糊描述。

#### 🟢 Green（使測試通過的最小實作）

說明要在哪個檔案、新增或修改什麼，使上面的 Red tests 通過。
**只做讓測試通過所需的最少工作**，不要在此阶段超額實作：

```
修改檔案: src/utils/config.ts
新增方法:
  getTemplateConfig(name: string): TemplateConfig | undefined
    → return this.getConfig().templates?.[name]

  setTemplateConfig(name: string, config: TemplateConfig): void
    → 讀取 config → 設定 config.templates[name] → 寫回磁碟
```

#### ✅ Verify（自動驗證指令）

列出這個 Phase 結束後要執行的確認指令：

```bash
# 只跑這個 Phase 相關的測試
bun test tests/unit/config.test.ts

# 確認沒有回歸（可視情況省略，留到最後 Phase 一起做）
bun test
```

---

### 2.4 Phase 分類範例

以下是常見的 Phase 分法，可依實際需求調整：

| Phase | 對象 | 說明 |
|---|---|---|
| Phase 1 | Types / Interfaces | 型別定義不含邏輯，可以不需要 TDD，直接修改 |
| Phase 2 | Utility class 的新方法 | 每個方法一個 Red→Green 循環 |
| Phase 3 | 新的 CLI 指令 | 每個子指令（list/get/set）可各自一個循環 |
| Phase 4 | 既有指令的行為修改 | 修改邏輯分支時，每條分支各一個循環 |
| Phase 5 | 最終驗證 | 全測試 + lint，無 Red→Green 循環 |

---

### 2.5 Verification Plan（整體驗證計畫）

計畫的最後，列出全部完成後的驗證指令及手動測試範例：

```bash
# 自動化
bun test                    # 完整測試套件
bun run lint                # 型別 + lint 檢查

# 手動驗證（CLI 範例）
sb template set meeting --folder "Meetings"
sb template get meeting     # 預期輸出：{ "targetFolder": "Meetings" }
sb capture "筆記" --template meeting  # 應存入 Meetings/筆記.md
```

---

## 階段三：執行實作（TDD 流程）

按照計畫逐一執行，每個 Phase 的嚴格順序如下：

### Phase 開始：先寫失敗 Tests

1. 在適當的 test 檔案中新增測試案例（使用 `describe` / `it` 區塊）
2. 執行測試，**確認新案例確實失敗**：
   ```bash
   bun test tests/unit/<相關的 test 檔案>.ts
   ```
3. 如果新測試竟然通過了（代表功能已存在），重新審視測試是否有效。

### Phase 中間：實作程式碼

4. 在實際的程式碼中實作功能（新增方法、修改邏輯等）。
5. 執行測試，**確認所有案例通過**：
   ```bash
   bun test tests/unit/<相關的 test 檔案>.ts
   ```

### Phase 結束：確認不影響既有功能

6. 在每個 Phase 完成後，執行全部測試套件確認沒有回歸：
   ```bash
   bun test
   ```

---

## 階段四：最終驗證

所有 Phase 完成後：

1. 執行完整測試套件：
   ```bash
   bun test
   ```

2. 執行型別與 lint 檢查：
   ```bash
   bun run lint
   ```

3. 確認所有測試通過且 lint 無錯誤後，實作完成。

---

## 重要原則

- **不跳過「失敗確認」步驟**：先看到 test 失敗，才能確定 test 是有意義的。
- **小步前進**：每個 Phase 只聚焦在一個邏輯單元，避免一次改動太多。
- **不污染現有測試**：新的 test 案例應該加在適當的 `describe` 區塊中，或建立新的 test 檔案。
- **測試用語言與專案一致**：test 描述文字用専案慣用語言（如中文 `描述行為` 或英文 `should do X`）。