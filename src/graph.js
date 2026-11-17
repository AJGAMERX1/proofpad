// This function also runs in the calculator worker. Return only structured-cloneable data.
function compileGraphRows(nodes, angle='rad', dimension='2d', onNumericCall=null, onScalarPreview=null) {
 const variables=new Map(), functions=new Map();
 const surfaceMode=dimension==='3d';
 const unary=new Set('Negate Abs Sqrt Exp Ln Log Lg Lb Sin Cos Tan Cot Sec Csc Arcsin Arccos Arctan Sinh Cosh Tanh Floor Ceil Round Sign'.split(' '));
 const binary=new Set(['Subtract','Divide','Power','Root','Rational','Mod']);
 const variadic=new Set(['Add','Multiply','InvisibleOperator','Min','Max']);
 const comparisons=new Set(['Equal','Less','LessEqual','Greater','GreaterEqual']);
 const constants=new Map([['Pi',Math.PI],['ExponentialE',Math.E],['e',Math.E],['GoldenRatio',(1+Math.sqrt(5))/2]]);
 function argumentsIn(delimiter) {
  const contents=delimiter[1];
  return Array.isArray(contents) && contents[0]==='Sequence' ? contents.slice(1) : [contents];
 }
 function signature(lhs) {
  // MathLive represents f(u,v) as a symbol next to a parenthesized sequence.
  if (!Array.isArray(lhs) || lhs[0]!=='InvisibleOperator' || lhs.length!==3 ||
      typeof lhs[1]!=='string' || lhs[2]?.[0]!=='Delimiter')return null;
  const params=argumentsIn(lhs[2]);
  if(!surfaceMode && params.length!==1)return null;
  return params.every(param=>typeof param==='string') ? {name:lhs[1],params} : null;
 }
 function register(map,name,entry) {
  map.set(name,map.has(name)?{duplicate:true}:entry);
 }
 function sliderNumber(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(value?.[0]==='Negate' && typeof value[1]==='number')return -value[1];
  if(value && !Array.isArray(value) && typeof value.num==='string'){
   const n=Number(value.num);return Number.isFinite(n)?n:null;
  }
  return null;
 }
 for (const [index,node] of nodes.entries()) {
  if (!node || node[0]!=='Equal' || node.length!==3) continue;
  const lhs=node[1], rhs=node[2], fn=signature(lhs);
  if (fn) register(functions,fn.name,{params:fn.params,rhs});
  else if (typeof lhs==='string' && lhs!=='x' && lhs!=='y' && !constants.has(lhs)) register(variables,lhs,{rhs,index,value:sliderNumber(rhs)});
 }
 function build(node, bindings, visiting, budget) {
  if (--budget.remaining<0 || visiting.size>32) throw Error('This plot is too complex.');
  if (typeof node==='number') return node;
  if (node && !Array.isArray(node) && typeof node==='object' && node.num!=null) {
   const n=Number(node.num); if(Number.isFinite(n))return n;
   throw Error('Use real, finite constants in the graph.');
  }
  if (typeof node==='string') {
   if (bindings.has(node)) {
    const bound=bindings.get(node);
    budget.remaining-=bound.cost;
    if (budget.remaining<0) throw Error('This plot is too complex.');
    return bound.expr;
   }
   if (budget.numeric || node==='x' || node==='y') return node;
   if (constants.has(node)) return constants.get(node);
   const variable=variables.get(node);
   if (!variable) throw Error('Define '+node+' on another expression line.');
   return expand(node,variable,new Map(),visiting,budget);
  }
  if (!Array.isArray(node)) throw Error('Finish the expression to plot it.');
  const [op,...args]=node;
  if (op==='Delimiter') return build(args[0],bindings,visiting,budget);
  if (op==='InvisibleOperator') {
   const factors=[];
   for (let i=0;i<args.length;i++) {
    const fn=typeof args[i]==='string' && functions.get(args[i]), next=args[i+1];
    const powered=next?.[0]==='Power' && next[1]?.[0]==='Delimiter';
    if (fn && (next?.[0]==='Delimiter'||powered)) {
     const actual=argumentsIn(powered?next[1]:next);
     checkFunction(args[i],fn);
     if(actual.length!==fn.params.length)throw Error(args[i]+' takes '+fn.params.length+' argument'+(fn.params.length===1?'':'s')+'.');
     const scope=new Map();
     actual.forEach((argument,index)=>{
      const before=budget.remaining;
      const expr=build(argument,bindings,visiting,budget);
      scope.set(fn.params[index],{expr,cost:before-budget.remaining});
     });
     const result=expand(args[i],fn,scope,visiting,budget);
     factors.push(powered?['Power',result,build(next[2],bindings,visiting,budget)]:result);
     i++; continue;
    }
    factors.push(build(args[i],bindings,visiting,budget));
   }
   return factors.length===1?factors[0]:['Multiply',...factors];
  }
  if (op==='Apply' && args.length===2 && args[0]?.[0]==='InverseFunction' && ['Sin','Cos','Tan'].includes(args[0][1]))
   return ['Arc'+args[0][1].toLowerCase(),build(args[1],bindings,visiting,budget)];
  const valid=unary.has(op)&&args.length===1 || binary.has(op)&&args.length===2 || op==='Log'&&args.length===2 || variadic.has(op)&&args.length>=1;
  if(!valid && !budget.numeric)throw Error('This operation is outside the graph’s supported real functions.');
  return [op,...args.map(a=>build(a,bindings,visiting,budget))];
 }
 function expand(name,def,scope,visiting,budget) {
  if(def.duplicate)throw Error('Define '+name+' only once.');
  if(!budget.numeric && def.value!=null)return ['SliderValue',def.index,def.value];
  if(visiting.has(name))throw Error('Circular definition involving '+name+'.');
  visiting.add(name);
  try{return build(def.rhs,scope,visiting,budget)}finally{visiting.delete(name)}
 }
 function checkFunction(name,def) {
  if(def.duplicate)throw Error('Define '+name+' only once.');
  if(def.params.length<1 || def.params.length>2)throw Error('Use one or two parameters in a plotted function.');
  if(new Set(def.params).size!==def.params.length)throw Error('Give each function parameter a distinct name.');
 }
 function uses(node,symbol) {
  return typeof node==='string'?node===symbol:Array.isArray(node)&&node.slice(1).some(a=>uses(a,symbol));
 }
 function hasFunctionCall(node) {
  if(!Array.isArray(node))return false;
  if(node[0]==='InvisibleOperator'){
   for(let i=1;i<node.length-1;i++){
    const next=node[i+1];
    if(functions.has(node[i]) && (next?.[0]==='Delimiter'||(next?.[0]==='Power'&&next[1]?.[0]==='Delimiter')))return true;
   }
  }
  return node.slice(1).some(hasFunctionCall);
 }
 if(onNumericCall && functions.size){
  nodes.forEach((node,index)=>{
   if(!node)return;
   const equal=Array.isArray(node) && node[0]==='Equal' && node.length===3;
   if(equal && signature(node[1]))return;
   const expr=equal && typeof node[1]==='string'?node[2]:node;
   if(!hasFunctionCall(expr))return;
   try{onNumericCall(index,build(expr,new Map(),new Set(),{remaining:500,numeric:true}));}
   catch(error){onNumericCall(index,null,error.message);}
  });
 }
 // Send numeric trees to the renderer as before, recording just the paths
 // originating from a changeable literal. Shared function arguments can
 // occur more than once and every occurrence must get a slot.
 function pack(tree){
  const slots=[];
  function visit(node,path){
   if(!Array.isArray(node))return node;
   if(node[0]==='SliderValue'){slots.push([node[1],...path]);return node[2];}
   return node.map((child,i)=>i===0?child:visit(child,[...path,i]));
  }
  const expr=visit(tree,[]);
  return slots.length?{expr,slots}:{expr};
 }
 function rhsTree(rhs,lhs,index,bindings,budget){
  const n=typeof lhs==='string'?sliderNumber(rhs):null;
  return n==null?build(rhs,bindings,new Set(),budget):['SliderValue',index,n];
 }
 return nodes.map((node,index)=>{
  if(!node)return null;
  const op=Array.isArray(node)?node[0]:null, rel=comparisons.has(op) && node.length===3;
  const lhs=rel?node[1]:null, rhs=rel?node[2]:node, fn=signature(lhs);
  if(onScalarPreview && !fn && (!rel || (op==='Equal' && typeof lhs==='string'))){
   try{
    const value=rhsTree(rhs,lhs,index,new Map(),{remaining:500});
    if(!uses(value,'x')&&!uses(value,'y')){
     const plan=pack(value);if(plan.slots)onScalarPreview(index,plan);
    }
   }catch{} // Exact, complex and unsupported scalar operations stay with the worker.
  }
  if(fn && op!=='Equal')return surfaceMode?{error:'Enter a surface as z = f(x,y).'}:null;
  if(rel && op==='Equal' && typeof lhs==='string' && lhs!=='x' && lhs!=='y' && !(surfaceMode && lhs==='z'))return null;
  if(surfaceMode && rel && !fn && !(op==='Equal' && lhs==='z')){
   if(!['x','y','z'].some(axis=>uses(node,axis)))return null;
   return {error:'Enter a surface as z = f(x,y).'};
  }
  if(!rel && !uses(node,'x') && !uses(node,'y'))return null;
  if(!rel && ['Matrix','List','Tuple','Sequence'].includes(op))return null;
  const budget={remaining:500}, bindings=new Map();
  try {
   let kind, expr;
   if(fn && op==='Equal') {
    const definition=functions.get(fn.name);
    checkFunction(fn.name,definition);
    fn.params.forEach((param,index)=>bindings.set(param,{expr:index===0?'x':'y',cost:1}));
    expr=expand(fn.name,definition,bindings,new Set(),budget);
    kind=surfaceMode?'surface':'y';
    if(!surfaceMode && uses(expr,'y'))throw Error('Use one independent variable in a function.');
   } else if(!rel) {
    expr=build(rhs,bindings,new Set(),budget);
    if(!surfaceMode && uses(expr,'y'))throw Error('Use an equation to plot a relation in x and y.');
    kind=surfaceMode?'surface':'y';
   } else {
    const right=rhsTree(rhs,op==='Equal'?lhs:null,index,bindings,budget);
    if(surfaceMode) {kind='surface';expr=right;}
    else if(op==='Equal' && (lhs==='x' || lhs==='y') && !uses(right,lhs)) { kind=lhs;expr=right; }
    else {
     const left=build(lhs,bindings,new Set(),budget);
     if(!uses(left,'x')&&!uses(left,'y')&&!uses(right,'x')&&!uses(right,'y'))return null;
     kind=op==='Equal'?'implicit':'region';expr=['Subtract',left,right];
    }
   }
   return {kind,...pack(expr),relation:op,angle,cost:501-budget.remaining};
  } catch(error) {return {error:error.message};}
 });
}

