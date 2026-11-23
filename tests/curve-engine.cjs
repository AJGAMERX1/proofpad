// Exercise exactly the functions sent to the worker by a built release, with
// Proofpad's pinned Compute Engine (including MathLive's raw tuple spelling).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
global.self = global;
require('../src/release-inputs/vendor/compute-engine.js');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '../docs/index.html'), 'utf8');
function section(from, to) {
 const start = html.indexOf(from), end = html.indexOf(to, start);
 assert(start >= 0 && end > start, 'Missing ' + from);
 return html.slice(start, end);
}
const ctx = vm.createContext({});
vm.runInContext(section('function compileGraphRows(', 'const graphCanvas='), ctx);
vm.runInContext(section('function calculateNotebook(', 'let calculatorWorker='), ctx);
const notebook = (rows, dimension='3d') => ctx.calculateNotebook(ProofpadComputeEngine, rows, 'rad', 10, ctx.compileGraphRows, dimension);
const evaluator = spec => ctx.graphEvaluator(spec.expr, spec.angle);
const close = (a,b) => assert(Math.abs(a-b) < 1e-10, a + ' ≠ ' + b);
const raw = String.raw;

for (const input of ['(t, sin(t), cos(t))', raw`\left(t,\sin\left(t\right),\cos\left(t\right)\right)`]) {
 const [row] = notebook([input]);
 assert.equal(row.graph.kind, 'curve');
 assert.equal(row.plotOnly, true);
 const run = evaluator(row.graph), samples = ctx.sampleParametricCurve(run, -2*Math.PI, 2*Math.PI);
 assert(samples.length >= 385);
 close(samples[0][0], -2*Math.PI);
 close(samples.at(-1)[0], 2*Math.PI);
 for (const p of samples) close(Math.hypot(p[1], p[2]), 1);
 close(run(Math.PI/2)[1], 1);
 assert.equal(ctx.sampleParametricCurve(run,-2*Math.PI,2*Math.PI), samples);
}
const [helix,slider,surface] = notebook(['(t, a sin(t), cos(t))','a=2',raw`z=\sin(x)\cos(y)`]);
assert.equal(slider.slider, true);
assert.equal(slider.number, 2);
assert.equal(helix.graph.slots[0][0], 1);
close(evaluator(helix.graph)(Math.PI/2)[1], 2);
const [sliderRow, ...slot] = helix.graph.slots[0];
let coordinate = helix.graph.expr;
for (const i of slot.slice(0,-1)) coordinate = coordinate[i];
coordinate[slot.at(-1)] = 3;
close(evaluator(helix.graph)(Math.PI/2)[1], 3);
assert.equal(surface.graph.kind, 'surface');
close(evaluator(surface.graph)(Math.PI/2,0), 1);
for(const tuple of ['(x,t,0)','(1,x,y)','(t,cos(y),2)']){
 assert.equal(notebook([tuple])[0].error, 'Use t as the parameter for a 3D curve.');
}
for(const rows of [['(t,sin(t),cos(t))'],['(t,sin(t),cos(t))','t=5']])
 assert.equal(notebook(rows,'2d')[0].error,'3D curves go in the 3D graph.');
assert.equal(notebook([raw`\begin{bmatrix}1&2\\3&4\end{bmatrix}`])[0].matrix.join(','),'2,2');
assert.equal(notebook(['(1,2,3)'])[0].graph.kind,'curve');
const withT = notebook(['(t,2t,0)','t=10']);
close(evaluator(withT[0].graph)(4)[1],8);
const [named] = notebook(['(t,f(t),0)','f(u)=u^2']);
close(evaluator(named.graph)(-3)[1],9);

for (const [input,expected] of [['2pi',2*Math.PI],['−2π',-2*Math.PI],['pi/2',Math.PI/2],['2(π+1)',2*(Math.PI+1)],['-2^2',-4],['2^-2',.25],['2^3^2',512],['1e-2',.01]]) close(ctx.parseCurveParameter(input),expected);
for (const input of ['','2+','4/0','bad','1 3','pi)','()','pi=x','a','-'.repeat(500)]) assert(Number.isNaN(ctx.parseCurveParameter(input)),input);
const line=ctx.sampleParametricCurve(t=>[t,1/(t-.013),0],-1,1);
assert(line.includes(null),'finite samples across a pole must split the path');
for(let i=1;i<line.length;i++)if(line[i] && line[i-1])assert(!(line[i-1][0]<.013 && line[i][0]>.013));
console.log('PASS worker tuples, sliders, helix radius, real-domain gaps, parameter bounds, 2D and surface compatibility');
