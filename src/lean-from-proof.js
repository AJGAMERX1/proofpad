// Turn the writer's selected arithmetic claims into ordinary, editable Lean.
function analyzeLeanProof(draft) {
  const items = [];
  function add(id, kind, label, value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!hasContent(raw)) return;
    const text = kind === 'text' ? raw.replace(/\\text\{([^{}]*)\}/g, '$1') : raw;
    const singleTextRun = /^\\text\{([^{}]*)\}$/.exec(raw);
    const formula = singleTextRun ? singleTextRun[1].trim() : raw;
    const wrapper = /^\$\$([^$]+)\$\$\.?$/.exec(formula)
      || /^\$([^$]+)\$\.?$/.exec(formula)
      || /^\\\(([\s\S]+)\\\)\.?$/.exec(formula)
      || /^\\\[([\s\S]+)\\\]\.?$/.exec(formula);
    // A sentence such as "Let a = b" is not a product of single-letter variables.
    // Fully delimited math and display equations use normal algebraic notation.
    const bareWords = /\p{L}{2,}/u.test(formula.replace(/\\[a-zA-Z]+/g, ' '));
    const canParse = wrapper || !bareWords || (kind === 'math' && !singleTextRun);
    const relation = canParse ? parseLeanRelation(wrapper ? wrapper[1] : formula) : null;
    items.push({id, kind, label, text, relation});
  }
  add('statement', 'statement', 'Statement', draft.statement);
  (draft.entries || []).forEach((entry, index) => {
    if (entry) add('step-' + (index + 1), entry.type, 'Step ' + (index + 1), entry.value);
  });
  const claims = items.filter(item => item.relation);
  const goal = claims.find(item => item.kind === 'statement') || claims[claims.length - 1];
  return {title: typeof draft.title === 'string' ? draft.title.trim() : '', items, defaultGoal: goal?.id || null};
}

function leanGivenCandidates(analysis, goalId) {
  const target = analysis.items.findIndex(item => item.id === goalId && item.relation);
  if (target < 0) return [];
  const goal = analysis.items[target];
  const goalParts = goal.relation.parts || [goal.relation.proposition];
  return analysis.items.filter((item, index) => {
    if (!item.relation || item.id === goalId || (goal.kind !== 'statement' && index >= target)) return false;
    const parts = item.relation.parts || [item.relation.proposition];
    return !goalParts.every(part => parts.includes(part));
  });
}