// Compile a restricted math tree to numeric functions once per series.
function graphEvaluator(tree,angle) {
 const unit=angle==='deg'?Math.PI/180:1;
 const unary={
  Negate:a=>-a,Abs:Math.abs,Sqrt:Math.sqrt,Exp:Math.exp,Ln:Math.log,Log:Math.log10,Lg:Math.log10,Lb:Math.log2,
  Sin:a=>Math.sin(a*unit),Cos:a=>Math.cos(a*unit),Tan:a=>Math.tan(a*unit),
  Csc:a=>1/Math.sin(a*unit),Sec:a=>1/Math.cos(a*unit),Cot:a=>1/Math.tan(a*unit),
  Arcsin:a=>Math.asin(a)/unit,Arccos:a=>Math.acos(a)/unit,Arctan:a=>Math.atan(a)/unit,
  Sinh:Math.sinh,Cosh:Math.cosh,Tanh:Math.tanh,Floor:Math.floor,Ceil:Math.ceil,Round:Math.round,Sign:Math.sign
 };
 const binary={Add:(a,b)=>a+b,Subtract:(a,b)=>a-b,Multiply:(a,b)=>a*b,Divide:(a,b)=>a/b,Rational:(a,b)=>a/b,Power:Math.pow,
  Root:(a,n)=>a<0 && Number.isInteger(n) && Math.abs(n%2)===1 ? -Math.pow(-a,1/n) : Math.pow(a,1/n),
  Min:Math.min,Max:Math.max,Mod:(a,b)=>a-b*Math.floor(a/b),Log:(a,b)=>Math.log(a)/Math.log(b)};
 function oddDenominatorPower(exponent){
  let sign=1;
  if(exponent?.[0]==='Negate'){sign=-1;exponent=exponent[1];}
  if(!Array.isArray(exponent)||!['Divide','Rational'].includes(exponent[0]))return null;
  const integer=n=>n?.[0]==='Negate'&&Number.isSafeInteger(n[1])?-n[1]:n;
  const p=integer(exponent[1]),q=integer(exponent[2]);
  if(!Number.isSafeInteger(p)||!Number.isSafeInteger(q)||q===0)return null;
  let a=Math.abs(p),b=Math.abs(q);
  while(b){const remainder=a%b;a=b;b=remainder;}
  if((Math.abs(q)/a)%2!==1)return null;
  const negativeSign=(Math.abs(p)/a)%2===1?-1:1,power=sign*p/q;
  return x=>x<0?negativeSign*Math.pow(-x,power):Math.pow(x,power);
 }
 function compile(node) {
  if(typeof node==='number')return ()=>node;
  if(node==='x')return x=>x;
  if(node==='y')return (x,y)=>y;
  const [op,...children]=node, args=children.map(compile);
  if(op==='Power'){
   const rational=oddDenominatorPower(children[1]);
   if(rational)return (x,y)=>rational(args[0](x,y));
  }
  if(args.length===1) {const f=unary[op], a=args[0];return f?(x,y)=>f(a(x,y)):a;}
  const f=binary[op];
  if(args.length===2){const [a,b]=args;return (x,y)=>f(a(x,y),b(x,y));}
  return (x,y)=>{let value=args[0](x,y);for(let i=1;i<args.length;i++)value=f(value,args[i](x,y));return value;};
 }
 return compile(tree);
}

