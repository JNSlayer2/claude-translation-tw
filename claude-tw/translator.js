(() => {
  if (window.__CLAUDE_TW_LOADED__) return;
  window.__CLAUDE_TW_LOADED__ = true;

  const MARK = 'data-claude-tw';
  const ORIGINAL = 'data-claude-tw-original';
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  const PROXY = 'http://127.0.0.1:9223';
  const logPrefix = '[claude-tw]';
  const PRESERVE_TERMS = [
    'Claude',
    'Claude Code',
    'Claude Max',
    'Cowork',
    'skills',
    'skill',
    'Skills',
    'Skill',
    'Model',
    'Models',
    'model',
    'models',
    'Legacy Model',
    'Opus',
    'Sonnet',
    'Haiku',
    'Max',
    'Pro',
    'GitHub',
    'Git',
    'MCP',
    'PR',
    'API',
    'URL'
  ];

  const memory = new Map();
  const translatedTextNodes = new Set();
  let overrides = {};
  let enabled = false;
  let observer = null;
  let scheduled = 0;
  let busy = false;
  let restoring = false;

  const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const isSettingsPage = () => window.location.pathname.startsWith('/settings');
  const isEnglishish = (text) => /[A-Za-z]/.test(text) && !/[\u4e00-\u9fff]/.test(text);
  const hasPreservedTerm = (text) => PRESERVE_TERMS.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
  const isNoisy = (text) => {
    const maxLength = isSettingsPage() ? 420 : 120;
    return !text ||
      text.length > maxLength ||
      /^https?:\/\//i.test(text) ||
      /^\/[\w./ -]+$/.test(text) ||
      /^[\w.-]+@[\w.-]+$/.test(text) ||
      /^user:[\w:.-]+$/.test(text) ||
      /^[\d\s.,:%/+-]+$/.test(text) ||
      /[{}[\]<>`=]/.test(text);
  };

  const protectTerms = (text) => {
    const replacements = [];
    const sorted = [...PRESERVE_TERMS].sort((a, b) => b.length - a.length);
    let protectedText = text;
    for (const term of sorted) {
      const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      protectedText = protectedText.replace(pattern, (match) => {
        const token = `__CTW${replacements.length}__`;
        replacements.push([token, match]);
        return token;
      });
    }
    return { protectedText, replacements };
  };

  const restoreTerms = (text, replacements) => {
    let restored = text;
    for (const [token, original] of replacements) {
      restored = restored.replaceAll(token, original);
    }
    return restored;
  };

  const polishTranslation = (text) => String(text || '')
    .replaceAll('插件', '外掛')
    .replaceAll('項目', '專案')
    .replaceAll('文件夾', '資料夾')
    .replaceAll('文件', '檔案')
    .replaceAll('屏幕', '螢幕')
    .replaceAll('鼠標', '滑鼠')
    .replaceAll('視頻', '影片')
    .replaceAll('默認', '預設')
    .replaceAll('登錄', '登入')
    .replaceAll('加載', '載入');

  const protectedSelector = [
    'textarea',
    'input',
    'code',
    'pre',
    'samp',
    'kbd',
    '[contenteditable="true"]',
    '[data-is-streaming]',
    '[data-testid*="message"]',
    '[class*="message"]',
    '[class*="Message"]',
    '[class*="transcript"]',
    '[class*="Transcript"]',
    '[aria-label*="Transcript"]',
    '[data-testid*="conversation"]',
    '[data-testid*="Conversation"]',
    '[aria-label*="conversation"]',
    '[aria-label*="Conversation"]'
  ].join(',');

  const uiSelector = [
    'button',
    '[role="button"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="switch"]',
    '[role="checkbox"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="dialog"] h1',
    '[role="dialog"] h2',
    '[role="dialog"] h3',
    '[role="dialog"] label',
    '[role="dialog"] p',
    'nav *',
    'aside *',
    'header *',
    'label',
    'summary',
    '[aria-label]',
    '[placeholder]',
    '[title]'
  ].join(',');

  const shouldSkipElement = (el) => {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest(protectedSelector)) return true;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'IMG') return true;
    return false;
  };

  const isSafeComposerPlaceholder = (text) => [
    'Write a message…',
    'Write a message...',
    'How can I help you today?',
    'Describe a task or ask a question',
    'Type / for skills'
  ].includes(normalize(text));

  const shouldTranslateTextNode = (node) => {
    const parent = node.parentElement;
    const text = normalize(node.nodeValue || '');
    if (!parent || (shouldSkipElement(parent) && !isSafeComposerPlaceholder(text))) return false;
    if (overrides[text] && overrides[text] !== text && text.length <= 220) return true;
    if (isNoisy(text) || !isEnglishish(text)) return false;
    if (looksLikeUserTitle(parent, text)) return false;
    if (isSettingsPage() && text.length <= 420) return true;
    if (parent.matches(uiSelector)) return true;
    const closeUi = parent.closest('button,[role="button"],[role="menuitem"],[role="tab"],nav,aside,header,[role="dialog"]');
    return Boolean(closeUi && text.length <= 70);
  };

  const shouldTranslateAttr = (el, attr) => {
    if (shouldSkipElement(el)) return false;
    const text = normalize(el.getAttribute(attr) || '');
    if (looksLikeUserTitle(el, text)) return false;
    if (overrides[text] && overrides[text] !== text && text.length <= 220) return true;
    return !isNoisy(text) && isEnglishish(text);
  };

  const looksLikeUserTitle = (el, text) => {
    const normalized = normalize(text);
    if (!normalized || overrides[normalized]) return false;
    const button = el.closest('button,[role="button"],a,[role="link"]');
    const inSidebar = Boolean(el.closest('aside,nav') || (button && button.getBoundingClientRect().left < 320));
    if (!inSidebar) return false;
    if (/^More options for\b/.test(normalized)) return false;
    if (normalized.length > 18) return true;
    if (hasPreservedTerm(normalized)) return true;
    return false;
  };

  const fetchJson = async (url, fallback) => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch {
      return fallback;
    }
  };

  const directTranslate = (text, allowPartial = true) => {
    const exact = overrides[text];
    if (exact) return exact;
    const normalized = normalize(text);
    if (overrides[normalized]) return text.replace(normalized, overrides[normalized]);
    const moreOptionsMatch = normalized.match(/^More options for\s+(.+)$/);
    if (moreOptionsMatch) return `更多選項：${moreOptionsMatch[1]}`;
    const planMatch = normalized.match(/^Your plan ends in (\d+) days?$/);
    if (planMatch) return `你的方案將於 ${planMatch[1]} 天後結束`;
    const greetingMatch = normalized.match(/^(Morning|Afternoon|Evening),\s+(.+)$/);
    if (greetingMatch) {
      const period = greetingMatch[1] === 'Morning' ? '早安' : greetingMatch[1] === 'Afternoon' ? '午安' : '晚安';
      return `${greetingMatch[2]}，${period}`;
    }
    if (!allowPartial) return null;
    for (const [key, value] of Object.entries(overrides)) {
      if (key === value) continue;
      if (key.length > 5 && normalized.includes(key)) {
        const translated = normalized.replaceAll(key, value);
        return translated === normalized ? null : translated;
      }
    }
    return null;
  };

  const canUseRemote = (job) => {
    const target = job.type === 'text' ? job.node.parentElement : job.el;
    if (!target) return false;
    if (hasPreservedTerm(job.key) && !isSettingsPage()) return false;
    if (looksLikeUserTitle(target, job.key)) return false;
    if (target.closest('[role="dialog"],[role="menu"],[role="listbox"]')) return true;
    if (isSettingsPage()) return true;
    if (job.type === 'attr' && ['aria-label', 'title', 'placeholder'].includes(job.attr)) return true;
    return false;
  };

  const translateRemote = async (list) => {
    if (!list.length) return [];
    const protectedItems = list.map(protectTerms);
    try {
      const response = await fetch(`${PROXY}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: protectedItems.map((item) => item.protectedText), sl: 'en', tl: 'zh-TW' })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const result = Array.isArray(json.result) ? json.result : list;
      return result.map((text, index) => restoreTerms(text, protectedItems[index]?.replacements || []));
    } catch {
      return list;
    }
  };

  const collect = () => {
    const jobs = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!shouldTranslateTextNode(node)) continue;
      if (node.__claudeTwTranslated) continue;
      const original = node.__claudeTwOriginal || node.nodeValue || '';
      const text = normalize(original);
      if (!text) continue;
      jobs.push({ type: 'text', node, original: node.nodeValue || '', key: text });
    }

    for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) {
      for (const attr of ATTRS) {
        if (!el.hasAttribute(attr) || !shouldTranslateAttr(el, attr)) continue;
        const originalAttr = `${ORIGINAL}-${attr}`;
        const original = el.getAttribute(originalAttr) || el.getAttribute(attr) || '';
        const key = normalize(original);
        if (!key || el.getAttribute(`${MARK}-${attr}`) === '1') continue;
        jobs.push({ type: 'attr', el, attr, original, key });
      }
    }
    return jobs;
  };

  const applyJob = (job, translated) => {
    translated = polishTranslation(translated);
    if (!translated || translated === job.key) return;
    if (job.type === 'text') {
      if (job.node.__claudeTwTranslated) return;
      job.node.__claudeTwOriginal = job.original;
      job.node.__claudeTwTranslated = true;
      translatedTextNodes.add(job.node);
      job.node.nodeValue = job.original.replace(job.key, translated);
      return;
    }
    const originalAttr = `${ORIGINAL}-${job.attr}`;
    job.el.setAttribute(originalAttr, job.original);
    job.el.setAttribute(`${MARK}-${job.attr}`, '1');
    job.el.setAttribute(job.attr, job.original.replace(job.key, translated));
  };

  const restore = () => {
    restoring = true;
    try {
      for (const node of translatedTextNodes) {
        if (node?.__claudeTwTranslated) {
          node.nodeValue = node.__claudeTwOriginal || node.nodeValue;
          delete node.__claudeTwOriginal;
          delete node.__claudeTwTranslated;
        }
      }
      translatedTextNodes.clear();
      for (const el of document.querySelectorAll(`[${MARK}="1"]`)) {
        if (el.hasAttribute(ORIGINAL)) {
          const original = el.getAttribute(ORIGINAL);
          if (el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE) {
            el.firstChild.nodeValue = original;
          }
        }
        el.removeAttribute(MARK);
        el.removeAttribute(ORIGINAL);
      }
      for (const el of document.querySelectorAll(ATTRS.map((a) => `[${MARK}-${a}="1"]`).join(','))) {
        for (const attr of ATTRS) {
          const mark = `${MARK}-${attr}`;
          const originalAttr = `${ORIGINAL}-${attr}`;
          if (el.getAttribute(mark) === '1' && el.hasAttribute(originalAttr)) {
            el.setAttribute(attr, el.getAttribute(originalAttr));
            el.removeAttribute(mark);
            el.removeAttribute(originalAttr);
          }
        }
      }
    } finally {
      restoring = false;
    }
  };

  const scan = async () => {
    if (!enabled || busy || !document.body) return;
    busy = true;
    try {
      const jobs = collect();
      const remoteKeys = [];
      const remoteJobs = [];
      for (const job of jobs) {
        const normalized = normalize(job.key);
        if (overrides[job.key] === job.key || overrides[normalized] === normalized) continue;
        const local = directTranslate(job.key, !isSettingsPage()) || memory.get(job.key);
        if (local && local !== job.key) {
          applyJob(job, local);
        } else if (canUseRemote(job)) {
          remoteKeys.push(job.key);
          remoteJobs.push(job);
        }
      }
      const unique = [...new Set(remoteKeys)].slice(0, 80);
      const translated = await translateRemote(unique);
      unique.forEach((key, index) => memory.set(key, translated[index] || key));
      for (const job of remoteJobs) applyJob(job, memory.get(job.key));
    } finally {
      busy = false;
    }
  };

  const schedule = () => {
    if (scheduled || restoring) return;
    scheduled = window.setTimeout(() => {
      scheduled = 0;
      void scan();
    }, 150);
  };

  const updateState = async () => {
    const state = await fetchJson(`${PROXY}/state`, { enabled: false, proxyPort: 9223 });
    const wasEnabled = enabled;
    enabled = Boolean(state.enabled);
    if (enabled) {
      overrides = await fetchJson(`${PROXY}/overrides`, overrides);
      schedule();
    } else if (wasEnabled) {
      restore();
    }
  };

  const start = () => {
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }
    document.documentElement.setAttribute('data-claude-tw-ready', '1');
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
    void updateState();
    window.setInterval(updateState, 1000);
    window.setInterval(schedule, 2500);
    console.info(`${logPrefix} translator ready`);
  };

  start();
})();
