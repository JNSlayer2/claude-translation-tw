---
name: claude-translation-tw
description: 當需要補丁、修復、改善或驗證本機 macOS Claude.app 繁體中文翻譯層時使用，包含 app.asar 注入、ClaudeTW 選單列控制、翻譯品質、還原與實機 UI 驗證。
metadata:
  short-description: 將 Claude.app UI 補丁成繁體中文
---

# Claude 繁體中文翻譯補丁

當使用者想把本機 macOS Claude 桌面版翻成繁體中文、Claude 更新後需要修補、或想改善翻譯覆蓋率時使用這個 skill。

## 公開版 Runtime 位置

- Claude app：`/Applications/Claude.app`
- 補丁根目錄：`$HOME/.local/share/claude-tw`
- 選單列控制器：`$HOME/Applications/ClaudeTW.app`
- 自動喚醒 LaunchAgent：`$HOME/Library/LaunchAgents/com.layer2.claude-tw.wake.plist`

## 核心經驗

Claude 桌面版的主 UI 是從 `claude.ai` 載入到 Electron `WebContentsView`。只改本機 i18n 檔案不足以處理聊天主介面。

CDP 路線不可靠，因為 Claude 桌面版可能不吃 `--remote-debugging-port`。優先使用 `app.asar` 的 main process 注入。

只靠 preload 也不夠，因為 sandbox preload 不能穩定使用 `require('node:fs')` 讀取本機檔案。可行路線是在 `dom-ready` 時，從 main process 把 `translator.js` 注入真正的 Claude `WebContentsView`。

把原始碼注入 minified code 時，要用 `String.replace(needle, () => replacement)`。不能用一般 replacement string，否則像 `$&` 這類 regex replacement token 會被展開，破壞注入內容。

## Cowork 檢查

補丁並 ad-hoc 簽章後，Cowork 可能出現假的 entitlement 錯誤：

- support status 回報 `virtualization_entitlement_missing`
- VM 啟動路徑回報 Claude 安裝已被修改

只繞過這兩個已知檢查中的 `entitlement_missing`。其他 unsupported platform、unsupported OS、architecture 與真實 virtualization 錯誤都要保留。

先正常簽章 nested code：

```bash
codesign --force --deep --sign - /Applications/Claude.app
```

再只對最上層 Claude bundle 套 virtualization entitlement：

```bash
codesign --force --sign - --entitlements "$HOME/.local/share/claude-tw/claude-entitlements.plist" /Applications/Claude.app
```

不要把 entitlement plist 用 `--deep` 套到每個 Electron helper/framework。

## 補丁流程

```bash
npm install
bash scripts/install.sh
```

Claude 更新後修復：

```bash
node scripts/patch-asar.mjs
codesign --force --deep --sign - /Applications/Claude.app
codesign --force --sign - --entitlements "$HOME/.local/share/claude-tw/claude-entitlements.plist" /Applications/Claude.app
codesign --verify --deep --strict /Applications/Claude.app
```

## 驗證

不要只靠靜態檢查就回報成功。必須看真實 app UI。

靜態檢查：

```bash
bash scripts/diag.sh
bash scripts/verify-launch.sh
```

視覺檢查：

- 主畫面：側欄、composer placeholder、建議卡、加號選單。
- Cowork Projects：空狀態標題、按鈕，且不能出現 invalid-installation modal。
- Customize：overview 卡片、connector/plugin/Skills 標籤；`Skills` 保留英文。
- Settings：導覽、桌面設定、Code/Cowork 頁與長說明文字。
- 取消翻譯：選單列 helper 應停止新翻譯，並盡可能還原已快取的節點。

若從 `Documents` 或其他受保護目錄手動執行補丁，啟動腳本仍必須先切回 `$HOME` 再喚起 Claude binary。否則 Electron 可能在啟動時因 `process.cwd()` 命中受保護目錄而丟出 `EPERM: uv_cwd`，並被 `index.pre.js` 包成 `Claude Desktop failed to launch`。

## 翻譯規則

只翻系統 UI。避免翻譯使用者對話、使用者輸入、最近/歷史標題、提示正文、程式碼、檔案路徑、URL、token、model id、app 名稱與 scope 類字串。

除非 UI 明確需要解釋，否則保留下列產品與模型術語：

- `Claude`
- `Claude Code`
- `Claude Max`
- `Cowork`
- `Skills`
- `Model`
- `Models`
- `Legacy Model`
- `Opus`
- `Sonnet`
- `Haiku`
- `Max`
- `Pro`
- `GitHub`
- `MCP`
- `PR`
- `API`
- `URL`

優先使用台灣繁體中文用語：

- `外掛`，不要用 `插件`
- `檔案`，不要用 `文件`
- `資料夾`，不要用 `文件夾`
- `螢幕`，不要用 `屏幕`
- `滑鼠`，不要用 `鼠標`
- `預設`，不要用 `默認`
- `登入`，不要用 `登錄`

## 還原

```bash
bash scripts/restore.sh
```

備份會放在 `$HOME/.local/share/claude-tw/backups/`。
