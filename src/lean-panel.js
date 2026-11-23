const leanEditor = document.getElementById('leanSource');
const leanStatus = document.getElementById('leanStatus');
const leanReturnSource = document.getElementById('leanReturnSource');
let leanSourceRevision = 0;

function updatedLeanImports(source) {
  // Only adjust the first import, allowing leading blank lines and line comments.
  const legacy = /^((?:[ \t]*(?:--[^\n]*)?\n)*[ \t]*)import[ \t]+Mathlib\.Data\.Real\.Basic[ \t]*(?:\nimport[ \t]+Mathlib\.Tactic\.Linarith[ \t]*)?(?=\n|$)/;
  return source.replace(legacy, '$1import Mathlib');
}

function updateLeanEditor() {
  leanSourceRevision++;
  const empty = !leanEditor.value.trim();
  $('#leanCheck').disabled = empty;
  $('#leanDownload').disabled = !leanEditor.value;
  $('#leanLegacyImport').hidden = updatedLeanImports(leanEditor.value) === leanEditor.value;
  leanStatus.textContent = '';
}

function restoreLeanSource(value) {
  closeLeanChecker();
  if ($('#leanReview').open) $('#leanReview').close();
  leanEditor.value = value;
  updateLeanEditor();
}

function insertLeanFile(source) {
  validateLeanSource(source);
  if (leanEditor.value === source) return true;
  if (leanEditor.value.trim() && !window.confirm('Replace the current Lean source? You can undo this change.')) return false;
  replaceLeanSource(source);
  leanEditor.focus();
  leanEditor.setSelectionRange(0, 0);
  return true;
}

leanEditor.addEventListener('input', updateLeanEditor);
$('#leanUpdateImport').addEventListener('click', () => {
  replaceLeanSource(updatedLeanImports(leanEditor.value));
  leanStatus.textContent = 'Updated the Mathlib import. You can check this source again.';
  $('#leanCheck').focus();
});
leanEditor.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    $('#leanCheck').click();
  }
});

$('#leanExample').addEventListener('change', event => {
  const sample = leanExamples[event.target.value];
  event.target.value = '';
  if (sample) insertLeanFile(sample);
});

$('#leanImport').addEventListener('click', () => $('#leanFile').click());
$('#leanFile').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const revision = ++leanSourceRevision;
  try {
    if (file.size > 4 * maxLeanSourceLength + 3) throw new Error('Choose a Lean file of up to 100,000 characters.');
    const bytes = await file.arrayBuffer();
    if (revision !== leanSourceRevision) return;
    let source;
    try {
      source = new TextDecoder('utf-8', {fatal:true}).decode(bytes).replace(/\r\n?/g, '\n');
    } catch {
      throw new Error('Save the .lean file as UTF-8 text and try again.');
    }
    if (source.includes('\u0000')) throw new Error('Choose a plain-text .lean file.');
    if (insertLeanFile(source)) leanStatus.textContent = 'Imported ' + file.name;
  } catch (error) {
    if (revision === leanSourceRevision) leanStatus.textContent = error.message;
  }
});

$('#leanDownload').addEventListener('click', () => {
  const name = $('#title').value.trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) || 'Proof';
  saveDownload(new Blob([leanEditor.value], {type:'text/plain;charset=utf-8'}), name + '.lean');
});

$('#leanCheck').addEventListener('click', () => {
  if (workspaceMode !== 'proofs' || !leanEditor.value.trim()) return;
  try {
    openLeanChecker(leanEditor.value);
  } catch {
    leanStatus.textContent = 'Could not open the checker. Download the .lean file to check it in Lean.';
  }
});

function showLeanReturn(open) {
  $('#leanReturnPanel').hidden = !open;
  $('#leanReturnOpen').setAttribute('aria-expanded', String(open));
  if (open) leanReturnSource.focus();
  else {
    leanReturnSource.value = '';
    $('#leanReturnApply').disabled = true;
    $('#leanReturnMessage').textContent = '';
  }
}

$('#leanReturnOpen').addEventListener('click', () => showLeanReturn($('#leanReturnPanel').hidden));
$('#leanReturnCancel').addEventListener('click', () => {
  showLeanReturn(false);
  $('#leanReturnOpen').focus();
});
leanReturnSource.addEventListener('input', () => {
  $('#leanReturnApply').disabled = !leanReturnSource.value.trim();
  $('#leanReturnMessage').textContent = '';
});
$('#leanReturnApply').addEventListener('click', () => {
  const source = leanReturnSource.value;
  try {
    replaceLeanSource(source);
    leanStatus.textContent = 'Saved the edited Lean source to this proof.';
  } catch (error) {
    $('#leanReturnMessage').textContent = error.message;
  }
});
$('#leanDialog').addEventListener('close', () => {
  if (!$('#leanDialog').open) showLeanReturn(false);
});
