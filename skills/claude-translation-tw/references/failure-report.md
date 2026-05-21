# 失敗經驗報告：Claude 繁體中文補丁

這是一份去識別化的公開版摘要，記錄失敗路線與最後可行的架構。內容刻意移除本機使用者名稱、機器專屬路徑、截圖、log、帳號識別資訊與私有 runtime 狀態。

## 失敗路線

### CDP / Remote Debugging

最初計畫使用 Chrome DevTools Protocol 連到 Claude 桌面版，從外部執行 DOM 翻譯。

結果：

- Claude 桌面版沒有穩定接受 `--remote-debugging-port`。
- 每次啟動都要帶 flag，流程很脆弱。
- 需要每次 launch 協調，不符合一般使用者工作流。

結論：

不要把 CDP 當成這個補丁的主要路線。

### 只靠 Preload 注入

第二條路線是在 `mainView.js` 注入 preload block，嘗試從本機 filesystem 讀翻譯檔。

結果：

- sandbox preload 不能穩定使用 Node filesystem API。
- preload block 可以證明自己執行過，但無法穩定載入 translator 和 dictionary。

結論：

只保留輕量 preload sentinel。不要依賴 preload filesystem access。

### Parent-Level DOM 標記

早期 DOM translator 會把父元素標記成已翻譯。

結果：

- Settings row 常常同時包含標題與說明文字。
- 父元素被標記後，標題翻了，但說明文字會被跳過。

結論：

要追蹤個別 text node，不要只標記父元素。

## 可行架構

- 補丁 `/Applications/Claude.app/Contents/Resources/app.asar`。
- 在 `.vite/build/mainView.js` 保留輕量 `CLAUDE_TW_PRELOAD_V1` marker。
- 在 `.vite/build/index.js` 注入 `CLAUDE_TW_MAIN_INJECT_V1`。
- 從 main process 在 `dom-ready` 時把 `translator.js` 注入真正的 `claude.ai` `WebContentsView`。
- 透過 `http://127.0.0.1:9223` 提供 runtime state 與 overrides。
- 使用 macOS 選單列 helper 提供 `翻譯`、`取消翻譯`、`結束小精靈`。
- 使用 LaunchAgent 在 Claude 執行時喚醒 helper。

## Cowork 修復

修改 `app.asar` 並 ad-hoc 簽章後，Cowork 可能出現假的 invalid-installation 錯誤。

可行補丁只繞過以下兩處的 `entitlement_missing`：

- Cowork support-status check
- VM startup entitlement check

接著必須依序簽章：

```bash
codesign --force --deep --sign - /Applications/Claude.app
codesign --force --sign - --entitlements "$HOME/.local/share/claude-tw/claude-entitlements.plist" /Applications/Claude.app
codesign --verify --deep --strict /Applications/Claude.app
```

不要把 virtualization entitlement plist 用 `--deep` 套到 nested Electron helpers。

## 翻譯經驗

- 只翻系統 UI。
- 避免翻譯聊天內容、使用者輸入、最近/歷史標題、程式碼區塊、檔案路徑、URL、token、model id 與 OAuth scopes。
- 保留 `Claude`、`Cowork`、`Skills`、`Model`、模型名稱等產品術語。
- 高頻 UI 優先使用 exact-string overrides。
- 對空狀態、建議卡、Customize overview、Live artifacts 等區塊，允許人工字典 exact match 穿過一般 UI selector 限制。
- machine fallback 套用前要修成台灣繁體中文用語。

## 驗證標準

靜態檢查不夠。成功補丁必須視覺確認：

- 主畫面
- Composer 與加號選單
- Cowork Projects
- Customize
- Settings 詳細頁
- 翻譯開啟與取消翻譯行為
