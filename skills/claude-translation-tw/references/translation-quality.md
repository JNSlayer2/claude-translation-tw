# Translation Quality Notes

The current Claude Traditional Chinese patch is operational but not linguistically finished. Treat this as the quality backlog for future iterations.

## Known Weaknesses

- Semantic quality is uneven because uncaught strings fall back to Google Translate.
- Coverage is incomplete for long settings descriptions, account/billing text, popovers, menu items, and dynamically generated labels.
- Product names and model names are sometimes machine-translated incorrectly.
- `Model`, `Models`, `Legacy Model`, `Skills`, and `Cowork` should be preserved as product terms unless the user explicitly requests localized labels.
- Some mixed-language strings become awkward, such as "More options for ..." or model selectors.
- Some proper nouns and usernames are translated when they should be preserved.
- Text inside repeated history items may be translated even when the title is user-authored; keep this conservative.

## Preferred Taiwan Terms

Use Taiwan Traditional Chinese wording unless the product itself uses English.

- Chat: 聊天
- Cowork: Cowork or 協作, prefer keeping `Cowork` when it is a product mode label.
- Code: 程式碼
- Claude Code: Claude Code
- New chat: 新增聊天
- New session: 新增對話
- Recents: 最近
- Projects: 專案
- Artifacts: Artifacts or 成果物, avoid `文物`.
- Customize: 自訂
- Appearance: 外觀
- Settings: 設定
- Account: 帳號
- Privacy: 隱私
- Billing: 帳務 or 計費
- Usage: 用量
- Capabilities: 功能
- Connectors: 連接器
- Extensions: 擴充功能
- Developer: 開發者
- Desktop app: 桌面應用程式
- Revoke access: 撤銷存取權
- Pull request: Pull request or PR, avoid `拉取請求` in developer-heavy areas.
- Worktree: worktree or 工作樹; keep `worktree` if shown beside Git terms.
- Prompt: 提示詞
- Model: keep `Model` in selectors and account/product surfaces; use `模型` only in explanatory prose when clearly not a product label.
- Adaptive: 自適應
- Extra high: 極高
- Bypass permissions: 略過權限

## Terms To Preserve

Do not translate these unless the UI clearly needs a localized explanatory label:

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
- file paths
- branch names
- model ids
- account names and usernames

## Filtering Rules To Improve

The translator should not translate:

- Composer text and prompt body
- Assistant/user transcript content
- Recent/history titles and task titles
- `textarea`, `input`, `contenteditable`, `code`, `pre`, `kbd`, `samp`
- URL, email, file path, branch, token, and scope-like strings
- Table cells containing application scopes or auth metadata
- Recent chat titles unless the user explicitly wants history titles translated

The translator should translate:

- Sidebar buttons and labels
- Menus and menu items
- Tooltips and aria-labels
- Placeholders
- Dialog titles and buttons
- Settings navigation and setting titles
- Settings row descriptions, including long explanatory text under toggles
- Popovers and command labels
- Empty-state and onboarding UI
- Curated exact-match strings outside the usual UI selectors, such as main-page headings, suggestion cards, project empty states, Live artifacts empty states, and Customize overview cards. Keep transcript/input/code filters in front of this exact-match allowance.

Post-process machine translation fallback into Taiwan wording before applying it. Known replacements include `插件` to `外掛`, `文件` to `檔案`, `文件夾` to `資料夾`, `屏幕` to `螢幕`, `鼠標` to `滑鼠`, `默認` to `預設`, and `登錄` to `登入`.

## Cowork-Specific Checks

After patching and ad-hoc signing Claude.app, Cowork may fail in two separate places:

- Opening Cowork shows `Invalid installation`; this comes from the Cowork support-status entitlement check.
- Cowork opens but shows `Failed to start Claude's workspace`; this comes from the VM startup entitlement check.

Both are false failures for this local patched app when the native check returns `entitlement_missing`. The patcher should bypass only that value and preserve all other virtualization errors.

If Cowork then shows `VZErrorDomain Code=2` with missing `com.apple.security.virtualization`, the support gates are fixed but the top-level Claude app still needs the virtualization entitlement. Re-sign nested code normally, then sign only `/Applications/Claude.app` with the entitlement plist. Do not deep-sign every helper with the entitlement plist.

## Override Strategy

Prefer `overrides.json` for all high-frequency UI strings. Add exact-string entries first, then guarded phrase replacements only when safe.

On `/settings` pages, prefer exact full-string overrides and full-sentence translation. Do not let broad partial replacements such as `General` or identity-preserved terms such as `Claude` suppress full-sentence translation.

Track translated text nodes individually. A single settings row often contains a title and a description in the same parent container; parent-level "already translated" markers cause the description to be skipped.

Good override candidates:

- `More options for {title}` patterns
- `Your plan ends in {n} days`
- `How can I help you today?`
- `Write your prompt to Claude`
- `Add files, connectors, and more`
- Settings labels and toggles
- Permission and notification labels

Avoid broad replacements for short words like `Max`, `Code`, `Local`, `Light`, and `Dark` unless context is known. These cause product-name drift and poor output.

## Verification Expectations

Every quality iteration should include:

- Main screen visual check
- New chat composer check
- Settings navigation check
- At least one settings detail page check
- Toggle-off restore check

Report remaining English strings as a quality backlog, not as a patch failure, if injection and toggling work.
