const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const scope = vm.createContext({});
const page = readFileSync(join(root, 'docs/index.html'), 'utf8');
vm.runInContext(page.match(/^function hasContent\(.*$/m)[0], scope);
for (const file of ['lean-math', 'lean-from-proof']) {
  vm.runInContext(readFileSync(join(root, 'src', file + '.js'), 'utf8'), scope);
}
const math = value => ({type: 'math', value});
const prose = value => ({type: 'text', value});
const analyze = (entries, extras = {}) => scope.analyzeLeanProof({entries, ...extras});
const build = (a, options) => scope.buildLeanProof(a, options);
const candidates = (a, goalId) => Array.from(scope.leanGivenCandidates(a, goalId), item => item.id);
const tex = String.raw;

const a = analyze([
  prose(tex`\text{}`), math('2x-3y=6'), prose(tex`\text{Add the same quantity to both sides.}`),
  math('2x=3y+6'), math('x=(3y)/2+3'), math('x=x'), prose('Additional notes.'),
], {title:'Isolate x', statement:'Solve for x over the reals.'});
assert.deepEqual(Array.from(a.items, item => item.id),
  ['statement','step-2','step-3','step-4','step-5','step-6','step-7']);
assert.equal(a.defaultGoal, 'step-6');
assert.deepEqual(candidates(a, 'step-5'), ['step-2','step-4']);
const result = build(a, {goalId:'step-5', givenIds:['step-2']});
assert.equal(result.givens, 1);
assert.equal(result.checked, 2);
assert.equal(result.notes, 4);
assert.deepEqual(Array.from(result.noteItems, item => item.id), ['statement','step-3','step-6','step-7']);
assert.match(result.source, /theorem proofpad_result \(x y : ℝ\)/);
assert.match(result.source, /Step 2 \(given\):/);
assert.match(result.source, /have proofpadStep1 :/);
assert.match(result.source, /Step 5 \(goal\):/);
assert.match(result.source, /Step 6 \(reference only\):/);
assert.doesNotMatch(result.source, /sorry|axiom/);
assert.throws(() => build(a, {goalId:'step-5', givenIds:['step-6']}));
assert.throws(() => build(a, {goalId:'step-5', givenIds:['step-5']}));
assert.throws(() => build(a, {goalId:'missing', givenIds:[]}));

const duplicate = analyze([math('z = x'), math('z=x')]);
assert.deepEqual(candidates(duplicate,'step-2'), []);
assert.throws(() => build(duplicate, {givenIds:['step-1']}));
const chainWithGoal = analyze([math('1<x=y'), math('x=y')]);
assert.deepEqual(candidates(chainWithGoal, 'step-2'), []);
const bad = analyze([math('2+2=5'), math('3=3')]);
const falseStep = build(bad);
assert.equal(falseStep.givens, 0);
assert.equal(falseStep.checked, 2);
assert.match(falseStep.source, /have proofpadStep1 : .*5 : ℝ\) := by proofpad_step/);

const fromStatement = analyze([math('x=y'), math('2x=2y')], {statement:'$x+1=y+1$.'});
assert.equal(fromStatement.defaultGoal, 'statement');
assert.deepEqual(candidates(fromStatement,'statement'), ['step-1','step-2']);
const provedStatement = build(fromStatement,{givenIds:['step-1']});
assert.match(provedStatement.source, /-- Statement \(goal\):/);
assert.match(provedStatement.source, /-- Step 2:/);
const otherGoal = build(fromStatement,{goalId:'step-2',givenIds:['step-1']});
assert.match(otherGoal.source, /-- Statement \(reference only\):/);
assert.equal(otherGoal.checked,1);

const partial = analyze([prose('For a=b use this result.'),prose(tex`\text{a = b}`),
  prose(tex`$x=y$`),math(tex`\begin{pmatrix}1&0\\0&1\end{pmatrix}`)]);
assert.deepEqual(Array.from(partial.items, item => Boolean(item.relation)), [false,true,true,false]);
const outline = build(analyze([prose('First do the induction.\naxiom fake : False')],{title:'Notes\n#eval 7'}));
assert.match(outline.source,/-- Notes\n-- #eval 7/);
assert.match(outline.source,/\n-- axiom fake : False/);
assert.doesNotMatch(outline.source,/^axiom/m);
assert.match(outline.source,/theorem proofpad_result : _ := by\n  fail/);
assert.equal(outline.checked,0);
assert.equal(outline.notes,1);
assert.deepEqual(Array.from(outline.noteItems, item => item.id), ['step-1']);

const denom = build(analyze([math('x/x=1'),math('x/x+2=3')]));
assert.match(denom.source,/have proofpadNonzero1 : \(x : ℝ\) ≠ 0 := by proofpad_step/);
assert.doesNotMatch(denom.source,/proofpadGiven|proofpadNonzero2/);
const chainGiven = build(analyze([math('0<x<y<z'),math('0<z')]), {givenIds:['step-1']});
assert.match(chainGiven.source,/obtain ⟨proofpadGiven1Part1, proofpadGiven1Part2, proofpadGiven1Part3⟩/);
const chain = build(analyze([math('x+x=2x=x\u00b72'),math('1<2<3')]));
assert.match(chain.source,/have proofpadStep1Part1 :/);
assert.match(chain.source,/have proofpadStep1Part2 :/);
assert.match(chain.source,/refine ⟨\?_, \?_⟩ <;> proofpad_step/);
console.log('PASS Lean proof generation preserves rows, givens, goals, incomplete notes, division conditions and chains.');
