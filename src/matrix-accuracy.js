// Keep an exact expression alongside its numeric value for definitions that
// are substituted into another row (including scalar factors in a matrix).
function evaluate(expr) {
 const calculus=prepareCalculus(expr);
 if(calculus)expr=calculus.value;
 const substitutions={};
 for (const symbol of expr.unknowns) {
  if (!definitions.has(symbol) && calculus?.symbolic.has(symbol)) continue;
  if (!definitions.has(symbol)) throw Error('Define '+ce.expr(symbol).latex+' on another line.');
  substitutions[symbol]=resolve(symbol).exact.json;
 }
 const substituted=expr.subs(substitutions);
 const exact=substituted.evaluate();
 if (exact.operator==='Error' && JSON.stringify(exact.json).includes('incompatible-dimensions')) {
  // Inspect operand shapes only on failure. Calculating large products twice
  // on every successful evaluation makes sliders unnecessarily expensive.
  const shapes=substituted.ops.map(op=>op.evaluate()).filter(op=>op.operator==='List' && op.ops[0]?.operator==='List')
   .map(op=>[op.ops.length,op.ops[0].ops.length]);
  if (shapes.length===2) {
   const [a,b]=shapes, sizes=a.join(' × ')+' and '+b.join(' × ');
   if (['Multiply','InvisibleOperator'].includes(substituted.operator))
    throw Error('Cannot multiply matrices of sizes '+sizes+'. The first has '+a[1]+' columns and the second has '+b[0]+' rows; these counts must match.');
   throw Error('These matrices have sizes '+sizes+'. This operation requires matching dimensions.');
  }
  throw Error('Incompatible matrix dimensions. Addition needs equal sizes. For a product, the first column count must equal the second row count.');
 }
 if (calculus && exact.unknowns.length && exact.unknowns.every(name=>calculus.symbolic.has(name))) return {exact,value:exact};
 const value=isNumericMatrix(exact)?exact:exact.N();
 if (value.json==='True' || value.json==='False' || isNumericMatrix(value)) return {exact,value};
 if (!Number.isFinite(value.re) || !Number.isFinite(value.im))
  throw Error('Undefined or not a finite number. Check division by zero and function inputs.');
 return {exact,value};
}
function matrixAnswer(exact,value) {
 let approx=false;
 const rows=value.ops.map((row,r)=>row.ops.map((cell,c)=>{
  const source=exact.operator==='List'?exact.ops[r]?.ops[c]:null;
  if (source && (source.operator==='Integer' || source.numericValue?.isExact===true ||
      (source.numericValue==null && source.latex && source.N().isFinite===true))) return source.latex;
  approx=true;
  return cell.im===0?numberLatex(cell.re):cell.latex;
 }));
 const latex='\\begin{bmatrix}'+rows.map(row=>row.join(' & ')).join('\\\\')+'\\end{bmatrix}';
 return {latex,approx,matrix:[rows.length,rows[0].length]};
}
