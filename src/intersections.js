// Search only the displayed window. Each result is checked against the original
// functions, including at poles where a change of sign can mimic a crossing.
function visibleIntersections(curves, window, maxPoints=100) {
 const {left,right,bottom,top,width,height}=window;
 const results=[], implicitGrids=new Map();
 let overflow=false;
 const nx=Math.max(18,Math.min(58,Math.round(width/16)));
 const ny=Math.max(14,Math.min(48,Math.round(height/16)));
 const dx=(right-left)/nx,dy=(top-bottom)/ny;
 if(!(dx>0 && dy>0))return {points:[],overflow:false};
 const samePoint=(a,b)=>Math.abs(a.x-b.x)<dx*1e-4 && Math.abs(a.y-b.y)<dy*1e-4;
 function add(x,y,a,b) {
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<left||x>right||y<bottom||y>top)return;
  // At tangencies the numerical solve can finish a few ulps of residual away
  // from an exact coordinate. Snap only if both original equations hold there.
  const snapX=Math.abs(x-Math.round(x))<dx*1e-6?Math.round(x):x;
  const snapY=Math.abs(y-Math.round(y))<dy*1e-6?Math.round(y):y;
  if((snapX!==x||snapY!==y) && residual(a,snapX,snapY)===0 && residual(b,snapX,snapY)===0){
   x=snapX;y=snapY;
  }
  const other=results.find(p=>samePoint(p,{x,y}));
  if(other){
   for(const line of [a.line,b.line])if(!other.lines.includes(line))other.lines.push(line);
   return;
  }
  if(results.length>=maxPoints){overflow=true;return;}
  results.push({x,y,lines:[a.line,b.line]});
 }
 function residual(curve,x,y) {
  if(curve.kind==='y')return y-curve.run(x,y);
  if(curve.kind==='x')return x-curve.run(x,y);
  return curve.run(x,y);
 }
 function explicitPair(a,b) {
  const sideways=a.kind==='x',low=sideways?bottom:left,high=sideways?top:right;
  const count=Math.max(100,Math.min(480,Math.ceil((sideways?height:width)/2)));
  const dt=(high-low)/count;
  const coords=t=>sideways?[a.run(0,t),t]:[t,a.run(t,0)];
  const value=t=>residual(b,...coords(t));
  function accept(t) {
   const f=value(t),offset=Math.max(dt*.003,Math.abs(t)*Number.EPSILON*16);
   if(!Number.isFinite(f))return;
   const neighbors=[value(t-offset),value(t+offset)].filter(Number.isFinite).map(Math.abs);
   // A shared segment contains infinitely many points. A root must be locally
   // isolated, and both finite neighbors must have greater residual.
   if(!neighbors.length || !neighbors.every(n=>n>Math.abs(f)))return;
   if(Math.abs(f)>Math.max(...neighbors)*2e-4)return;
   add(...coords(t),a,b);
  }
  function crossing(l,r,fl,fr) {
   for(let k=0;k<56;k++){
    const m=(l+r)/2;
    if(m===l||m===r)break;
    const v=value(m);
    if(!Number.isFinite(v))return;
    if(v===0){accept(m);return;}
    if((v<0)===(fl<0)){l=m;fl=v;}else{r=m;fr=v;}
   }
   accept(Math.abs(fl)<Math.abs(fr)?l:r);
  }
  function minimum(l,r) {
   const ratio=.6180339887498949;
   let p=r-ratio*(r-l),q=l+ratio*(r-l),fp=Math.abs(value(p)),fq=Math.abs(value(q));
   for(let j=0;j<80&&p!==q;j++){
    if(fp<=fq){r=q;q=p;fq=fp;p=r-ratio*(r-l);fp=Math.abs(value(p));}
    else{l=p;p=q;fp=fq;q=l+ratio*(r-l);fq=Math.abs(value(q));}
   }
   accept(fp<fq?p:q);
  }
  function domainEdge(inside,outside) {
   for(let j=0;j<60;j++){
    const m=(inside+outside)/2;
    if(m===inside||m===outside)break;
    if(Number.isFinite(value(m)))inside=m;else outside=m;
   }
   const atEdge=value(inside),oneStepIn=value(inside+(inside-outside)*2);
   if(atEdge===0 || Math.abs(atEdge)<=Math.abs(oneStepIn-atEdge))accept(inside);
  }
  let previousPrevious=NaN,previous=value(low);
  if(previous===0)accept(low);
  for(let i=1;i<=count&&!overflow;i++) {
   const t=low+i*dt,current=value(t);
   if(current===0)accept(t);
   const finite=Number.isFinite(current),wasFinite=Number.isFinite(previous);
   if(finite!==wasFinite)domainEdge(finite?t:t-dt,finite?t-dt:t);
   else if(finite&&previous*current<0)crossing(t-dt,t,previous,current);
   if(Number.isFinite(previousPrevious)&&Number.isFinite(current)&&previous!==0 &&
      Math.sign(previousPrevious)===Math.sign(current)&&Math.sign(previous)===Math.sign(current)&&
      Math.abs(previous)<=Math.abs(previousPrevious)&&Math.abs(previous)<Math.abs(current))minimum(t-2*dt,t);
   previousPrevious=previous;previous=current;
  }
 }
 function implicitGrid(curve) {
  if(implicitGrids.has(curve))return implicitGrids.get(curve);
  const stride=nx+1,values=new Float64Array(stride*(ny+1)),cells=new Uint8Array(nx*ny);
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)values[j*stride+i]=curve.run(left+i*dx,bottom+j*dy);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const k=j*stride+i,vs=[values[k],values[k+1],values[k+stride],values[k+stride+1]];
   if(vs.every(Number.isFinite)&&Math.min(...vs)<=0&&Math.max(...vs)>=0)cells[j*nx+i]=1;
  }
  implicitGrids.set(curve,cells);return cells;
 }
 function implicitPair(a,b) {
  const ac=implicitGrid(a),bc=implicitGrid(b);
  for(let k=0;k<ac.length&&!overflow;k++) {
   if(!ac[k]||!bc[k])continue;
   const seedX=left+(k%nx+.5)*dx,seedY=bottom+(Math.floor(k/nx)+.5)*dy;
   let x=seedX,y=seedY;
   for(let iteration=0;iteration<30;iteration++){
    const f=a.run(x,y),g=b.run(x,y);
    const ex=Math.max(dx*1e-5,Math.abs(x)*Number.EPSILON*8),ey=Math.max(dy*1e-5,Math.abs(y)*Number.EPSILON*8);
    const fx=(a.run(x+ex,y)-a.run(x-ex,y))/(2*ex),fy=(a.run(x,y+ey)-a.run(x,y-ey))/(2*ey);
    const gx=(b.run(x+ex,y)-b.run(x-ex,y))/(2*ex),gy=(b.run(x,y+ey)-b.run(x,y-ey))/(2*ey);
    const determinant=fx*gy-fy*gx;
    if(!Number.isFinite(determinant)||Math.abs(determinant)<=1e-9*Math.hypot(fx,fy)*Math.hypot(gx,gy))break;
    const correctionX=(f*gy-g*fy)/determinant,correctionY=(g*fx-f*gx)/determinant;
    x-=correctionX;y-=correctionY;
    if(!(Math.abs(x-seedX)<2*dx && Math.abs(y-seedY)<2*dy))break;
    if(Math.abs(correctionX)<dx*1e-9 && Math.abs(correctionY)<dy*1e-9){
     if(Math.abs(a.run(x,y))<=(Math.abs(fx*dx)+Math.abs(fy*dy))*1e-8 &&
        Math.abs(b.run(x,y))<=(Math.abs(gx*dx)+Math.abs(gy*dy))*1e-8)add(x,y,a,b);
     break;
    }
   }
  }
 }
 for(let i=0;i<curves.length&&!overflow;i++)for(let j=i+1;j<curves.length&&!overflow;j++){
  const a=curves[i],b=curves[j];
  if(a.kind!=='implicit')explicitPair(a,b);
  else if(b.kind!=='implicit')explicitPair(b,a);
  else implicitPair(a,b);
 }
 for(const p of results)p.lines.sort((a,b)=>Number(a)-Number(b));
 results.sort((a,b)=>a.x-b.x || a.y-b.y);
 return {points:results,overflow};
}

