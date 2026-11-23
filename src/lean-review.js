const leanReview = $('#leanReview');
let leanAnalysis;
let leanPrepared;

function currentWrittenProof() {
  return {title: $('#title').value, statement: $('#statement').value, entries: entries()};
}

function leanItemLabel(item) {
  let text = item.text;
  if (item.relation && /[\\${]/.test(text) && window.MathLive?.convertLatexToAsciiMath) {
    const math = text.replace(/^\$+|\$+\.?$/g, '');
    try { text = MathLive.convertLatexToAsciiMath(math) || text; } catch { /* Use the original notation. */ }
  }
  return item.label + ' · ' + text;
}

function leanReviewSelection() {
  const givenIds = Array.from($('#leanGivenChoices').querySelectorAll('input:checked'), input => input.value);
  return {goalId: $('#leanGoal').value || null, givenIds};
}

function updateLeanPreview() {
  const selection = leanReviewSelection();
  leanPrepared = null;
  let message;
  try {
    if (leanAnalysis.items.length) {
      const result = buildLeanProof(leanAnalysis, selection);
      validateLeanSource(result.source);
      leanPrepared = result;
      message = result.summary;
    }
  } catch (error) {
    message = error.message;
  }
  $('#leanPreviewCode').textContent = leanPrepared?.source || '';
  $('#leanPreviewSource').hidden = !leanPrepared;
  const notes = leanPrepared?.noteItems || [];
  $('#leanNotesLabel').textContent = 'Reference notes (' + notes.length + ')';
  $('#leanReviewNotes').hidden = !notes.length;
  $('#leanNotesList').replaceChildren(...notes.map(item => {
    const line = document.createElement('li');
    line.textContent = leanItemLabel(item);
    return line;
  }));
  $('#leanReviewSummary').textContent = message || '';
  $('#leanReviewSave').disabled = !leanPrepared;
  $('#leanReviewCheck').hidden = !selection.goalId;
  $('#leanReviewCheck').disabled = !leanPrepared;
  $('#leanReviewSave').textContent = selection.goalId ? 'Save Lean source' : 'Open editable outline';
}

function updateLeanGivenChoices() {
  const selected = new Set(leanReviewSelection().givenIds);
  const candidates = leanGivenCandidates(leanAnalysis, $('#leanGoal').value || null);
  const container = $('#leanGivenChoices');
  container.replaceChildren();
  for (const item of candidates) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.id;
    input.checked = selected.has(item.id);
    const caption = document.createElement('span');
    caption.textContent = leanItemLabel(item);
    label.append(input, caption);
    container.append(label);
  }
  $('#leanGivens').hidden = !candidates.length;
  updateLeanPreview();
}

function readWrittenProof() {
  leanAnalysis = analyzeLeanProof(currentWrittenProof());
  const goal = $('#leanGoal');
  goal.replaceChildren();
  $('#leanGivenChoices').replaceChildren();
  for (const item of leanAnalysis.items.filter(item => item.relation)) {
    goal.add(new Option(leanItemLabel(item), item.id));
  }
  if (leanAnalysis.defaultGoal) goal.value = leanAnalysis.defaultGoal;
  goal.hidden = !goal.options.length;
  $('#leanGoalLabel').hidden = goal.hidden;
  const hint = $('#leanReviewHint');
  if (goal.options.length) {
    hint.textContent = 'Choose the conclusion. Proofpad translates supported algebra over the real numbers (ℝ) and keeps explanations as comments.';
  } else if (leanAnalysis.items.length) {
    hint.textContent = 'Your writing is ready to copy into a Lean outline. To check it, formalize the statement and reasoning in that outline, or add an algebraic equation on its own line here in Proofpad.';
  } else {
    hint.textContent = 'Write a statement or add an equation to your proof, then reopen this window.';
  }
  $('#leanPreviewSource').open = false;
  $('#leanReviewNotes').open = false;
  updateLeanGivenChoices();
}

function applyWrittenProof(check) {
  if (!leanPrepared || workspaceMode !== 'proofs') return;
  const {source, summary} = leanPrepared;
  const panel = $('#leanPanel');
  if (!insertLeanFile(source)) return;
  leanReview.close();
  panel.open = true;
  leanStatus.textContent = summary;
  if (check) {
    $('#leanCheck').focus();
    $('#leanCheck').click();
  } else {
    leanEditor.focus();
    leanEditor.setSelectionRange(0, 0);
  }
}

$('#leanFromPaper').addEventListener('click', () => {
  if (workspaceMode !== 'proofs' || leanReview.open) return;
  readWrittenProof();
  leanReview.showModal();
  ($('#leanGoal').hidden ? $('#leanReviewClose') : $('#leanGoal')).focus();
});
$('#leanGoal').addEventListener('change', updateLeanGivenChoices);
$('#leanGivenChoices').addEventListener('change', updateLeanPreview);
$('#leanReviewSave').addEventListener('click', () => applyWrittenProof(false));
$('#leanReviewCheck').addEventListener('click', () => applyWrittenProof(true));
$('#leanReviewClose').addEventListener('click', () => leanReview.close());
