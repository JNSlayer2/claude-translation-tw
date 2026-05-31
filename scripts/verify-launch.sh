#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME}"
SHARE_DIR="${CLAUDE_TW_SHARE:-$HOME_DIR/.local/share/claude-tw}"
APP="${CLAUDE_APP:-/Applications/Claude.app}"
WAKE_SH="${SHARE_DIR}/wake.sh"
FAIL_LOG="$HOME_DIR/Library/Logs/Claude/launch-failure.err"

if [[ ! -x "$WAKE_SH" ]]; then
  echo "missing wake script: $WAKE_SH" >&2
  exit 1
fi

echo "claude-tw launch verify $(date '+%Y-%m-%d %H:%M:%S')"

pkill -x Claude >/dev/null 2>&1 || true
pkill -f 'Claude Helper' >/dev/null 2>&1 || true
rm -f "$FAIL_LOG"

"$WAKE_SH" --disable >/dev/null 2>&1 || true
sleep 2

(
  cd "$HOME_DIR" || exit 1
  "$WAKE_SH" --enable
)

sleep 10

echo
echo "proxy:"
curl -fsS --max-time 2 http://127.0.0.1:9223/health

echo
echo
echo "processes:"
pgrep -lf '^/Applications/Claude.app/Contents/MacOS/Claude$|Claude Helper' || {
  echo "Claude did not stay running" >&2
  exit 1
}

echo
echo "codesign:"
codesign --verify --deep --strict "$APP"

echo
if [[ -f "$FAIL_LOG" ]]; then
  echo "launch failure log:"
  tail -n 40 "$FAIL_LOG"
  exit 1
fi

echo "launch_failure_present=0"
