function replaceOnce(source, pattern, replacer, errorMessage) {
  if (source.includes(replacer)) return source;
  if (!pattern.test(source)) throw new Error(errorMessage);
  return source.replace(pattern, replacer);
}

export function patchCoworkSupport(index, coworkSentinel) {
  const pattern = /if\(r==="entitlement_missing"\)return\{status:"unsupported",reason:[A-Za-z_$][\w$]*\(\)\.formatMessage\(\{defaultMessage:"Claude's installation appears to be corrupted\. Reinstall Claude from claude\.com\/download to use this feature\.",id:"oqcioCyuAP"\}\),unsupportedCode:"virtualization_entitlement_missing"\};if\(r!=="supported"\)return/g;
  const replacement = `if(r==="entitlement_missing"){try{console.warn("[${coworkSentinel}] bypassing entitlement_missing caused by local ad-hoc signature")}catch{}}else if(r!=="supported")return`;
  return replaceOnce(index, pattern, replacement, 'Could not find Cowork entitlement support check');
}

export function patchCoworkVm(index, coworkVmSentinel) {
  const pattern = /if\(g!==void 0&&g!=="supported"\)\{Ke\.warn\(`\[startVM\] Virtualization not available \(\$\{g\}\), skipping`\),[A-Za-z_$][\w$]*\([A-Za-z_$][\w$]*\.Offline\),[A-Za-z_$][\w$]*\(g==="entitlement_missing"\?"Claude's installation appears to be invalid or has been modified\. Reinstall Claude from claude\.ai\/download to use this feature\.":"Virtualization is not supported on this Mac\. This can happen when macOS is running inside a virtual machine without nested virtualization enabled\."\);return\}/g;
  const replacement = `if(g==="entitlement_missing"){try{Ke.warn("[${coworkVmSentinel}] bypassing entitlement_missing caused by local ad-hoc signature")}catch{}}else if(g!==void 0&&g!=="supported"){Ke.warn(\`[startVM] Virtualization not available (\${g}), skipping\`),Rj(Mh.Offline),cU("Virtualization is not supported on this Mac. This can happen when macOS is running inside a virtual machine without nested virtualization enabled.");return}`;
  return replaceOnce(index, pattern, replacement, 'Could not find Cowork VM startup entitlement check');
}

export function patchMainDomReadyHook(index, injectCall) {
  const exactNeedles = [
    's.webContents.on("dom-ready",()=>{jaA()});',
    's.webContents.on("dom-ready",()=>{jaA();});',
    's.webContents.on("dom-ready",()=>{g$("main_view_dom_ready"),rlA()});'
  ];
  for (const needle of exactNeedles) {
    if (index.includes(needle)) {
      const body = needle.includes('g$("main_view_dom_ready"),rlA()')
        ? 'g$("main_view_dom_ready"),rlA()'
        : 'jaA()';
      return index.replace(needle, () => `s.webContents.on("dom-ready",()=>{${body};${injectCall}});`);
    }
  }

  const pattern = /s\.webContents\.on\("dom-ready",\(\)=>\{([^}]*(?:jaA\(\)|g\$\("main_view_dom_ready"\),rlA\(\))[^}]*)\}\);/;
  if (!pattern.test(index)) {
    throw new Error('Could not find main WebContents dom-ready hook');
  }

  return index.replace(pattern, (_, body) => `s.webContents.on("dom-ready",()=>{${body};${injectCall}});`);
}
