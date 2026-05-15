# Claude Translation TW

Traditional Chinese UI translation layer for the macOS Claude desktop app.

This project patches the locally installed `/Applications/Claude.app` on your own Mac. It does not redistribute Claude.app, `app.asar`, Anthropic code, account data, screenshots, logs, backups, or local runtime state.

## What It Does

- Injects a DOM translation layer into Claude's main `claude.ai` Electron view.
- Translates system UI into Taiwan Traditional Chinese.
- Keeps product terms such as `Claude`, `Cowork`, `Skills`, `Model`, and model names in English.
- Avoids translating chat transcript content, user input, prompt bodies, code blocks, file paths, URLs, tokens, model ids, and recent/history titles.
- Adds a macOS menu bar helper to toggle translation on and off.
- Adds an optional LaunchAgent that wakes the helper when Claude is opened.

## Requirements

- macOS
- Installed Claude desktop app at `/Applications/Claude.app`
- Node.js available in `PATH`
- Xcode command line tools for `xcrun swiftc`

## Install

```bash
git clone https://github.com/JNSlayer2/claude-translation-tw.git
cd claude-translation-tw
npm install
bash scripts/install.sh
```

The installer copies runtime files to:

- `$HOME/.local/share/claude-tw`
- `$HOME/Applications/ClaudeTW.app`
- `$HOME/Library/LaunchAgents/com.layer2.claude-tw.wake.plist`

Then it patches and re-signs `/Applications/Claude.app` locally.

## Verify

```bash
bash scripts/diag.sh
```

You should see:

- `codesign` verification passing
- `CLAUDE_TW_PRELOAD_V1`, `CLAUDE_TW_MAIN_INJECT_V1`, `CLAUDE_TW_COWORK_SUPPORT_V1`, and `CLAUDE_TW_COWORK_VM_V1` each present once
- proxy health at `http://127.0.0.1:9223/health`

## Restore

```bash
bash scripts/restore.sh
```

The patcher stores app.asar and Info.plist backups under `$HOME/.local/share/claude-tw/backups/`.

## Notes

Claude updates can replace `app.asar`. Re-run `bash scripts/install.sh` after updating Claude.

This is an unofficial local patch. Use it only on machines where you understand and accept the implications of modifying and ad-hoc signing a local app bundle.