const graphCanvas=document.querySelector('#graphCanvas');
const graphPanel=document.querySelector('#graphPanel');
const graphView={x:0,y:0,span:20};
let graphSeries=[], graphFrame=0, graphPointer=null, graphErrorCount=0, emptySurfaceWindow=false;
const graphTouches=new Map();
function graphGeometry(width,height) {
 const scale=width/graphView.span;
 return {scale,screenX:x=>width/2+(x-graphView.x)*scale,screenY:y=>height/2-(y-graphView.y)*scale,
  worldX:px=>graphView.x+(px-width/2)/scale,worldY:py=>graphView.y-(py-height/2)/scale};
}
function redrawGraph() {
 if(graphFrame || workspaceMode!=='calculator')return;
 graphFrame=requestAnimationFrame(()=>{graphFrame=0;paintGraph();});
}
function setGraphResults(results) {
 const list=calculatorRows(), legend=document.querySelector('#graphLegend'), specs=[];
 const controls=document.createDocumentFragment();
 let unsupported=0;
 for(const previous of graphSeries){
  previous.row.style.removeProperty('--row-graph-color');
  delete previous.row.dataset.graphVisible;
 }
 for(let i=0;i<results.length;i++){
  const graph=results[i]?.graph, row=list[i];if(!row || !graph)continue;
  if(graph.error){unsupported++;continue;}
  const line=row.querySelector('.number').textContent.replace(/\D/g,'');
  const title=row.querySelector('math-field').value;
  const series={...graph,run:graphEvaluator(graph.expr,graph.angle),line,row};
  specs.push(series);
  const toggle=document.createElement('button');toggle.type='button';
  toggle.textContent='Line '+line;toggle.title=title;
  series.legendButton=toggle;
  toggle.setAttribute('aria-label','Show line '+line+' on graph');
  const syncVisibility=()=>{
   row.dataset.graphVisible=String(!row.plotHidden);
   toggle.setAttribute('aria-pressed',row.dataset.graphVisible);
  };
  syncVisibility();
  toggle.onclick=()=>{
   beforeEdit();row.plotHidden=!row.plotHidden;syncVisibility();commitHistory();persist();
   updateSurfaceKeys();describeGraph();redrawGraph();
  };
  controls.append(toggle);
 }
 graphSeries=specs;
 legend.replaceChildren(controls);
 graphErrorCount=unsupported;emptySurfaceWindow=false;
 describeGraph();onSeriesStyleChanged();
}
function onSeriesStyleChanged(){
 const css=getComputedStyle(graphPanel);
 graphSeries.forEach((series,index)=>{
  const look=seriesAppearance(series,index,css,inSurface());
  series.look=look;
  const accent=look.mode==='gradient'?look.ramp[Math.floor(look.ramp.length/2)]:look.color;
  series.row.style.setProperty('--row-graph-color',accent);
  const swatch=look.mode==='gradient'?'linear-gradient(90deg,'+look.ramp.join(',')+')':look.color;
  series.legendButton.style.setProperty('--curve-swatch',swatch);
  series.legendButton.dataset.pattern=inSurface()?'solid':look.pattern;
  series.legendButton.title=series.row.querySelector('math-field').value+' · '+look.rampName;
 });
 updateSurfaceKeys();redrawGraph();refreshSeriesStyleControls(graphSeries);
}
function describeGraph(){
 const count=graphSeries.filter(s=>!s.row.plotHidden).length;
 let message;
 if(graphSeries.length && !count)message='All plots are hidden. Select a line in the graph legend to show it.';
 else if(!count && graphErrorCount)message='Check the marked expressions.';
 else if(inSurface() && count && emptySurfaceWindow)message='No surface is visible in this window. Try Reset or zoom out.';
 else message=inSurface()?surfaceStatus():count?'Drag to pan · Scroll or pinch to zoom':'Enter y = x² or x² + y² = 9 on an expression line.';
 $('#graphStatus').textContent=message;
 const kind=inSurface()?(surfaceView.heatmap?'Height map':'3D surface graph'):'Coordinate plane';
 graphCanvas.setAttribute('aria-label',kind+' with '+count+' plotted '+(count===1?'expression':'expressions'));
}
function graphNumber(value) {
 if(Math.abs(value)<1e-12)return '0';
 if(Math.abs(value)>=1e5||Math.abs(value)<.001)return value.toExponential(2);
 return String(Number(value.toPrecision(5)));
}
function drawGraphAxes(ctx,w,h,g,style) {
 const desired=60/g.scale, base=Math.pow(10,Math.floor(Math.log10(desired)));
 const spacing=[1,2,5,10].find(step=>step*base>=desired)*base;
 const originX=g.screenX(0),originY=g.screenY(0);
 const xticks=[],yticks=[],firstX=Math.ceil(g.worldX(0)/spacing),firstY=Math.ceil(g.worldY(h)/spacing);
 // Count iterations rather than incrementing tiny values at large offsets.
 for(let i=0;i<Math.ceil(w/(spacing*g.scale))+1;i++) {
  const value=(firstX+i)*spacing,px=g.screenX(value);if(px>=0&&px<=w)xticks.push([px,value]);
 }
 for(let i=0;i<Math.ceil(h/(spacing*g.scale))+1;i++) {
  const value=(firstY+i)*spacing,py=g.screenY(value);if(py>=0&&py<=h)yticks.push([py,value]);
 }
 ctx.lineWidth=1;ctx.strokeStyle=style.getPropertyValue('--graph-grid');ctx.beginPath();
 for(const [px] of xticks){ctx.moveTo(px,0);ctx.lineTo(px,h);}
 for(const [py] of yticks){ctx.moveTo(0,py);ctx.lineTo(w,py);}
 ctx.stroke();ctx.strokeStyle=style.getPropertyValue('--graph-axis');ctx.beginPath();
 if(originX>=0&&originX<=w){ctx.moveTo(originX,0);ctx.lineTo(originX,h);}
 if(originY>=0&&originY<=h){ctx.moveTo(0,originY);ctx.lineTo(w,originY);}
 ctx.stroke();ctx.fillStyle=style.getPropertyValue('--graph-label');ctx.font='11px system-ui';ctx.textAlign='center';ctx.textBaseline='alphabetic';
 const xlabelY=Math.min(h-4,Math.max(13,originY+15)),ylabelX=Math.min(w-40,Math.max(3,originX+5));
 for(const [px,val] of xticks)if(val!==0 && px>16 && px<w-16)ctx.fillText(graphNumber(val),px,xlabelY);
 ctx.textAlign='left';
 for(const [py,val] of yticks)if(val!==0 && py>7 && py<h-8)ctx.fillText(graphNumber(val),ylabelX,py-3);
 if(originX>=4&&originX<w-16&&originY>=0&&originY<h-16)ctx.fillText('0',originX+3,originY+13);
}
function drawFunction(ctx,series,w,h,g,interval) {
 const sideways=series.kind==='x', limit=sideways?h:w, orthogonal=sideways?w:h;
 function point(pixel) {
  const t=sideways?g.worldY(pixel):g.worldX(pixel), value=sideways?series.run(0,t):series.run(t,0);
  return sideways?g.screenX(value):g.screenY(value);
 }
 let prev=point(0), prevPixel=0, penDown=false;
 ctx.beginPath();
 for(let p=interval;p<limit+interval;p+=interval) {
  const end=Math.min(p,limit),cur=point(end);
  let connected=false;
  if(Number.isFinite(prev)&&Number.isFinite(cur) && (Math.max(prev,cur)>=-2&&Math.min(prev,cur)<=orthogonal+2)){
   const midpoint=point((prevPixel+end)/2);
   // A pole sends the two sides to opposite infinities. Check the interior
   // before connecting the endpoints, including poles between pixel samples.
   const safe=Number.isFinite(midpoint)&&Math.abs(midpoint-(prev+cur)/2)<=Math.max(.85,Math.abs(cur-prev)*.12);
   if(safe){
    if(!penDown)ctx.moveTo(sideways?prev:prevPixel,sideways?prevPixel:prev);
    connected=true;
    ctx.lineTo(sideways?cur:end,sideways?end:cur);
   }
  }
  penDown=connected;prev=cur;prevPixel=end;
 }
 ctx.stroke();
}
function drawRelation(ctx,series,w,h,g,cell) {
 const nx=Math.ceil(w/cell),ny=Math.ceil(h/cell),sx=w/nx,sy=h/ny;
 const values=new Float64Array((nx+1)*(ny+1)), stride=nx+1;
 for(let j=0;j<=ny;j++){
  const y=g.worldY(j*sy);
  for(let i=0;i<=nx;i++)values[j*stride+i]=series.run(g.worldX(i*sx),y);
 }
 const fill=series.kind==='region', greater=series.relation==='Greater'||series.relation==='GreaterEqual';
 const boundary=new Path2D();
 // Join contour segments so dash lengths continue through grid-cell boundaries.
 const joins=series.look.pattern==='solid'?null:new Map();
 function connect(a,b){
  if(!joins){boundary.moveTo(...a);boundary.lineTo(...b);return}
  const key=p=>Math.round(p[0]*1000)+','+Math.round(p[1]*1000);
  const ka=key(a),kb=key(b);if(ka===kb)return;
  const edge={ka,kb,a,b,used:false};
  for(const k of [ka,kb]){
   if(!joins.has(k))joins.set(k,[]);
   joins.get(k).push(edge);
  }
 }
 for(let j=0;j<ny;j++){
  const py=j*sy, row=j*stride;let fillStart=-1;
  for(let i=0;i<=nx;i++){
   const px=i*sx;
   const idx=row+i,a=values[idx],b=values[idx+1],c=values[idx+stride+1],d=values[idx+stride];
   const finite=i<nx&&Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(c)&&Number.isFinite(d);
   if(fill){
    const inside=finite && (greater?a+b+c+d>0:a+b+c+d<0);
    if(inside&&fillStart<0)fillStart=px;
    if(!inside&&fillStart>=0){ctx.globalAlpha=.12;ctx.fillRect(fillStart,py,px-fillStart,sy);ctx.globalAlpha=1;fillStart=-1;}
   }
   if(!finite || (a>=0&&b>=0&&c>=0&&d>=0) || (a<0&&b<0&&c<0&&d<0))continue;
   const points=[];
   function edge(v1,v2,x1,y1,x2,y2){
    if((v1<0)===(v2<0))return;
    const t=v1/(v1-v2),x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;
    const residual=series.run(g.worldX(x),g.worldY(y));
    if(Number.isFinite(residual)&&Math.abs(residual)<=.75*Math.max(Math.abs(v1),Math.abs(v2)))points.push([x,y]);
   }
   edge(a,b,px,py,px+sx,py);edge(b,c,px+sx,py,px+sx,py+sy);edge(c,d,px+sx,py+sy,px,py+sy);edge(d,a,px,py+sy,px,py);
   if(points.length===2||points.length===4){
    // Resolve marching-squares saddles using the value at the cell centre.
    if(points.length===4 && (series.run(g.worldX(px+sx/2),g.worldY(py+sy/2))<0)!==(a<0))points.unshift(points.pop());
    for(let k=0;k<points.length;k+=2)connect(points[k],points[k+1]);
   }
  }
 }
 if(joins){
  function trace(start){
   let key=start,edge=joins.get(key).find(e=>!e.used);
   if(!edge)return;
   boundary.moveTo(...(key===edge.ka?edge.a:edge.b));
   while(edge){
    edge.used=true;const forward=key===edge.ka;
    boundary.lineTo(...(forward?edge.b:edge.a));key=forward?edge.kb:edge.ka;
    edge=joins.get(key).find(e=>!e.used);
   }
  }
  for(const [key,edges] of joins)if(edges.length===1)trace(key);
  for(const key of joins.keys())trace(key);
 }
 ctx.stroke(boundary);
}
function paintGraph({canvas=graphCanvas,pixelRatio=Math.min(3,window.devicePixelRatio||1),fullDetail=false}={}) {
 if(workspaceMode!=='calculator' || !graphCanvas.clientWidth)return;
 const w=graphCanvas.clientWidth,h=graphCanvas.clientHeight,dpr=pixelRatio;
 const sampleScale=canvas===graphCanvas?1:Math.max(1,dpr);
 const pixelW=Math.round(w*dpr),pixelH=Math.round(h*dpr);
 if(canvas.width!==pixelW || canvas.height!==pixelH){canvas.width=pixelW;canvas.height=pixelH;}
 const ctx=canvas.getContext('2d');
 ctx.setTransform(pixelW/w,0,0,pixelH/h,0,0);
 const style=getComputedStyle(graphPanel),shown=graphSeries.filter(s=>!s.row.plotHidden);
 if(inSurface()){
  const palette={ramp:surfaceRamps[surfaceView.palette]};
  for(const key of ['paper','grid','axis','label'])palette[key]=style.getPropertyValue('--graph-'+key).trim();
  const moving=!fullDetail && (graphTouches.size>0 || spinFrame!==0);
  const surfaces=shown.map(s=>({run:s.run,cost:s.cost,color:s.look.color,ramp:s.look.ramp,finish:s.look.finish,grid:s.look.grid,opacity:s.look.opacity}));
  const drawn=paintSurfacePlot(ctx,w,h,surfaces,surfaceView,palette,moving,sampleScale);
  if(canvas===graphCanvas){
   const empty=surfaces.length>0 && !drawn;
   if(empty!==emptySurfaceWindow){emptySurfaceWindow=empty;describeGraph();}
  }
  return;
 }
 const g=graphGeometry(w,h);
 ctx.fillStyle=style.getPropertyValue('--graph-paper');ctx.fillRect(0,0,w,h);
 drawGraphAxes(ctx,w,h,g,style);
 const cost=shown.reduce((sum,s)=>sum+s.cost,0);
 const interval=Math.max(1,Math.ceil(w*Math.max(1,cost)/120000))/sampleScale,cell=Math.max(4,Math.ceil(Math.sqrt(w*h*Math.max(1,cost)/300000)))/Math.min(3,sampleScale);
 for(const s of shown) {
  ctx.save();
  const look=s.look;
  let ink=look.color;
  if(look.mode==='gradient'){
   ink=ctx.createLinearGradient(0,h,w,0);
   look.ramp.forEach((color,i)=>ink.addColorStop(i/(look.ramp.length-1),color));
  }
  ctx.lineWidth=2;ctx.strokeStyle=ctx.fillStyle=ink;
  ctx.setLineDash(look.pattern==='dotted'?[.1,5]:look.pattern==='dashed'?[8,5]:[]);
  ctx.lineCap=look.pattern==='dotted'?'round':'butt';
  if(s.kind==='x'||s.kind==='y')drawFunction(ctx,s,w,h,g,interval);else drawRelation(ctx,s,w,h,g,cell);
  ctx.restore();
 }
}
function zoomGraph(ratio,px,py) {
 const w=graphCanvas.clientWidth,h=graphCanvas.clientHeight;
 if(!w||!h)return;
 if(inSurface()){
  const before=surfaceView.heatmap?surfaceHeatGeometry(w,h,surfaceView):null;
  surfaceView.span=bounded(surfaceView.span*ratio,1e-5,1e7,12);
  if(before && before.inside(px,py)){
   const after=surfaceHeatGeometry(w,h,surfaceView);
   surfaceView.cx+=before.x(px)-after.x(px);surfaceView.cy+=before.y(py)-after.y(py);
  }
  syncSurfaceControls();saveSurfaceSoon();redrawGraph();return;
 }
 const before=graphGeometry(w,h),x=before.worldX(px),y=before.worldY(py);
 graphView.span=Math.max(1e-5,Math.min(1e7,graphView.span*ratio));
 const after=graphGeometry(w,h);graphView.x+=x-after.worldX(px);graphView.y+=y-after.worldY(py);
 redrawGraph();
}
function zoomGraphCenter(ratio){zoomGraph(ratio,graphCanvas.clientWidth/2,graphCanvas.clientHeight/2);}
function resetGraph(){
 if(inSurface()){stopSurfaceSpin();Object.assign(surfaceView,surfaceHome);syncSurfaceControls();saveSurfaceSoon();}
 else Object.assign(graphView,{x:0,y:0,span:20});
 $('#surfaceProbe').hidden=$('#graphCoordinates').hidden=true;redrawGraph();
}
function graphPoint(event) {
 const rect=graphCanvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};
}
function graphGesture() {
 const [a,b]=graphTouches.values();
 return b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)}:{...a,d:0};
}
function graphReadout(p) {
 if(inSurface()){
  if(surfaceView.heatmap)inspectHeatmap(p);else $('#graphCoordinates').hidden=true;
  return;
 }
 const g=graphGeometry(graphCanvas.clientWidth,graphCanvas.clientHeight),x=g.worldX(p.x),y=g.worldY(p.y);
 const readout=document.querySelector('#graphCoordinates');let value='x '+graphNumber(x)+'   y '+graphNumber(y), nearest=14;
 for(const s of graphSeries){
  if(s.row.plotHidden || (s.kind!=='x'&&s.kind!=='y'))continue;
  const sideways=s.kind==='x',sample=s.run(x,y),dist=Math.abs((sideways?g.screenX(sample)-p.x:g.screenY(sample)-p.y));
  if(dist<nearest){nearest=dist;value='Line '+s.line+'   ('+graphNumber(sideways?sample:x)+', '+graphNumber(sideways?y:sample)+')';}
 }
 readout.textContent=value;readout.hidden=false;
}
graphCanvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||graphTouches.size>=2)return;
 if(inSurface())stopSurfaceSpin();
 graphCanvas.focus({preventScroll:true});graphCanvas.setPointerCapture(e.pointerId);graphTouches.set(e.pointerId,graphPoint(e));graphPointer=graphGesture();
 if(inSurface() && surfaceView.heatmap)inspectHeatmap(graphPoint(e));
});
graphCanvas.addEventListener('pointermove',e=>{
 const p=graphPoint(e);
 if(graphTouches.has(e.pointerId)){
  graphTouches.set(e.pointerId,p);const next=graphGesture(),g=graphGeometry(graphCanvas.clientWidth,graphCanvas.clientHeight);
  const dx=next.x-graphPointer.x,dy=next.y-graphPointer.y;
  if(inSurface()){
   if(surfaceView.heatmap||e.shiftKey||graphTouches.size===2)panSurface(dx,dy);
   else orbitSurface(dx,dy);
   saveSurfaceSoon();
  }else{graphView.x-=dx/g.scale;graphView.y+=dy/g.scale;}
  if(next.d>1&&graphPointer.d>1)zoomGraph(graphPointer.d/next.d,next.x,next.y);
  graphPointer=next;redrawGraph();
 }
 graphReadout(p);
});
function endGraphPointer(e){
 const ended=graphTouches.delete(e.pointerId);graphPointer=graphTouches.size?graphGesture():null;
 if(ended && !graphTouches.size && inSurface())redrawGraph();
 if(!graphTouches.size && e.pointerType!=='mouse' && !(inSurface()&&surfaceView.heatmap))document.querySelector('#graphCoordinates').hidden=true;
}
graphCanvas.addEventListener('pointerup',endGraphPointer);graphCanvas.addEventListener('lostpointercapture',endGraphPointer);
graphCanvas.addEventListener('pointerleave',e=>{if(!graphTouches.size && !(e.pointerType==='touch' && inSurface() && surfaceView.heatmap))$('#surfaceProbe').hidden=$('#graphCoordinates').hidden=true;});
graphCanvas.addEventListener('wheel',e=>{e.preventDefault();const p=graphPoint(e);zoomGraph(Math.exp(Math.max(-1,Math.min(1,e.deltaY*(e.deltaMode===1?.04:.0015)))),p.x,p.y);graphReadout(p);},{passive:false});
graphCanvas.addEventListener('keydown',e=>{
 const step=graphView.span*.1;
 const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(inSurface() && arrows[e.key]){
  const [x,y]=arrows[e.key];stopSurfaceSpin();
  if(surfaceView.heatmap||e.shiftKey)panSurface(-x*24,-y*24);else orbitSurface(x*15,y*15);
  e.preventDefault();saveSurfaceSoon();redrawGraph();return;
 }
 switch(e.key){
  case '+':case '=':zoomGraphCenter(.75);break;
  case '-':zoomGraphCenter(1/.75);break;
  case 'Home':resetGraph();break;
  case 'ArrowLeft':graphView.x-=step;break;case 'ArrowRight':graphView.x+=step;break;
  case 'ArrowUp':graphView.y+=step;break;case 'ArrowDown':graphView.y-=step;break;
  default:return;
 }
 e.preventDefault();redrawGraph();
});
document.querySelector('#graphZoomIn').onclick=()=>zoomGraphCenter(.75);
document.querySelector('#graphZoomOut').onclick=()=>zoomGraphCenter(1/.75);
document.querySelector('#graphReset').onclick=resetGraph;
document.querySelector('#graphSave').onclick=()=>{
 const output=document.querySelector('#graphStatus');
 if(!graphCanvas.clientWidth || !graphCanvas.clientHeight){output.textContent='Open the graph to save it.';return;}
 // Include the latest pan, zoom or visibility change, even between frames.
 paintGraph();
 const filename=inSurface()?(surfaceView.heatmap?'proofpad-heat-map.png':'proofpad-3d-graph.png'):'proofpad-graph.png';
 graphCanvas.toBlob(blob=>{
  if(!blob){output.textContent='The graph could not be saved. Try again.';return;}
  saveDownload(blob,filename);
  output.textContent='Graph saved as PNG.';
 },'image/png');
};
document.querySelector('#graphExample').onclick=()=>{
 beforeEdit();
 if(inSurface()){addSurfaceExample();return}
 const demo=[{type:'math',value:'y=x^2'},{type:'math',value:'y=x+2'}];
 if(entries().every(entry=>!hasContent(entry.value)))replaceEntries(demo);
 else {for(const item of demo)addRow(item.value,false,'math');schedule();}
 resetGraph();
};
new ResizeObserver(redrawGraph).observe(graphCanvas);
new MutationObserver(onSeriesStyleChanged).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
