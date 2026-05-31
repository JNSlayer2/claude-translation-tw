import test from 'node:test';
import assert from 'node:assert/strict';

import {
  patchCoworkSupport,
  patchCoworkVm,
  patchMainDomReadyHook
} from '../scripts/patch-rules.mjs';

test('patchCoworkSupport rewrites current Claude entitlement guard', () => {
  const input = 'if(e==="darwin")try{const r=require("@ant/claude-swift").vm.isVirtualizationSupported();if(r==="entitlement_missing")return{status:"unsupported",reason:Ee().formatMessage({defaultMessage:"Claude\'s installation appears to be corrupted. Reinstall Claude from claude.com/download to use this feature.",id:"oqcioCyuAP"}),unsupportedCode:"virtualization_entitlement_missing"};if(r!=="supported")return{status:"unsupported",reason:Ee().formatMessage({defaultMessage:"Cowork requires virtualization. Your Mac does not support virtualization. If you are currently running macOS inside a virtual machine (like Parallels), you might need to enable a feature called \'nested virtualization\'.",id:"C/K/kK/zlp"}),unsupportedCode:"virtualization_not_available"}}catch{}return{status:"supported"}';
  const output = patchCoworkSupport(input, 'CLAUDE_TW_COWORK_SUPPORT_V1');

  assert.match(output, /\[CLAUDE_TW_COWORK_SUPPORT_V1\] bypassing entitlement_missing/);
  assert.doesNotMatch(output, /installation appears to be corrupted/);
});

test('patchCoworkVm rewrites current Claude VM startup guard', () => {
  const input = 'if(Or){const a=await Io(),g=(s=a==null?void 0:a.isVirtualizationSupported)==null?void 0:s.call(a);if(g!==void 0&&g!=="supported"){Ke.warn(`[startVM] Virtualization not available (${g}), skipping`),Rj(Mh.Offline),cU(g==="entitlement_missing"?"Claude\'s installation appears to be invalid or has been modified. Reinstall Claude from claude.ai/download to use this feature.":"Virtualization is not supported on this Mac. This can happen when macOS is running inside a virtual machine without nested virtualization enabled.");return}}';
  const output = patchCoworkVm(input, 'CLAUDE_TW_COWORK_VM_V1');

  assert.match(output, /\[CLAUDE_TW_COWORK_VM_V1\] bypassing entitlement_missing/);
  assert.doesNotMatch(output, /installation appears to be invalid or has been modified/);
});

test('patchMainDomReadyHook injects into current main view hook', () => {
  const input = 's.webContents.on("dom-ready",()=>{g$("main_view_dom_ready"),rlA()});const a=S3e({webPreferences:{preload:tA.join(aA.app.getAppPath(),".vite/build/findInPage.js"),enableBlinkFeatures:void 0}});';
  const injectCall = '/* CLAUDE_TW_MAIN_INJECT_V1 START */;try{s.webContents.executeJavaScript("injected",true).catch(()=>{})}catch{};/* CLAUDE_TW_MAIN_INJECT_V1 END */';
  const output = patchMainDomReadyHook(input, injectCall);

  assert.match(output, /rlA\(\);\/\* CLAUDE_TW_MAIN_INJECT_V1 START \*\//);
  assert.doesNotMatch(output, /s\.webContents\.on\("dom-ready",\(\)=>\{g\$\("main_view_dom_ready"\),rlA\(\)\}\);const a=/);
});

test('patchMainDomReadyHook preserves dollar sequences inside injected payloads', () => {
  const input = 's.webContents.on("dom-ready",()=>{g$("main_view_dom_ready"),rlA()});';
  const injectCall = 'try{s.webContents.executeJavaScript("const escaped = \'\\\\$& \\\\$1 \\\\$<name>\';",true).catch(()=>{})}catch{};';
  const output = patchMainDomReadyHook(input, injectCall);

  assert.ok(output.includes("\\\\$& \\\\$1 \\\\$<name>"));
});
