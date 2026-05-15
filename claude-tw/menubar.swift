import Cocoa

let home = NSHomeDirectory()
let shareDir = "\(home)/.local/share/claude-tw"
let statePath = "\(shareDir)/state.json"
let servePath = "\(shareDir)/serve.mjs"
let logPath = "/tmp/claude-tw-serve.log"

func shellQuote(_ value: String) -> String {
    return "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
}

@discardableResult
func run(_ command: String, wait: Bool = false) -> (Int32, String) {
    let task = Process()
    task.launchPath = "/bin/bash"
    task.arguments = ["-lc", command]
    let pipe = Pipe()
    task.standardOutput = pipe
    task.standardError = pipe
    do {
        try task.run()
    } catch {
        return (-1, "spawn failed: \(error.localizedDescription)")
    }
    if wait {
        task.waitUntilExit()
    }
    let data = pipe.fileHandleForReading.availableData
    return (task.terminationStatus, String(data: data, encoding: .utf8) ?? "")
}

func notify(_ text: String) {
    let escaped = text.replacingOccurrences(of: "\"", with: "\\\"")
    _ = run("osascript -e 'display notification \"\(escaped)\" with title \"Claude 繁中\"'")
}

func proxyAlive() -> Bool {
    let (status, _) = run("curl -fsS --max-time 1 http://127.0.0.1:9223/health >/dev/null", wait: true)
    return status == 0
}

func writeState(enabled: Bool) {
    let value = enabled ? "true" : "false"
    let json = """
    {"enabled":\(value),"proxyPort":9223,"targetLanguage":"zh-TW","updatedAt":"\(ISO8601DateFormatter().string(from: Date()))"}
    """
    let escaped = json.replacingOccurrences(of: "'", with: "'\\''")
    _ = run("printf '%s\\n' '\(escaped)' > '\(statePath)'", wait: true)
}

func startProxy() {
    if proxyAlive() { return }
    try? FileManager.default.createDirectory(atPath: shareDir, withIntermediateDirectories: true)
    let command = """
    NODE_BIN="$(command -v node || true)"
    if [ -z "$NODE_BIN" ]; then
      for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
        if [ -x "$candidate" ]; then NODE_BIN="$candidate"; break; fi
      done
    fi
    [ -n "$NODE_BIN" ] || exit 1
    nohup "$NODE_BIN" \(shellQuote(servePath)) >> \(shellQuote(logPath)) 2>&1 &
    """
    _ = run(command, wait: false)
}

func stopProxy() {
    _ = run("pkill -f 'claude-tw/serve.mjs' 2>/dev/null || true", wait: true)
}

func makeMascotIcon(enabled: Bool) -> NSImage {
    let size = NSSize(width: 26, height: 20)
    let image = NSImage(size: size)
    image.lockFocus()
    defer { image.unlockFocus() }

    NSGraphicsContext.current?.imageInterpolation = .none
    NSColor.clear.setFill()
    NSRect(origin: .zero, size: size).fill()

    let alpha: CGFloat = enabled ? 1.0 : 0.45
    let red = NSColor(calibratedRed: 0.86, green: 0.07, blue: 0.13, alpha: alpha)
    let blue = NSColor(calibratedRed: 0.04, green: 0.20, blue: 0.55, alpha: alpha)
    let white = NSColor(calibratedWhite: 1.0, alpha: alpha)

    func fill(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: NSColor) {
        color.setFill()
        NSBezierPath(rect: NSRect(x: x, y: y, width: w, height: h)).fill()
    }

    // Pixel-style Claude mascot silhouette, recolored with Taiwan flag red/blue/white.
    fill(7, 4, 13, 11, red)
    fill(5, 7, 17, 7, red)
    fill(9, 15, 9, 2, red)
    fill(6, 2, 3, 3, red)
    fill(17, 2, 3, 3, red)
    fill(3, 8, 3, 4, red)
    fill(22, 8, 2, 4, red)

    fill(7, 11, 7, 4, blue)
    fill(9, 12, 1.5, 1.5, white)
    fill(12, 12, 1.5, 1.5, white)
    fill(10.5, 13.5, 1.5, 1.5, white)
    fill(10.5, 10.5, 1.5, 1.5, white)

    fill(10, 8, 2, 2, white)
    fill(16, 8, 2, 2, white)

    if enabled {
        let check = NSBezierPath()
        check.move(to: NSPoint(x: 17.5, y: 4.0))
        check.line(to: NSPoint(x: 20.3, y: 1.5))
        check.line(to: NSPoint(x: 25.0, y: 8.0))
        white.setStroke()
        check.lineWidth = 2.2
        check.lineCapStyle = .round
        check.lineJoinStyle = .round
        check.stroke()
    }

    image.isTemplate = false
    return image
}

class AppDelegate: NSObject, NSApplicationDelegate {
    private var item: NSStatusItem!
    private var timer: Timer?
    private var enabled = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        item = NSStatusBar.system.statusItem(withLength: 30)
        item.button?.toolTip = "Claude 繁體中文"
        refresh()
        if enabled && !proxyAlive() {
            startProxy()
        }
        rebuild()
        timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.refresh()
        }
    }

    private func readEnabledState() -> Bool {
        guard
            let data = try? Data(contentsOf: URL(fileURLWithPath: statePath)),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let value = object["enabled"] as? Bool
        else {
            return false
        }
        return value
    }

    private func refresh() {
        let next = readEnabledState()
        if next != enabled {
            enabled = next
            rebuild()
        }
        item.button?.title = ""
        item.button?.image = makeMascotIcon(enabled: enabled)
        item.button?.imagePosition = .imageOnly
    }

    private func rebuild() {
        let menu = NSMenu()
        let toggle = NSMenuItem(title: enabled ? "取消翻譯" : "翻譯", action: #selector(toggle), keyEquivalent: "t")
        toggle.target = self
        menu.addItem(toggle)
        let hint = NSMenuItem(title: "開 Claude 時會自動喚醒", action: nil, keyEquivalent: "")
        hint.isEnabled = false
        menu.addItem(hint)
        menu.addItem(NSMenuItem.separator())
        let quit = NSMenuItem(title: "結束小精靈", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
        item.menu = menu
    }

    @objc private func toggle() {
        if enabled {
            writeState(enabled: false)
            stopProxy()
            enabled = false
            notify("已取消翻譯")
        } else {
            startProxy()
            writeState(enabled: true)
            _ = run("open /Applications/Claude.app", wait: false)
            enabled = true
            notify("翻譯已啟用")
        }
        refresh()
    }

    @objc private func quit() {
        NSApplication.shared.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
