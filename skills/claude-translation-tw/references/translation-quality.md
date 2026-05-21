# 翻譯品質筆記

目前 Claude 繁體中文補丁可運作，但語意品質仍需持續打磨。這份文件是後續 iteration 的品質 backlog。

## 已知弱點

- 未命中字典的字串會 fallback 到 Google Translate，語意品質不穩。
- 長篇設定說明、帳號/帳務文字、popover、menu item 與動態 label 覆蓋率仍可能不足。
- 產品名稱與模型名稱有時會被機器翻譯誤傷。
- `Model`、`Models`、`Legacy Model`、`Skills`、`Cowork` 預設應保留為產品術語，除非使用者明確要求本地化。
- 混合語言字串可能變得不順，例如 `More options for ...` 或 model selector。
- Proper noun、使用者名稱、帳號名稱應保留，不應翻譯。
- 重複歷史項目中的文字可能是使用者自訂標題，篩選要保守。

## 台灣用語偏好

除非產品本身使用英文，否則使用台灣繁體中文：

- Chat：聊天
- Cowork：Cowork；若是一般說明可用「協作」，產品 mode label 優先保留 `Cowork`
- Code：程式碼
- Claude Code：Claude Code
- New chat：新增聊天
- New session：新增對話
- Recents：最近
- Projects：專案
- Artifacts：Artifacts 或成果物，避免「文物」
- Customize：自訂
- Appearance：外觀
- Settings：設定
- Account：帳號
- Privacy：隱私
- Billing：帳務或計費
- Usage：用量
- Capabilities：功能
- Connectors：連接器
- Extensions：擴充功能
- Developer：開發者
- Desktop app：桌面應用程式
- Revoke access：撤銷存取權
- Pull request：Pull request 或 PR，開發者頁面避免「拉取請求」
- Worktree：worktree 或工作樹；若旁邊有 Git 術語，可保留 `worktree`
- Prompt：提示詞
- Model：selector 與產品介面保留 `Model`；清楚是說明文字時才用「模型」
- Adaptive：自適應
- Extra high：極高
- Bypass permissions：略過權限

## 應保留的術語

除非 UI 明確需要解釋，不要翻譯：

- Claude
- Claude Code
- Claude Max
- Cowork
- Skills
- Skill
- Model
- Models
- Legacy Model
- Opus
- Sonnet
- Haiku
- Max
- Pro
- Git
- GitHub
- PR
- MCP
- URL
- API
- user: scopes
- 檔案路徑
- branch names
- model ids
- account names and usernames

## 篩選規則

translator 不應翻譯：

- Composer 內的使用者實際輸入與 prompt body
- Assistant/user transcript content
- Recent/history titles 與 task titles
- `textarea`、`input`、`contenteditable`、`code`、`pre`、`kbd`、`samp`
- URL、email、file path、branch、token、scope 類字串
- application scopes 或 auth metadata 表格欄位
- Recent chat titles，除非使用者明確要求翻歷史標題

translator 應翻譯：

- 側欄按鈕與 label
- menu 與 menu item
- tooltip 與 aria-label
- placeholder
- dialog title 與 button
- Settings navigation 與 setting title
- Settings row description，包含 toggle 下方長說明
- popover 與 command label
- empty-state 與 onboarding UI
- 人工字典中的 exact-match 字串，即使不在一般 UI selector 內，例如主頁標題、建議卡、project empty state、Live artifacts empty state、Customize overview card。仍需先套用 transcript/input/code 排除規則。

機器翻譯 fallback 套用前，要先修成台灣用語。已知替換包含：`插件` → `外掛`、`文件` → `檔案`、`文件夾` → `資料夾`、`屏幕` → `螢幕`、`鼠標` → `滑鼠`、`默認` → `預設`、`登錄` → `登入`。

## Cowork 專項檢查

補丁並 ad-hoc 簽章 Claude.app 後，Cowork 可能在兩個不同位置失敗：

- 開 Cowork 顯示 `Invalid installation`：來自 Cowork support-status entitlement check。
- Cowork 開啟後顯示 `Failed to start Claude's workspace`：來自 VM startup entitlement check。

當 native check 回傳 `entitlement_missing` 時，這兩者對本機補丁 app 來說是 false failure。patcher 只應繞過這個值，其他 virtualization errors 必須保留。

若 Cowork 接著顯示 `VZErrorDomain Code=2` 且缺 `com.apple.security.virtualization`，代表 support gates 已修好，但最上層 Claude app 仍需要 virtualization entitlement。先正常 re-sign nested code，再只對 `/Applications/Claude.app` 套 entitlement plist。不要 deep-sign 每個 helper。

## Override 策略

高頻 UI 優先寫進 `overrides.json`。先加 exact-string entry，再考慮有保護條件的 phrase replacement。

在 `/settings` 頁面，優先使用完整 exact full-string override 與完整句翻譯。不要讓 `General` 這類短字或 `Claude` 這類 identity-preserved term 壓掉完整句翻譯。

逐一追蹤 translated text nodes。Settings row 常常同時有 title 與 description；如果只在 parent level 標記「已翻譯」，description 會被跳過。

好的 override 候選：

- `More options for {title}` patterns
- `Your plan ends in {n} days`
- `How can I help you today?`
- `Write your prompt to Claude`
- `Add files, connectors, and more`
- Settings labels and toggles
- Permission and notification labels

避免對 `Max`、`Code`、`Local`、`Light`、`Dark` 這類短字做廣泛替換，除非上下文很清楚。否則容易讓產品名稱漂移。

## 驗證期望

每次品質 iteration 都應包含：

- 主畫面視覺檢查
- New chat composer 檢查
- Settings navigation 檢查
- 至少一個 Settings detail page 檢查
- 取消翻譯 restore 檢查

若 injection 與 toggle 已正常，但仍有零星英文，應回報為品質 backlog，而不是補丁失敗。
