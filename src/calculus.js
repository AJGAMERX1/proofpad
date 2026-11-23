// Lower scoped operators before free-symbol lookup and graph compilation. Named
// notebook variables must never replace a sum index or differentiation variable.
const calculusOps = new Set(['Sum','Product','Integrate','D']);
const calculusCache = new WeakMap();
function hasScopedOperation(tree) {
 return Array.isArray(tree) && (calculusOps.has(tree[0]) || tree.slice(1).some(hasScopedOperation));
}

function prepareCalculus(expr) {
 if (calculusCache.has(expr)) return calculusCache.get(expr);
 if (!hasScopedOperation(expr.json)) return null;
 const symbolic = new Set();
 let termsLeft = 10000;
 const limitError = 'Use a finite sum or product of at most 10,000 terms.';

 function finiteBound(tree) {
  const value = ce.expr(tree,{form:'raw'});
  const replacements = {};
  for (const name of value.unknowns) {
   if (!definitions.has(name)) throw Error('Define '+ce.expr(name).latex+' in the bounds on another line.');
   replacements[name] = resolve(name).exact.json;
  }
  const exact=value.subs(replacements).evaluate(), number=exact.N();
  return {exact:exact.json, number:number.im===0?number.re:NaN};
 }
 function walk(node, scope) {
  if (!Array.isArray(node)) return scope.has(node) ? scope.get(node) : node;
  const [op, body, limit] = node;
  if (op === 'D') {
   if (typeof limit !== 'string' || node.length !== 3) throw Error('Differentiate with respect to one named variable.');
   const local = new Map(scope).set(limit,limit);
   // Use the same domain-preserving subset as f′(x). Simplifying first
   // would turn d(x/x)/dx into zero even at the excluded point x=0.
   function derivativeTree(part) {
    if(!Array.isArray(part))return part;
    if(part[0]==='Delimiter' && part.length===2)return derivativeTree(part[1]);
    if(part[0]==='Power' && part[1]==='ExponentialE')return ['Exp',derivativeTree(part[2])];
    return [part[0]==='InvisibleOperator'?'Multiply':part[0],...part.slice(1).map(derivativeTree)];
   }
   const differentiated=ce.expr(namedDerivative(derivativeTree(walk(body,local)),limit,1));
   for (const name of differentiated.unknowns) symbolic.add(name);
   return scope.has(limit) ? differentiated.subs({[limit]:scope.get(limit)}).json : differentiated.json;
  }
  if (!['Sum','Product','Integrate'].includes(op))
   return [op,...node.slice(1).map(child=>walk(child,scope))];

  const integral = op === 'Integrate';
  const name = limit?.[1];
  if (node.length !== 3 || !Array.isArray(limit) || !['Limits','Tuple'].includes(limit[0]) ||
      limit.length !== 4 || typeof name !== 'string')
   throw Error(integral ? 'Enter a definite integral with two finite bounds and a differential such as dx.' : limitError);
  const lowTree=walk(limit[2],scope), highTree=walk(limit[3],scope);
  const lower=finiteBound(lowTree), upper=finiteBound(highTree);
  const lo=lower.number, hi=upper.number;
  if (integral) {
   if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw Error('Use finite real bounds for a definite integral.');
   if (angle === 'deg' && /"(?:Sin|Cos|Tan|Cot|Sec|Csc|Arcsin|Arccos|Arctan)"/.test(JSON.stringify(body)))
    throw Error('Choose Radians to integrate a trigonometric expression.');
  } else {
   if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi)) throw Error(limitError);
   const count = Math.max(0, hi-lo+1);
   if (count > termsLeft) throw Error(limitError);
   termsLeft -= count;
   if (!count) return op === 'Sum' ? 0 : 1;
   // An inner limit can depend on this particular outer index.
   if (hasScopedOperation(body)) {
    let acc=op==='Sum'?0:1;
    const combine=op==='Sum'?'Add':'Multiply';
    const local=new Map(scope);
    for (let offset=0;offset<count;offset++) {
     local.set(name,lo+offset);
     acc=ce.expr([combine,acc,walk(body,local)]).evaluate().json;
    }
    return acc;
   }
  }
  const localBody=walk(body,new Map(scope).set(name,name));
  const boxed=ce.expr(localBody,{form:'raw'});
  const substitutions={};
  for (const variable of boxed.unknowns) {
   if (variable!==name && !scope.has(variable) && definitions.has(variable))
    substitutions[variable]=resolve(variable).exact.json;
  }
  const limits=['Tuple',name,lower.exact,upper.exact];
  const answer=ce.expr([op,boxed.subs(substitutions).json,limits]).evaluate();
  if (!answer.isValid || hasScopedOperation(answer.json))
   throw Error(integral?'This definite integral could not be evaluated. Check the integrand and bounds.':'This finite sum or product could not be evaluated.');
  if (integral && !answer.unknowns.length) {
   const number=answer.N();
   if(!Number.isFinite(number.re) || number.im!==0)throw Error('This definite integral did not produce a finite real value.');
  }
  return answer.json;
 }

 const value=ce.expr(walk(expr.json,new Map()),{form:'raw'});
 const prepared={value,symbolic};
 calculusCache.set(expr,prepared);
 return prepared;
}