function buildLeanProof(analysis, options = {}) {
  const goalId = options.goalId === undefined ? analysis.defaultGoal : options.goalId;
  const goal = analysis.items.find(item => item.id === goalId && item.relation);
  if (goalId != null && !goal) throw new Error('Choose a recognized equation or inequality as the goal.');
  const givenIds = new Set(options.givenIds || []);
  const givens = leanGivenCandidates(analysis, goalId).filter(item => givenIds.has(item.id));
  if (givenIds.size !== givens.length) throw new Error('Choose givens that precede the goal and differ from it.');

  const beforeGoal = goal?.kind === 'statement' ? analysis.items.length : analysis.items.indexOf(goal);
  const steps = analysis.items.filter((item, index) => index < beforeGoal && item.kind !== 'statement'
    && item.relation && !givenIds.has(item.id));
  const checked = steps.length + (goal ? 1 : 0);
  const notes = analysis.items.length - checked - givens.length;
  const lines = ['import Mathlib', ''];
  function comment(prefix, value, indent = '') {
    const safe = value.replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u202A-\u202E\u2066-\u2069]/g, ' ');
    // Prefix every physical line; even pasted Lean commands remain comments.
    for (const line of (prefix + safe).split('\n')) lines.push(indent + '-- ' + line);
  }
  if (analysis.title) comment('', analysis.title);
  if (!goal) {
    for (const item of analysis.items) comment(item.label + ' (reference only): ', item.text);
    lines.push('-- Replace the underscore with the proposition expressed by your statement.',
      'theorem proofpad_result : _ := by',
      '  fail "Enter the formal statement and proof here."', '');
    return {source: lines.join('\n'), checked, givens: 0, notes, noteItems: analysis.items,
      summary: 'Outline only. Write a formal goal and proof in the marked places.'};
  }

  comment('Goal: ', goal.label + ' over the real numbers.');
  if (givens.length) comment('Assumed as given: ', givens.map(item => item.label).join(', ') + '.');
  if (notes) comment('', 'Reference notes appear as comments and are outside this check.');
  const checkedIds = new Set(steps.map(step => step.id));
  const noteItems = analysis.items.filter(item => item.id !== goal.id && !givenIds.has(item.id) && !checkedIds.has(item.id));
  for (const item of noteItems) comment(item.label + ' (reference only): ', item.text);
  lines.push('', '-- Each tactic must close its goal. You can replace proofpad_step with your own proof.',
    'local macro "proofpad_step" : tactic =>',
    '  `(tactic| first',
    '    | assumption',
    '    | rfl',
    '    | (norm_num <;> done)',
    '    | ring1',
    '    | linarith',
    '    | nlinarith',
    '    | (positivity <;> done)',
    '    | (field_simp [*] <;> ring1)',
    '    | fail "This step needs a proof from the selected givens and earlier steps.")', '');

  const facts = [...givens, ...steps, goal];
  const vars = [...new Set(facts.flatMap(item => item.relation.variables))];
  const binder = vars.length ? ' (' + vars.join(' ') + ' : ℝ)' : '';
  lines.push('theorem proofpad_result' + binder);
  for (const [index, item] of givens.entries()) {
    comment(item.label + ' (given): ', item.text, '    ');
    lines.push('    (proofpadGiven' + (index + 1) + ' : ' + item.relation.proposition + ')');
  }
  lines.push('    : ' + goal.relation.proposition + ' := by');
  // A chained given has one hypothesis per adjacent comparison inside its conjunction.
  for (const [index, item] of givens.entries()) {
    const parts = item.relation.parts || [];
    if (parts.length > 1) {
      const names = parts.map((_, part) => 'proofpadGiven' + (index + 1) + 'Part' + (part + 1));
      lines.push('  obtain ⟨' + names.join(', ') + '⟩ := proofpadGiven' + (index + 1));
    }
  }
  const provenConditions = new Set();
  function denominatorChecks(item) {
    for (const condition of item.relation.conditions || []) {
      if (provenConditions.has(condition)) continue;
      provenConditions.add(condition);
      comment(item.label + ': ', 'justify division by a nonzero denominator.', '  ');
      lines.push('  have proofpadNonzero' + provenConditions.size + ' : ' + condition + ' := by proofpad_step');
    }
  }
  givens.forEach(denominatorChecks);
  for (const [index, item] of steps.entries()) {
    denominatorChecks(item);
    comment(item.label + ': ', item.text, '  ');
    const parts = item.relation.parts || [item.relation.proposition];
    for (const [part, claim] of parts.entries()) {
      const suffix = parts.length > 1 ? 'Part' + (part + 1) : '';
      lines.push('  have proofpadStep' + (index + 1) + suffix + ' : ' + claim + ' := by proofpad_step');
    }
  }
  denominatorChecks(goal);
  comment(goal.label + ' (goal): ', goal.text, '  ');
  if (goal.relation.parts?.length > 1) {
    lines.push('  refine ⟨' + goal.relation.parts.map(() => '?_').join(', ') + '⟩ <;> proofpad_step', '');
  } else lines.push('  proofpad_step', '');
  const plural = (count, name) => count + ' ' + name + (count === 1 ? '' : 's');
  const summary = [plural(checked, 'claim') + ' for Lean', plural(givens.length, 'given'),
    plural(notes, 'reference note')].join(' · ');
  return {source: lines.join('\n'), summary, checked, givens: givens.length, notes, noteItems};
}
