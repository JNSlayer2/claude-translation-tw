#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  cpSync
} from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as asar from '@electron/asar';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = process.env.CLAUDE_APP || '/Applications/Claude.app';
const resources = path.join(app, 'Contents/Resources');
const asarPath = path.join(resources, 'app.asar');
const infoPath = path.join(app, 'Contents/Info.plist');
const share = process.env.CLAUDE_TW_SHARE || path.join(homedir(), '.local/share/claude-tw');
const backupRoot = path.join(share, 'backups');
const sentinel = 'CLAUDE_TW_PRELOAD_V1';
const mainSentinel = 'CLAUDE_TW_MAIN_INJECT_V1';
const coworkSentinel = 'CLAUDE_TW_COWORK_SUPPORT_V1';
const coworkVmSentinel = 'CLAUDE_TW_COWORK_VM_V1';

if (!existsSync(asarPath)) throw new Error(`Missing ${asarPath}`);
if (!existsSync(infoPath)) throw new Error(`Missing ${infoPath}`);

const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const backup = path.join(backupRoot, `patch-${now}`);
mkdirSync(backup, { recursive: true });
cpSync(asarPath, path.join(backup, 'app.asar'), { force: true, recursive: false });
cpSync(infoPath, path.join(backup, 'Info.plist'), { force: true, recursive: false });

const work = mkdtempSync(path.join(tmpdir(), 'claude-tw-asar-'));
await asar.extractAll(asarPath, work);

const mainViewPath = path.join(work, '.vite/build/mainView.js');
if (!existsSync(mainViewPath)) throw new Error('Missing .vite/build/mainView.js inside app.asar');
let mainView = readFileSync(mainViewPath, 'utf8');
mainView = mainView.replace(
  new RegExp(`;?\\n?\\/\\* ${sentinel} START \\*\\/[\\s\\S]*?\\/\\* ${sentinel} END \\*\\/\\n?`, 'g'),
  ''
);

mainView += `
/* ${sentinel} START */
;(() => {
  try {
    const allowed = () => {
      try {
        const url = new URL(window.location.href);
        const origin = url.origin === 'null' ? url.protocol + '//' + url.host : url.origin;
        return origin === 'https://claude.ai' ||
          origin === 'https://claude.com' ||
          origin === 'https://preview.claude.ai' ||
          origin === 'https://preview.claude.com' ||
          origin === 'app://localhost' ||
          url.hostname === 'localhost' ||
          origin.endsWith('.ant.dev');
      } catch {
        return false;
      }
    };
    if (!allowed()) return;
    window.__CLAUDE_TW_PRELOAD_SEEN__ = true;
  } catch (error) {
    try { console.error('[claude-tw] preload failed', error); } catch {}
  }
})();
/* ${sentinel} END */
`;
writeFileSync(mainViewPath, mainView);

const indexPath = path.join(work, '.vite/build/index.js');
if (!existsSync(indexPath)) throw new Error('Missing .vite/build/index.js inside app.asar');
let index = readFileSync(indexPath, 'utf8');
index = index.replace(
  new RegExp(`;?\\/\\* ${mainSentinel} START \\*\\/[\\s\\S]*?\\/\\* ${mainSentinel} END \\*\\/;?`, 'g'),
  ''
);

const coworkOriginal = `if(r==="entitlement_missing")return{status:"unsupported",reason:ae().formatMessage({defaultMessage:"Claude's installation appears to be corrupted. Reinstall Claude from claude.com/download to use this feature.",id:"oqcioCyuAP"}),unsupportedCode:"virtualization_entitlement_missing"};if(r!=="supported")return`;
const coworkPatched = `if(r==="entitlement_missing"){try{console.warn("[${coworkSentinel}] bypassing entitlement_missing caused by local ad-hoc signature")}catch{}}else if(r!=="supported")return`;
if (index.includes(coworkOriginal)) {
  index = index.replace(coworkOriginal, coworkPatched);
} else if (!index.includes(coworkSentinel)) {
  throw new Error('Could not find Cowork entitlement support check');
}

const coworkVmOriginal = `if(a!==void 0&&a!=="supported"){Ke.warn(\`[startVM] Virtualization not available (\${a}), skipping\`),HV(AD.Offline),fG(a==="entitlement_missing"?"Claude's installation appears to be invalid or has been modified. Reinstall Claude from claude.ai/download to use this feature.":"Virtualization is not supported on this Mac. This can happen when macOS is running inside a virtual machine without nested virtualization enabled.");return}`;
const coworkVmPatched = `if(a==="entitlement_missing"){try{Ke.warn("[${coworkVmSentinel}] bypassing entitlement_missing caused by local ad-hoc signature")}catch{}}else if(a!==void 0&&a!=="supported"){Ke.warn(\`[startVM] Virtualization not available (\${a}), skipping\`),HV(AD.Offline),fG("Virtualization is not supported on this Mac. This can happen when macOS is running inside a virtual machine without nested virtualization enabled.");return}`;
if (index.includes(coworkVmOriginal)) {
  index = index.replace(coworkVmOriginal, coworkVmPatched);
} else if (!index.includes(coworkVmSentinel)) {
  throw new Error('Could not find Cowork VM startup entitlement check');
}

const translatorPath = existsSync(path.join(share, 'translator.js'))
  ? path.join(share, 'translator.js')
  : path.join(repoRoot, 'claude-tw/translator.js');
const translatorSource = readFileSync(translatorPath, 'utf8');
const pageScript = `
(() => {
  try {
    const host = window.location.hostname;
    const ok = host === 'claude.ai' ||
      host === 'claude.com' ||
      host === 'preview.claude.ai' ||
      host === 'preview.claude.com' ||
      host.endsWith('.ant.dev');
    if (!ok) return;
${translatorSource}
  } catch (error) {
    try { console.error('[claude-tw] main inject failed', error); } catch {}
  }
})();
`;
const injectCall = `/* ${mainSentinel} START */;try{s.webContents.executeJavaScript(${JSON.stringify(pageScript)},true).catch(()=>{})}catch{};/* ${mainSentinel} END */`;
const needles = [
  's.webContents.on("dom-ready",()=>{jaA()});',
  's.webContents.on("dom-ready",()=>{jaA();});'
];
const needle = needles.find((candidate) => index.includes(candidate));
if (!needle) throw new Error('Could not find main WebContents dom-ready hook');
index = index.replace(needle, () => `s.webContents.on("dom-ready",()=>{jaA();${injectCall}});`);
writeFileSync(indexPath, index);

await asar.createPackage(work, asarPath);
rmSync(work, { recursive: true, force: true });

const hash = createHash('sha256').update(asar.getRawHeader(asarPath).headerString).digest('hex');
const plistPaths = execFileSync('/usr/bin/find', [app, '-name', 'Info.plist', '-print'])
  .toString('utf8')
  .trim()
  .split('\n')
  .filter(Boolean);

for (const plistPath of plistPaths) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', [
      '-c',
      `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${hash}`,
      plistPath
    ]);
  } catch {
    // Most nested plists do not carry ElectronAsarIntegrity.
  }
}

console.log(JSON.stringify({ ok: true, backup, hash }, null, 2));
