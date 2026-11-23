// Run the same parser, graph compiler and evaluation function used by the Web Worker.
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
global.self=global;
require('../src/release-inputs/vendor/compute-engine.js');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'../docs/index.html'),'utf8');
const ctx=vm.createContext({});
for(const [start,end] of [['function compileGraphRows(','const graphCanvas='],['function calculateNotebook(','let calculatorWorker=']]){
 const from=html.indexOf(start),to=html.indexOf(end,from);
 assert(from>=0 && to>from);
 vm.runInContext(html.slice(from,to),ctx);
}
const raw=String.raw;
function run(inputs,angle='rad'){
 const result=ctx.calculateNotebook(ProofpadComputeEngine,inputs,angle,10,ctx.compileGraphRows,'2d');
 return structuredClone(result); // An error in one row must not break the worker message.
}
const [sum,product,nested,,parameter]=run([raw`\sum_{n=1}^{100}n`,raw`\prod_{n=1}^4 n`,
 raw`\sum_{n=1}^3 \sum_{k=1}^n k`,'n=9',raw`\sum_{k=1}^a ak`,'a=3']);
assert.equal(sum.number,5050);assert.equal(product.number,24);assert.equal(nested.number,10);assert.equal(parameter.number,18);
const [integral,derivative,rational,transcendental]=run([raw`\int_0^1 x^2 dx`,raw`\frac{d}{dx}x^3`,'1/3+1/6',raw`\sin(1)`]);
assert.equal(integral.latex,raw`\frac{1}{3}`);assert.equal(integral.approx,false);
assert.equal(derivative.latex,'3x^2');assert.equal(ctx.graphEvaluator(derivative.graph.expr,'rad')(2),12);
assert.equal(rational.latex,raw`\frac{1}{2}`);assert.equal(rational.approx,false);
assert.equal(transcendental.approx,true);
assert.equal(run([raw`\frac{d}{dx} x^3`,'x=2'])[0].number,12);
assert.equal(run([raw`\int_1^0 x^2 dx`,'x=20'])[0].number,-1/3);
assert.equal(run(['b='+raw`\sum_{k=1}^3 k`,'b+1'])[1].number,7);
assert.match(run([raw`\int x dx`])[0].error,/definite integral/);
assert.match(run([raw`\int_{-1}^1 \frac{1}{x} dx`])[0].error,/finite/);
assert.match(run([raw`\sum_{n=1}^{2000000}n`])[0].error,/10,000/);
assert.match(run([raw`\sum_{n=a}^4 n`])[0].error,/bounds/);
assert.match(run([raw`\frac{d}{dx}\sin(x)`],'deg')[0].error,/Radians/);
assert.match(run([raw`\frac{d}{dx}\frac{x}{x}`,'x=0'])[0].error,/domain/);
const partials=run([raw`\frac{d}{dx}xy`,raw`\frac{d}{dy}xy`]);
assert.equal(partials[0].latex,'y');assert.equal(partials[1].latex,'x');
const filterStart=html.indexOf('function plainMathMarkup('),filterEnd=html.indexOf('function protectMathField(',filterStart);
assert(filterStart>=0 && filterEnd>filterStart);
vm.runInContext(html.slice(filterStart,filterEnd),ctx);
for(const name of ['style','class','htmlStyle','htmlClass','htmlData','htmlId','cssId'])
 assert.equal(ctx.plainMathMarkup('1+'+String.fromCharCode(92)+name+' {label} {x+y}'),'1+ {x+y}');
for(const original of [raw`\displaystyle \mathbf{x} + \mathcal{A}`,raw`\textstyle\frac{a}{b}`,raw`\begin{matrix}a\\style\end{matrix}`])
 assert.equal(ctx.plainMathMarkup(original),original);
console.log('PASS scoped calculus, finite bounds, symbolic derivatives, exact rationals and structured worker errors');
