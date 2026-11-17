// Convert supported affine expressions to (ax + by + c) / d. Using integer
// ratios avoids classifying nearly parallel lines as coincident by tolerance.
function affineEquation(series) {
 if(!['x','y','implicit'].includes(series.kind))return null;
 const X=[1n,0n,0n,1n],Y=[0n,1n,0n,1n];
 const constant=v=>v[0]===0n&&v[1]===0n;
 function reduce(a,b,c,d) {
  if(d===0n)return null;
  const gcd=(p,q)=>{p=p<0n?-p:p;q=q<0n?-q:q;while(q)[p,q]=[q,p%q];return p;};
  let factor=gcd(gcd(a,b),gcd(c,d));if(d<0n)factor=-factor;
  const out=[a/factor,b/factor,c/factor,d/factor];
  return out.some(n=>n.toString(16).length>240)?null:out;
 }
 function add(v,w,sign){return reduce(v[0]*w[3]+sign*w[0]*v[3],v[1]*w[3]+sign*w[1]*v[3],v[2]*w[3]+sign*w[2]*v[3],v[3]*w[3]);}
 function scale(v,n,d){return reduce(v[0]*n,v[1]*n,v[2]*n,v[3]*d);}
 function walk(node) {
  if(node==='x')return X;if(node==='y')return Y;
  if(typeof node==='number' && Number.isFinite(node)){
   const [digits,e='0']=String(node).split('e'),[whole,decimal='']=digits.split('.');
   const exponent=Number(e)-decimal.length;
   const n=BigInt(whole+decimal);
   return reduce(0n,0n,exponent>0?n*10n**BigInt(exponent):n,exponent<0?10n**BigInt(-exponent):1n);
  }
  if(!Array.isArray(node))return null;
  const [op,...children]=node, terms=children.map(walk);
  if(!terms.length||terms.some(v=>!v))return null;
  let [v,...rest]=terms;
  if(op==='Negate')return scale(v,-1n,1n);
  if(op==='Power')return rest.length===1&&constant(rest[0])&&rest[0][2]===rest[0][3]?v:null;
  for(const w of rest){
   if(op==='Add'||op==='Subtract')v=add(v,w,op==='Add'?1n:-1n);
   else if((op==='Divide'||op==='Rational') && constant(w))v=scale(v,w[3],w[2]);
   else if(op==='Multiply' && (constant(w)||constant(v)))v=constant(w)?scale(v,w[2],w[3]):scale(w,v[2],v[3]);
   else return null;
   if(!v)return null;
  }
  return rest.length?v:null;
 }
 let v=walk(series.expr);if(!v)return null;
 if(series.kind==='y')v=add(Y,v,-1n);
 if(series.kind==='x')v=add(X,v,-1n);
 return v&&(v[0]||v[1])?v:null;
}
function linearSystem(curves){
 if(curves.length!==2)return null;
 const p=affineEquation(curves[0]),q=affineEquation(curves[1]);
 if(!p||!q)return null;
 const [a,b,c]=p,[d,e,f]=q,det=a*e-b*d;
 const nx=b*f-c*e,ny=c*d-a*f;
 if(det===0n)return {kind:nx===0n&&ny===0n?'coincident':'parallel'};
 function ratio(top,bottom){
  if(top===0n)return 0;
  const digits=n=>(n<0n?-n:n).toString(),num=digits(top),den=digits(bottom);
  const lead=s=>Number(s[0]+'.'+s.slice(1,17));
  return ((top<0n)!==(bottom<0n)?-1:1)*Number(String(lead(num)/lead(den))+'e'+(num.length-den.length));
 }
 const x=ratio(nx,det),y=ratio(ny,det);
 return Number.isFinite(x)&&Number.isFinite(y)?{kind:'crossing',x,y}:null;
}
