# Claude 繁體中文補丁

這是一個給 macOS Claude 桌面版使用的繁體中文 UI 翻譯層。

本專案會補丁你自己 Mac 上已安裝的 `/Applications/Claude.app`。這個 repo 不包含、也不重新散佈 Claude.app、`app.asar`、Anthropic 原始碼、帳號資料、截圖、log、備份或任何本機 runtime 狀態。

## 功能

- 將 DOM 翻譯層注入 Claude 主要的 `claude.ai` Electron 視窗。
- 將系統 UI 翻成台灣繁體中文。
- 保留 `Claude`、`Cowork`、`Skills`、`Model` 與模型名稱等產品術語。
- 避免翻譯聊天內容、使用者輸入、提示正文、程式碼區塊、檔案路徑、URL、token、模型 id、最近/歷史標題。
- 提供 macOS 選單列小工具，可切換翻譯/取消翻譯。
- 提供 LaunchAgent，開啟 Claude 時自動喚醒選單列小工具。

## 需求

- macOS
- Claude 桌面版已安裝在 `/Applications/Claude.app`
- `PATH` 中可使用 Node.js
- 已安裝 Xcode Command Line Tools，可使用 `xcrun swiftc`

## 安裝

```bash
git clone https://github.com/JNSlayer2/claude-translation-tw.git
cd claude-translation-tw
npm install
bash scripts/install.sh
```

`install.sh` 會自動把 runtime 複製到 `$HOME/.local/share/claude-tw`，並用安全工作目錄啟動 proxy / helper / Claude main process，避免從 `Documents` 等受保護目錄繼承 `cwd` 而觸發 `EPERM: uv_cwd`。

安裝程式會把 runtime 檔案複製到：

- `$HOME/.local/share/claude-tw`
- `$HOME/Applications/ClaudeTW.app`
- `$HOME/Library/LaunchAgents/com.layer2.claude-tw.wake.plist`

接著會在本機補丁並重新簽章 `/Applications/Claude.app`。

## 下載

這個 repo 已設為 Public，所有人都可以下載。

- GitHub 頁面：[JNSlayer2/claude-translation-tw](https://github.com/JNSlayer2/claude-translation-tw)
- 直接下載 ZIP：[Download ZIP](https://github.com/JNSlayer2/claude-translation-tw/archive/refs/heads/main.zip)
- Releases 下載頁：[Releases](https://github.com/JNSlayer2/claude-translation-tw/releases)

## 驗證

```bash
bash scripts/diag.sh
bash scripts/verify-launch.sh
```

你應該會看到：

- `codesign` 驗證通過
- `CLAUDE_TW_PRELOAD_V1`、`CLAUDE_TW_MAIN_INJECT_V1`、`CLAUDE_TW_COWORK_SUPPORT_V1`、`CLAUDE_TW_COWORK_VM_V1` 都各出現一次
- proxy health 通過：`http://127.0.0.1:9223/health`
- `verify-launch.sh` 冷啟動後沒有新的 `launch-failure.err`

如果首次啟動看到 macOS Keychain 權限提示，這是重新簽章後的正常一次性授權流程，不是先前那個 `Claude Desktop failed to launch` crash dialog。

## 還原

```bash
bash scripts/restore.sh
```

patcher 會把 `app.asar` 與 `Info.plist` 備份在 `$HOME/.local/share/claude-tw/backups/`。

## 注意事項

Claude 更新後可能會替換 `app.asar`。更新 Claude 後請重新執行：

```bash
bash scripts/install.sh
bash scripts/verify-launch.sh
```

這是非官方的本機補丁。只應在你理解並接受「修改並 ad-hoc 簽章本機 app bundle」影響的電腦上使用。
