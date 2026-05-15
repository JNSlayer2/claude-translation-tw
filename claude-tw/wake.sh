#!/bin/zsh
set -u

HOME_DIR="${HOME}"
SHARE_DIR="${HOME_DIR}/.local/share/claude-tw"
STATE_PATH="${SHARE_DIR}/state.json"
SERVE_PATH="${SHARE_DIR}/serve.mjs"
HELPER_APP="${HOME_DIR}/Applications/ClaudeTW.app"
HELPER_BIN="${HELPER_APP}/Contents/MacOS/ClaudeTW"
CLAUDE_BIN="/Applications/Claude.app/Contents/MacOS/Claude"
LOG_PATH="/tmp/claude-tw-serve.log"
WAKE_LOG="/tmp/claude-tw-wake.log"

log() {
  /bin/mkdir -p "$(/usr/bin/dirname "${WAKE_LOG}")"
  /bin/echo "$(/bin/date '+%Y-%m-%d %H:%M:%S') $*" >> "${WAKE_LOG}"
}

proxy_alive() {
  /usr/bin/curl -fsS --max-time 1 http://127.0.0.1:9223/health >/dev/null 2>&1
}

state_enabled() {
  [[ -f "${STATE_PATH}" ]] && /usr/bin/grep -q '"enabled"[[:space:]]*:[[:space:]]*true' "${STATE_PATH}"
}

claude_running() {
  /usr/bin/pgrep -x "Claude" >/dev/null 2>&1
}

helper_running() {
  /usr/bin/pgrep -x "ClaudeTW" >/dev/null 2>&1
}

write_enabled_state() {
  /bin/mkdir -p "${SHARE_DIR}"
  /bin/date -u +"%Y-%m-%dT%H:%M:%SZ" | /usr/bin/awk '{printf "{\"enabled\":true,\"proxyPort\":9223,\"targetLanguage\":\"zh-TW\",\"updatedAt\":\"%s\"}\n", $0}' > "${STATE_PATH}"
}

start_proxy_if_needed() {
  if proxy_alive; then
    return 0
  fi
  /bin/mkdir -p "${SHARE_DIR}"
  /usr/bin/touch "${LOG_PATH}"
  local node_bin
  node_bin="$({ /usr/bin/command -v node || true; } 2>/dev/null)"
  if [[ -z "${node_bin}" ]]; then
    for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
      if [[ -x "${candidate}" ]]; then
        node_bin="${candidate}"
        break
      fi
    done
  fi
  if [[ -z "${node_bin}" ]]; then
    log "node not found"
    return 1
  fi
  /usr/bin/nohup "${node_bin}" "${SERVE_PATH}" >> "${LOG_PATH}" 2>&1 &
}

wake_helper() {
  if helper_running; then
    log "helper already running"
    return 0
  fi
  log "opening helper"
  /usr/bin/open -g "${HELPER_APP}"
}

case "${1:-wake}" in
  --if-claude-running)
    if ! claude_running; then
      log "Claude not running"
      exit 0
    fi
    log "Claude running"
    state_enabled && start_proxy_if_needed
    wake_helper
    ;;
  --enable)
    log "force enable"
    write_enabled_state
    start_proxy_if_needed
    wake_helper
    /usr/bin/open -g "/Applications/Claude.app"
    ;;
  *)
    state_enabled && start_proxy_if_needed
    wake_helper
    ;;
esac
