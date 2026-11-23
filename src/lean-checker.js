// Lean Web accepts a source file in the documented #code fragment. Its parser
// uses decodeURIComponent, so spaces must be %20 rather than form-encoded '+'.
function leanPlaygroundUrl(source) {
  return 'https://live.lean-lang.org/#code=' + encodeURIComponent(source);
}

let leanFrame = null;
let leanLoadTimer;
let leanReturnFocus = null;

function closeLeanChecker() {
  const dialog = document.getElementById('leanDialog');
  if (dialog.open) dialog.close();
}

function openLeanChecker(source) {
  const dialog = document.getElementById('leanDialog');
  if (dialog.open || !source.trim()) return;
  const host = document.getElementById('leanFrameHost');
  const external = document.getElementById('leanExternal');
  const loading = document.getElementById('leanLoading');
  const url = leanPlaygroundUrl(source);
  leanReturnFocus = document.activeElement;
  const frame = document.createElement('iframe');
  leanFrame = frame;
  frame.title = 'Lean 4 editor, proof goals, and diagnostics';
  frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox');
  external.href = url;
  external.target = '_blank';
  external.rel = 'noopener noreferrer';
  loading.hidden = false;
  loading.textContent = 'Opening the Lean editor…';
  const showFallback = () => {
    if (leanFrame !== frame) return;
    loading.hidden = false;
    loading.textContent = 'If the editor hasn’t appeared, open it in a new tab.';
  };
  frame.addEventListener('error', showFallback, { once: true });
  frame.addEventListener('load', () => {
    if (leanFrame !== frame) return;
    clearTimeout(leanLoadTimer);
    // Loading the editor says nothing about the result of checking the proof.
    loading.hidden = true;
  });
  leanLoadTimer = setTimeout(showFallback, 15000);
  dialog.showModal();
  document.getElementById('leanClose').focus();
  frame.src = url;
  host.replaceChildren(frame);
}

document.getElementById('leanClose').addEventListener('click', closeLeanChecker);
document.getElementById('leanDialog').addEventListener('close', () => {
  // A close event can be queued after a new modal session was opened.
  if (document.getElementById('leanDialog').open) return;
  clearTimeout(leanLoadTimer);
  leanFrame?.remove();
  leanFrame = null;
  document.getElementById('leanExternal').removeAttribute('href');
  document.getElementById('leanLoading').hidden = true;
  if (leanReturnFocus?.isConnected) leanReturnFocus.focus();
  leanReturnFocus = null;
});
