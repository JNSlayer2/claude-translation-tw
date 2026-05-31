#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHARE="${CLAUDE_TW_SHARE:-$HOME/.local/share/claude-tw}"
APP="${CLAUDE_APP:-/Applications/Claude.app}"
HELPER_APP="$HOME/Applications/ClaudeTW.app"
HELPER_BIN="$HELPER_APP/Contents/MacOS/ClaudeTW"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.layer2.claude-tw.wake.plist"

# Avoid macOS cwd/TCC issues when the repo lives under protected folders like Documents.
cd /

if [[ ! -d "$APP" ]]; then
  echo "Claude.app not found at $APP" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required in PATH" >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command line tools are required for xcrun swiftc" >&2
  exit 1
fi

mkdir -p "$SHARE" "$HOME/Applications" "$HOME/Library/LaunchAgents"
CLAUDE_TW_ROOT="$ROOT" CLAUDE_TW_SHARE="$SHARE" node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.env.CLAUDE_TW_ROOT;
const share = process.env.CLAUDE_TW_SHARE;
const files = [
  'translator.js',
  'serve.mjs',
  'overrides.json',
  'claude-entitlements.plist',
  'wake.sh'
];

for (const file of files) {
  const source = path.join(root, 'claude-tw', file);
  const target = path.join(share, file);
  await writeFile(target, await readFile(source));
}
NODE
chmod +x "$SHARE/wake.sh"
printf '{"enabled":true,"proxyPort":9223,"targetLanguage":"zh-TW"}\n' > "$SHARE/state.json"

npm --prefix "$ROOT" install

xcrun swiftc -O "$ROOT/claude-tw/menubar.swift" -o "$SHARE/menubar-bin"
mkdir -p "$HELPER_APP/Contents/MacOS"
cp "$SHARE/menubar-bin" "$HELPER_BIN"
cat > "$HELPER_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>ClaudeTW</string>
  <key>CFBundleIdentifier</key>
  <string>com.layer2.claude-tw</string>
  <key>CFBundleName</key>
  <string>ClaudeTW</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
PLIST
codesign --force --deep --sign - "$HELPER_APP"

cat > "$LAUNCH_AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.layer2.claude-tw.wake</string>
  <key>ProgramArguments</key>
  <array>
    <string>$SHARE/wake.sh</string>
    <string>--if-claude-running</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>/tmp/claude-tw-wake.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/claude-tw-wake.err</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENT"
launchctl enable "gui/$(id -u)/com.layer2.claude-tw.wake"

osascript -e 'tell application "Claude" to quit' >/dev/null 2>&1 || true
sleep 1
pkill -f '^/Applications/Claude.app/Contents/MacOS/Claude$' >/dev/null 2>&1 || true

node "$ROOT/scripts/patch-asar.mjs"
codesign --force --deep --sign - "$APP"
codesign --force --sign - --entitlements "$SHARE/claude-entitlements.plist" "$APP"
codesign --verify --deep --strict "$APP"

"$SHARE/wake.sh" --enable

echo "Claude Translation TW installed."
