#!/usr/bin/env bash
set -euo pipefail

SHARE="${CLAUDE_TW_SHARE:-$HOME/.local/share/claude-tw}"
APP="${CLAUDE_APP:-/Applications/Claude.app}"
BACKUP="${1:-}"

if [[ -z "$BACKUP" ]]; then
  BACKUP="$(find "$SHARE/backups" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -n 1)"
fi

if [[ -z "$BACKUP" || ! -d "$BACKUP" ]]; then
  echo "Backup not found. Pass a backup directory explicitly." >&2
  exit 1
fi

osascript -e 'tell application "Claude" to quit' >/dev/null 2>&1 || true
pkill -f "Claude.app/Contents/Frameworks/Claude Helper" >/dev/null 2>&1 || true
pkill -f "claude-tw/serve.mjs" >/dev/null 2>&1 || true
sleep 1

cp -p "$BACKUP/app.asar" "$APP/Contents/Resources/app.asar"
cp -p "$BACKUP/Info.plist" "$APP/Contents/Info.plist"
codesign --force --deep --sign - "$APP"
printf '{"enabled":false,"proxyPort":9223,"targetLanguage":"zh-TW"}\n' > "$SHARE/state.json"
open "$APP"
echo "Restored Claude.app from $BACKUP"
