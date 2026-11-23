const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/lean-math.js'), 'utf8'), context);
const parse = tex => JSON.parse(JSON.stringify(context.parseLeanRelation(tex)));
const raw = String.raw;

function matches(tex, proposition, variables, conditions = []) {
  assert.deepEqual(parse(tex), { proposition, variables, conditions }, tex);
}

matches('2x+3y-z=21', '((((2 * x) + (3 * y)) - z) : ℝ) = (21 : ℝ)', ['x','y','z']);
matches(raw`x=\dfrac{3}{2}y+3`, '(x : ℝ) = ((((3 / 2) * y) + 3) : ℝ)', ['x','y']);
matches(raw`F=MA`, '(F : ℝ) = ((M * A) : ℝ)', ['F','M','A']);
matches(raw`2\left(x+1\right) \geq -x^2`, '((2 * (x + 1)) : ℝ) ≥ ((-(x ^ 2)) : ℝ)', ['x']);
matches(raw`0.5x_{01} - .4m₁ ≠ 0`, '(((0.5 * x_01) - (0.4 * m_1)) : ℝ) ≠ (0 : ℝ)', ['x_01','m_1']);
matches(raw`\theta + θ = 2θ`, '((v_theta + v_theta) : ℝ) = ((2 * v_theta) : ℝ)', ['v_theta']);
matches(raw`y = \frac{x}{\frac{a}{b}}`, '(y : ℝ) = ((x / (a / b)) : ℝ)', ['y','x','a','b'],
  ['(b : ℝ) ≠ 0', '((a / b) : ℝ) ≠ 0']);
matches('1/x + 2/x >= 0', '(((1 / x) + (2 / x)) : ℝ) ≥ (0 : ℝ)', ['x'], ['(x : ℝ) ≠ 0']);
matches('2 / (-3) < 1', '((2 / (-3)) : ℝ) < (1 : ℝ)', []);
matches('(-2)²=4', '(((-2) ^ 2) : ℝ) = (4 : ℝ)', []);
matches('1/2=0', '((1 / 2) : ℝ) = (0 : ℝ)', []);
matches('007=7', '(7 : ℝ) = (7 : ℝ)', []);
const chain = parse('0 < x = 1/y ≤ 2');
assert.deepEqual(chain.parts, ['(0 : ℝ) < (x : ℝ)', '(x : ℝ) = ((1 / y) : ℝ)', '((1 / y) : ℝ) ≤ (2 : ℝ)']);
assert.equal(chain.proposition, chain.parts.map(part => '(' + part + ')').join(' ∧ '));
assert.deepEqual(chain.variables, ['x','y']);
assert.deepEqual(chain.conditions, ['(y : ℝ) ≠ 0']);

for (const tex of [
  '', 'x', 'x=', 'x+1', 'x=1==1', 'x<y<', 'x^23=1', 'x_10=1',
  '1/0=0', '1/(0.0)=0', '1/-0=0', '1/2x=3', raw`8\frac{2}{3}=x`,
  'x^y=0', 'x^{-1}=0', 'x^{129}=1', '0<<1', '(x+1=2', 'x=f(t)',
  'x=sin(y)', 'x=lg(y)', '1..2=x', raw`\frac{dy}{dx}=1`,
  'x = 2; exact True.intro', 'x := by sorry', 'x -- foo\n=1', 'x ≈ y',
  raw`\forall x, x=x`, raw`x=\sqrt{x}`, raw`\text{x=y}`, raw`\begin{matrix}1\end{matrix}=x`,
  'x=1' + ' '.repeat(4096), 'x=' + '-'.repeat(500) + '1', null, {}
]) assert.equal(parse(tex), null, String(tex));

console.log('PASS real-number Lean translation, precedence, domain obligations and unsupported notation');
