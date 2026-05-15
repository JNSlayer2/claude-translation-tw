# Failure Report: Claude Traditional Chinese Patch

This is a sanitized public summary of the failed approaches and the working architecture. It intentionally omits local usernames, machine-specific paths, screenshots, logs, account identifiers, and private runtime state.

## Failed Routes

### CDP / Remote Debugging

The initial plan used Chrome DevTools Protocol to attach to Claude desktop and run DOM translation externally.

Outcome:

- Claude desktop did not reliably honor `--remote-debugging-port`.
- Launching with flags was brittle.
- The method required per-launch coordination and did not survive normal user workflows.

Conclusion:

Do not use CDP as the primary route for this patch.

### Preload-Only Injection

The second route injected a preload block into `mainView.js` and attempted to read translation files from the local filesystem.

Outcome:

- Sandbox preload could not reliably use Node filesystem APIs.
- The preload block could mark that it ran, but could not consistently load the translator and dictionary.

Conclusion:

Keep only a lightweight preload sentinel. Do not depend on preload filesystem access.

### Parent-Level DOM Markers

An early DOM translator marked parent elements as translated.

Outcome:

- Settings rows often contain both a title and a description.
- Marking the parent caused the description to be skipped after the title was translated.

Conclusion:

Track translated text nodes individually, not only parent elements.

## Working Architecture

- Patch `/Applications/Claude.app/Contents/Resources/app.asar`.
- Keep a lightweight `CLAUDE_TW_PRELOAD_V1` marker in `.vite/build/mainView.js`.
- Patch `.vite/build/index.js` with `CLAUDE_TW_MAIN_INJECT_V1`.
- Inject `translator.js` into the real `claude.ai` `WebContentsView` from the main process on `dom-ready`.
- Serve runtime state and overrides through `http://127.0.0.1:9223`.
- Use a macOS menu bar helper for `翻譯`, `取消翻譯`, and `結束小精靈`.
- Use a LaunchAgent to wake the helper when Claude is running.

## Cowork Repair

After app.asar modification and ad-hoc signing, Cowork can produce false invalid-installation errors.

The working patch bypasses only `entitlement_missing` in:

- The Cowork support-status check.
- The VM startup entitlement check.

Then signing must be done in this order:

```bash
codesign --force --deep --sign - /Applications/Claude.app
codesign --force --sign - --entitlements "$HOME/.local/share/claude-tw/claude-entitlements.plist" /Applications/Claude.app
codesign --verify --deep --strict /Applications/Claude.app
```

Do not deep-sign nested Electron helpers with the virtualization entitlement plist.

## Translation Lessons

- Translate system UI only.
- Avoid translating chat content, user input, recent/history titles, code blocks, file paths, URLs, tokens, model ids, and OAuth scopes.
- Preserve product terms such as `Claude`, `Cowork`, `Skills`, `Model`, and model names.
- Prefer exact-string overrides for high-frequency UI.
- Allow curated exact-match strings outside normal UI selectors for empty states, suggestion cards, Customize overview, and Live artifacts.
- Polish machine fallback into Taiwan Traditional Chinese terms.

## Verification Standard

Static checks are not enough. A successful run must visually verify:

- Main screen.
- Composer and add menu.
- Cowork Projects.
- Customize.
- Settings detail pages.
- Toggle-on and toggle-off behavior.
