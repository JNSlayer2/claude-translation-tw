---
name: claude-translation-tw
description: Use when patching, repairing, improving, or verifying the local macOS Claude.app Traditional Chinese translation layer, including app.asar injection, ClaudeTW menubar control, translation quality, rollback, and real UI verification.
metadata:
  short-description: Patch Claude.app UI into Traditional Chinese
---

# Claude Traditional Chinese Translation

Use this skill when the user wants the local macOS Claude desktop app translated into Traditional Chinese, wants the patch repaired after an app update, or wants translation coverage improved.

## Public Runtime Layout

- Claude app: `/Applications/Claude.app`
- Patch root: `$HOME/.local/share/claude-tw`
- Menubar controller: `$HOME/Applications/ClaudeTW.app`
- Wake LaunchAgent: `$HOME/Library/LaunchAgents/com.layer2.claude-tw.wake.plist`

## Core Lessons

Claude desktop loads the main UI from `claude.ai` in an Electron `WebContentsView`. Local i18n files are not enough for the chat UI.

The CDP route is unreliable because Claude desktop may ignore `--remote-debugging-port`. Prefer `app.asar` main-process injection.

The preload-only route is insufficient because sandbox preload cannot reliably read local files with `require('node:fs')`. The working route injects `translator.js` into the real Claude `WebContentsView` on `dom-ready`.

When injecting source into minified code, use `String.replace(needle, () => replacement)`. A plain replacement string can corrupt injected source because regex replacement tokens like `$&` are expanded.

## Cowork Checks

Ad-hoc signing after patching can trigger false Cowork entitlement failures:

- Support status can report `virtualization_entitlement_missing`.
- VM startup can report that Claude's installation was modified.

Bypass only `entitlement_missing` in those two known checks. Preserve unsupported platform, unsupported OS, architecture, and real virtualization failures.

Sign nested code normally first:

```bash
codesign --force --deep --sign - /Applications/Claude.app
```

Then sign only the top-level Claude bundle with the virtualization entitlement:

```bash
codesign --force --sign - --entitlements "$HOME/.local/share/claude-tw/claude-entitlements.plist" /Applications/Claude.app
```

Do not deep-sign every helper/framework with the entitlement plist.

## Patch Flow

```bash
npm install
bash scripts/install.sh
```

For repair after a Claude update:

```bash
node scripts/patch-asar.mjs
codesign --force --deep --sign - /Applications/Claude.app
codesign --force --sign - --entitlements "$HOME/.local/share/claude-tw/claude-entitlements.plist" /Applications/Claude.app
codesign --verify --deep --strict /Applications/Claude.app
```

## Verification

Never report success from static checks alone. Verify the real app UI.

Static:

```bash
bash scripts/diag.sh
```

Visual:

- Main screen: sidebar, composer placeholder, suggestions, add menu.
- Cowork Projects: empty-state headings, buttons, and no invalid-installation modal.
- Customize: overview cards, connector/plugin/Skills labels; preserve `Skills`.
- Settings: navigation, desktop settings, Code/Cowork pages, long descriptions.
- Toggle-off restore: menu bar helper should stop new translations and restore cached nodes where possible.

## Translation Rules

Translate system UI only. Avoid translating user conversations, user input, recent/history titles, prompt body, code, file paths, URLs, tokens, model ids, app names, and scope-like strings.

Preserve product and model terms unless the UI clearly needs an explanatory translation:

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

Prefer Taiwan Traditional Chinese terms:

- `外掛`, not `插件`
- `檔案`, not `文件`
- `資料夾`, not `文件夾`
- `螢幕`, not `屏幕`
- `滑鼠`, not `鼠標`
- `預設`, not `默認`
- `登入`, not `登錄`

## Recovery

```bash
bash scripts/restore.sh
```

Backups are stored under `$HOME/.local/share/claude-tw/backups/`.
