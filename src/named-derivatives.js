// Differentiate the expanded notebook function with respect to a fresh
// parameter. Substitute the caller's argument only after differentiation.
function namedDerivative(body,parameter,order) {
 if (!Number.isInteger(order) || order<1 || order>4) throw Error('Use one to four primes on a one-variable function.');
 const supported=new Set(['Add','Subtract','Negate','Multiply','Divide','Power','Rational','Sin','Cos','Exp']);
 function size(node) {
  if (!Array.isArray(node)) return 1;
  // Symbolic simplification can erase a domain restriction: the derivative
  // of t/t would otherwise be displayed as zero even at t=0.
  const [op,,exponent]=node;
  const integerPower=Number.isSafeInteger(exponent) && exponent>=0;
  const constantDivisor=typeof exponent==='number' && Number.isFinite(exponent) && exponent!==0;
  if (!supported.has(op) || (op==='Power' && !integerPower) || (op==='Divide' && !constantDivisor))
   throw Error('Symbolic differentiation supports polynomials, sin, cos and exp. For other functions, enter the derivative formula with its domain.');
  if (angle!=='rad' && (node[0]==='Sin' || node[0]==='Cos')) throw Error('Choose Radians to differentiate a trigonometric function.');
  return 1+node.slice(1).reduce((n,child)=>n+size(child),0);
 }
 const key=JSON.stringify([body,parameter,order]);
 if (derivatives.has(key)) return derivatives.get(key);
 let result=body;
 for (let i=0;i<order;i++) {
  if (size(result)>350) throw Error('This derivative is too large to expand.');
  result=ce.expr(['D',result,parameter]).evaluate().json;
 }
 if (size(result)>500) throw Error('This derivative is too large to expand.');
 derivatives.set(key,result);
 return result;
}
