#!/usr/bin/env bash
set +e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHARE="${CLAUDE_TW_SHARE:-$HOME/.local/share/claude-tw}"
APP="${CLAUDE_APP:-/Applications/Claude.app}"

echo "claude-tw diagnostic $(date '+%Y-%m-%d %H:%M:%S')"
echo
echo "state:"
cat "$SHARE/state.json" 2>/dev/null || echo "missing state.json"
echo
echo "proxy:"
curl -fsS --max-time 2 http://127.0.0.1:9223/health 2>&1 || true
echo
echo "processes:"
ps -axww | grep -E "ClaudeTW|claude-tw/serve.mjs|Claude.app/Contents/MacOS/Claude" | grep -v grep || true
echo
echo "asar sentinel:"
cd "$ROOT" && node --input-type=module - <<'NODE' 2>&1 || true
import * as asar from '@electron/asar';
const asarPath = `${process.env.CLAUDE_APP || '/Applications/Claude.app'}/Contents/Resources/app.asar`;
const mainView = (await asar.extractFile(asarPath, '.vite/build/mainView.js')).toString('utf8');
const index = (await asar.extractFile(asarPath, '.vite/build/index.js')).toString('utf8');
console.log({
  preloadSentinel: (mainView.match(/CLAUDE_TW_PRELOAD_V1 START/g) || []).length,
  mainInjectSentinel: (index.match(/CLAUDE_TW_MAIN_INJECT_V1 START/g) || []).length,
  coworkSupportSentinel: (index.match(/CLAUDE_TW_COWORK_SUPPORT_V1/g) || []).length,
  coworkVmSentinel: (index.match(/CLAUDE_TW_COWORK_VM_V1/g) || []).length
});
NODE
echo
echo "codesign:"
codesign --verify --deep --strict "$APP" 2>&1 || true