const intersectionLayer=$('#intersectionLayer'),intersectionBar=$('#intersectionBar');
const intersectionChoice=$('#intersectionChoice'),intersectionInsert=$('#intersectionInsert');
const intersectionFirst=$('#intersectionFirst'),intersectionSecond=$('#intersectionSecond');
let intersectionPoints=[],intersectionSource=null,intersectionKey='',intersectionTimer=0,intersectionsPending=false;
let outsideCrossing=null;

function clearIntersectionSelection() {
 intersectionPoints=[];
 outsideCrossing=null;$('#systemStatus').textContent='';$('#revealCrossing').hidden=true;$('#systemProof').disabled=true;
 intersectionLayer.replaceChildren();intersectionChoice.replaceChildren();
 intersectionInsert.disabled=true;intersectionBar.hidden=true;
}
function invalidateIntersections(pending=false) {
 clearTimeout(intersectionTimer);intersectionTimer=0;
 intersectionKey='';intersectionSource=null;intersectionsPending=pending;
 clearIntersectionSelection();
}
function intersectionLabel(point) {
 return '≈ ('+point.nx+', '+point.ny+') · Lines '+point.lines.join(', ');
}
function selectIntersection(index) {
 intersectionChoice.value=String(index);
 intersectionInsert.disabled=!intersectionPoints[index];
 $('#systemProof').disabled=intersectionInsert.disabled;
 Array.from(intersectionLayer.children).forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
}
function refreshIntersections(shown,w,h,g) {
 if(intersectionsPending)return;
 const graphs=shown.filter(s=>['y','x','implicit'].includes(s.kind));
 const key=[w,h,graphView.x,graphView.y,graphView.span,...graphs.map(s=>s.line),intersectionFirst.value,intersectionSecond.value].join('|');
 if(graphSeries===intersectionSource && intersectionKey===key)return;
 intersectionSource=graphSeries;intersectionKey=key;
 clearTimeout(intersectionTimer);clearIntersectionSelection();
 if(graphs.length<2)return;
 // Wait for pan/zoom to settle before searching the new window.
 intersectionTimer=setTimeout(()=>{
  if(intersectionsPending || workspaceMode!=='calculator' || key!==intersectionKey)return;
  let curves=graphs;
  const many=graphs.length>6;
  $('#intersectionPair').hidden=!many;
  if(many){
   const offered=graphs.map(s=>s.line).join(',');
   if(intersectionFirst.dataset.lines!==offered){
    const first=intersectionFirst.value,second=intersectionSecond.value;
    for(const el of [intersectionFirst,intersectionSecond]){
     el.replaceChildren(...graphs.map(s=>new Option('Line '+s.line,s.line)));
    }
    if(graphs.some(x=>x.line===first))intersectionFirst.value=first;
    intersectionSecond.value=graphs.some(x=>x.line===second && x.line!==intersectionFirst.value)?second:graphs.find(x=>x.line!==intersectionFirst.value).line;
    intersectionFirst.dataset.lines=offered;
   }
   curves=graphs.filter(s=>s.line===intersectionFirst.value||s.line===intersectionSecond.value);
  }
  const area={left:g.worldX(0),right:g.worldX(w),bottom:g.worldY(h),top:g.worldY(0),width:w,height:h};
  const system=linearSystem(curves);
  let found;
  if(system){
   found={points:[],overflow:false};
   let message='';
   if(system.kind==='coincident')message='Same line · infinitely many solutions.';
   else if(system.kind==='parallel')message='Parallel lines · no solution.';
   else if(system.x>=area.left&&system.x<=area.right&&system.y>=area.bottom&&system.y<=area.top){
    found.points.push({x:system.x,y:system.y,lines:curves.map(s=>s.line)});
    message='One solution.';
   }else{
    message='One solution outside this window.';
    outsideCrossing=system;$('#revealCrossing').hidden=false;
   }
   $('#systemStatus').textContent=message;
  }else found=visibleIntersections(curves,area);
  const optionList=[new Option(found.overflow?'100+ in view · zoom to narrow':found.points.length?'Select a point':'No points found in view','')];
  const dots=document.createDocumentFragment();
  intersectionPoints=found.points;
  const coord=n=>String(Number(n.toPrecision(8)));
  found.points.forEach((point,index)=>{
   point.nx=coord(point.x);point.ny=coord(point.y);
   const label=intersectionLabel(point),button=document.createElement('button');
   button.type='button';button.className='intersection-point';button.tabIndex=-1;
   button.title=label;button.setAttribute('aria-label','Select intersection '+label);
   button.setAttribute('aria-pressed','false');
   button.style.left=g.screenX(point.x)+'px';button.style.top=g.screenY(point.y)+'px';
   button.onclick=()=>selectIntersection(index);
   dots.append(button);optionList.push(new Option(label,String(index)));
  });
  intersectionLayer.replaceChildren(dots);intersectionChoice.replaceChildren(...optionList);
  intersectionChoice.disabled=!found.points.length;
  intersectionChoice.parentElement.hidden=!!system&&!found.points.length;
  intersectionBar.hidden=false;
 },70);
}
for(const [el,other] of [[intersectionFirst,intersectionSecond],[intersectionSecond,intersectionFirst]]){
 el.onchange=()=>{
  if(other.value===el.value)other.value=Array.from(other.options).find(o=>o.value!==el.value).value;
  intersectionKey='';redrawGraph();
 };
}
intersectionChoice.onchange=()=>selectIntersection(intersectionChoice.value===''?-1:Number(intersectionChoice.value));
$('#revealCrossing').onclick=()=>{
 if(!outsideCrossing)return;
 graphView.x=outsideCrossing.x;graphView.y=outsideCrossing.y;redrawGraph();
};
function insertIntersection(newProof){
 if(intersectionsPending||workspaceMode!=='calculator'||intersectionChoice.value==='')return;
 const point=intersectionPoints[Number(intersectionChoice.value)];
 if(!point || !point.lines.every(line=>graphSeries.some(s=>s.line===line && !s.row.plotHidden)))return;
 const latexNumber=n=>n.replace(/e([+-]?\d+)$/,(_,power)=>'\\times10^{'+Number(power)+'}');
 const value='(x,y)\\approx\\left('+latexNumber(point.nx)+',\\,'+latexNumber(point.ny)+'\\right)';
 if(newProof){
  const source=point.lines.map(line=>graphSeries.find(s=>s.line===line));
  const params=new Set(source.flatMap(s=>(s.slots||[]).map(slot=>slot[0])));
  const definitions=calculatorRows().filter((r,i)=>params.has(i)&&!source.some(s=>s.row===r));
  const values=[...definitions,...source.map(s=>s.row)].map(r=>r.querySelector('math-field').value);
  const draft=blankDraft('proofs');
  draft.title='Intersection of '+(source.length===2?'two curves':'curves');
  draft.entries=[...values,value].map(v=>({type:'math',format:'math-latex',value:v}));
  startNewAssignment('proofs',draft);return;
 }
 switchWorkspace('proofs');
 beforeEdit();
 const prior=entries();
 if(prior.length===1&&!hasContent(prior[0].value)){replaceEntries([{type:'math',value}]);active.focus();}
 else{addRow(value,true,'math');schedule();}
 commitHistory();persist();
}
intersectionInsert.onclick=()=>insertIntersection(false);
$('#systemProof').onclick=()=>insertIntersection(true);
