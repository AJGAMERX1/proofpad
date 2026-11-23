// MathLive serializes punctuation in a text atom using TeX's math-mode
// spacing and quotation commands. Interpret these only in prose ranges.
function paragraphLatex(source) {
 if (!/\\!|``|''/.test(source)) return source;
 for (const [start, end] of proseRanges(source, true).reverse()) {
  const text = source.slice(start, end).replace(/\\!|``|''/g,
   token => token === '\\!' ? '!' : token === '``' ? '“' : '”');
  source = source.slice(0, start) + text + source.slice(end);
 }
 return source;
}
function savedFieldValue(field, source=field.value) {
 return field.classList.contains('explanation-field') ? paragraphLatex(source) : source;
}
const erasedProse = new WeakSet();
const paragraphDepth = field => field.getElementInfo(field.position)?.depth ?? 0;

function leaveParagraphMath(field, depth) {
 scriptReturns.delete(field);
 while (paragraphDepth(field) > depth) {
  const position = field.position;
  field.executeCommand('moveAfterParent');
  if (field.position === position) break;
 }
 field.executeCommand(['switchMode','text']);
 syncEntryMode();
}
function startParagraphScript(field, command) {
 const depth = paragraphDepth(field), pos = field.position;
 const range = field.selection.ranges[0];
 if (range && range[0] === range[1] && pos > 0) {
  const variable = /^\\text\{([A-Za-z])\}$/.exec(field.getValue([pos-1,pos]));
  const previous = pos > 1 ? field.getValue([pos-2,pos-1]) : '';
  if (variable && !/^\\text\{[A-Za-z]\}$/.test(previous)) {
   field.selection = {ranges:[[pos-1,pos]]};
   field.executeCommand(['switchMode','math']);
   field.insert(variable[1], {mode:'math',format:'latex',selectionMode:'after'});
  }
 }
 field.executeCommand(command);
 erasedProse.delete(field);
 scriptReturns.set(field, {depth:paragraphDepth(field), baseDepth:depth, typed:false});
}
function prepareParagraphInput(field, key) {
 if (key === 'Backspace' || key === 'Delete') {
  if (field.mode === 'text') erasedProse.add(field);
  if (erasedProse.has(field)) queueMicrotask(() => {
   if (field.isConnected && erasedProse.has(field) && field.mode === 'math') {
    // Keep the location for another Backspace, and keep the mode label truthful.
    field.executeCommand(['switchMode','text']);
    syncEntryMode();
   }
  });
  return;
 }
 const script = scriptReturns.get(field);
 const delimiter = /^[\s.,;:!?“”‘’"')\]]$/u.test(key);
 if (script?.baseDepth != null && delimiter) {
  leaveParagraphMath(field, script.baseDepth);
  erasedProse.delete(field);
 } else if (erasedProse.has(field) && key.length === 1 && !/^\d$/.test(key)) {
  // A deletion may move into the last atom without removing it. Keep the
  // next word in the paragraph and allow another deletion or digit to edit it.
  leaveParagraphMath(field, 0);
  erasedProse.delete(field);
 } else if (erasedProse.has(field) && /^\d$/.test(key) && paragraphDepth(field) > 0 && field.mode !== 'math') {
  field.executeCommand(['switchMode','math']);
 } else if (/^(Arrow|Home$|End$|Tab$|Enter$)/.test(key)) {
  erasedProse.delete(field);
 }
}

function insertNotebookExample(example) {
 const draft = snapshotDraft();
 const untouched = workspaceMode === 'proofs' && Object.values(examples).some(sample =>
  sample.statement && draft.qed === sample.qed && draft.proofStyle === sample.proofStyle &&
  draft.dividers === sample.dividers && draft.exportNumbering === sample.exportNumbering &&
  draft.title === sample.title && draft.statement === (sample.statement || '') &&
  draft.statementKind === (sample.statementKind || 'Theorem') &&
  sample.entries.length === draft.entries.length && sample.entries.every((step,index) => {
   const current = draft.entries[index];
   return step.type === current.type && current.value ===
    (step.type === 'text' ? explanationSource(step.value,step.format) : step.value);
  }));
 const empty = !draft.title.trim() && !draft.statement.trim() &&
  draft.entries.every(entry => !hasContent(entry.value));
 beforeEdit();
 if (!draft.leanSource?.trim() && (empty || untouched)) {
  applyDraft(workspaceMode, {...draft,...example});
  status('Example loaded.');
 } else {
  for (const step of example.entries) addRow(step.value,false,step.type,step.format,step.slider);
  schedule();status('Example steps added to your draft.');
 }
}

let mathScrollFrame;
function scheduleEquationScrollHints() {
 if (mathScrollFrame) return;
 mathScrollFrame = requestAnimationFrame(() => {
  mathScrollFrame = 0;
  for (const row of document.querySelectorAll('#rows .row[data-type="math"]')) {
   const field = row.querySelector('math-field'), content = field?.shadowRoot?.querySelector('[part~="content"]');
   if (!content) continue;
   const overflow = content.clientWidth > 0 && content.scrollWidth > content.clientWidth + 3;
   let hint = row.querySelector('.equation-scroll-hint');
   if (overflow && !hint) {
    hint = document.createElement('small');hint.className = 'equation-scroll-hint';
    hint.textContent = '↔ Scroll equation horizontally';field.after(hint);
   }
   if (hint) hint.hidden = !overflow;
  }
 });
}
new ResizeObserver(scheduleEquationScrollHints).observe(document.querySelector('#rows'));
document.querySelector('#rows').addEventListener('input',scheduleEquationScrollHints);
document.querySelector('#latex').addEventListener('input',scheduleEquationScrollHints);
document.fonts?.addEventListener('loadingdone',scheduleEquationScrollHints);
