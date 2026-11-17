// An unbounded graph has no enclosing rectangle. Frame a representative finite
// section of each visible plot, with extra room around its sampled extrema.
function estimateGraphFrame(plots, camera, aspect, surface) {
 const xLimits=[Infinity,-Infinity], yLimits=[Infinity,-Infinity], zLimits=[Infinity,-Infinity];
 const include=(range,n)=>{range[0]=Math.min(range[0],n);range[1]=Math.max(range[1],n);};
 const radius=6, maxSpan=1e7;
 const cost=plots.reduce((total,s)=>total+Math.max(1,s.cost||1),0);
 const gridSteps=2*Math.max(4,Math.min(16,Math.floor(Math.sqrt(140000/Math.max(1,cost))/2)));
 // Plain numbers in a shifted coordinate often locate the interesting part
 // of the graph, even when the user has panned far from it.
 function domain(expr,axis){
  const shifts=[];
  const literal=n=>typeof n==='number'?n:n?.[0]==='Negate'&&typeof n[1]==='number'?-n[1]:NaN;
  function visit(n){
   if(!Array.isArray(n))return;
   const [op,a,b]=n;
   if(n.length===3 && (op==='Add'||op==='Subtract')){
    const shift=a===axis?(op==='Add'?-literal(b):literal(b)):b===axis?(op==='Add'?-literal(a):literal(a)):NaN;
    if(Number.isFinite(shift)&&Math.abs(shift)<=1e12)shifts.push(shift);
   }
   for(let i=1;i<n.length;i++)visit(n[i]);
  }
  visit(expr);
  return shifts.length?[Math.min(...shifts)-radius,Math.max(...shifts)+radius]:[-radius,radius];
 }
 function extendValues(range,values){
  // A finite sample beside a pole can be millions of times larger than all
  // its neighbors. Bound the influence of these isolated spikes per series.
  values.sort((a,b)=>a-b);
  const lo=values[Math.floor((values.length-1)*.1)],hi=values[Math.ceil((values.length-1)*.9)];
  const fence=3*(hi-lo);
  const from=values.find(v=>v>=lo-fence),to=values.findLast(v=>v<=hi+fence);
  include(range,from);include(range,to);
 }
 function sampleRange(lo,hi,i,count){return lo+(hi-lo)*i/count;}
 function explicit(s,xd,yd){
  const sideways=s.kind==='x', independent=sideways?yd:xd;
  const along=sideways?yLimits:xLimits,across=sideways?xLimits:yLimits,values=[];
  const count=Math.max(32,gridSteps*8);
  for(let i=0;i<=count;i++){
   const t=sampleRange(...independent,i,count),v=sideways?s.run(0,t):s.run(t,0);
   if(!Number.isFinite(v))continue;
   include(along,t);values.push(v);
  }
  if(values.length)extendValues(across,values);
  return values.length>0;
 }
 function surfaceSamples(s,xd,yd){
  const heights=[];
  for(let j=0;j<=gridSteps;j++)for(let i=0;i<=gridSteps;i++){
   const x=sampleRange(...xd,i,gridSteps),y=sampleRange(...yd,j,gridSteps),z=s.run(x,y);
   if(!Number.isFinite(z))continue;
   include(xLimits,x);include(yLimits,y);heights.push(z);
  }
  if(heights.length)extendValues(zLimits,heights);
  return heights.length>0;
 }
 function implicitEdges(s,xd,yd){
  const xs=[Infinity,-Infinity],ys=[Infinity,-Infinity];let interior=false,edge=false;
  const previousRow=new Float64Array(gridSteps+1);
  function record(x,y){include(xs,x);include(ys,y);}
  function crossing(v,w,x,y,px,py){
   if(!Number.isFinite(v)||!Number.isFinite(w)||!v||!w||(v<0)===(w<0))return;
   const t=Math.abs(v)/(Math.abs(v)+Math.abs(w));
   const ax=x+(px-x)*t,ay=y+(py-y)*t;
   // A sign reversal across a pole does not mark a real level crossing.
   const residual=s.run(ax,ay);
   if(!Number.isFinite(residual)||Math.abs(residual)>Math.max(Math.abs(v),Math.abs(w)))return;
   record(ax,ay);
  }
  for(let j=0;j<=gridSteps;j++){
   const y=sampleRange(...yd,j,gridSteps);let left=NaN;
   for(let i=0;i<=gridSteps;i++){
    const x=sampleRange(...xd,i,gridSteps),v=s.run(x,y);
    if(Number.isFinite(v)){
     if(v===0)record(x,y);
     if(s.kind==='region' && (s.relation.startsWith('Greater')?v>0:v<0))interior=true;
     if(i)crossing(v,left,x,y,sampleRange(...xd,i-1,gridSteps),y);
     if(j)crossing(v,previousRow[i],x,y,x,sampleRange(...yd,j-1,gridSteps));
    }
    previousRow[i]=v;left=v;
   }
  }
  const tolerance=Math.max(xd[1]-xd[0],yd[1]-yd[0])*1e-8;
  if(Number.isFinite(xs[0]))edge=xs[0]<=xd[0]+tolerance||xs[1]>=xd[1]-tolerance||ys[0]<=yd[0]+tolerance||ys[1]>=yd[1]-tolerance;
  return {xs,ys,interior,edge};
 }
 function expanded(range,factor){const mid=(range[0]+range[1])/2,delta=(range[1]-range[0])*factor/2;return [mid-delta,mid+delta];}
 const sampleAt=[1,4,16,64,256,1024];
 let fitted=0;
 for(const s of plots){
  const xd=domain(s.expr,'x'),yd=domain(s.expr,'y');
  const currentX=surface?camera.cx:camera.x,currentY=surface?camera.cy:camera.y;
  const nearbyX=[currentX-radius,currentX+radius],nearbyY=[currentY-radius,currentY+radius];
  if(surface||s.kind==='x'||s.kind==='y'){
   const sample=surface?surfaceSamples:explicit;
   if(sample(s,xd,yd)||sample(s,nearbyX,nearbyY)||sampleAt.slice(1).some(f=>sample(s,expanded(xd,f),expanded(yd,f))))fitted++;
   continue;
  }
  let best=null,insideWindow=null;
  const windows=sampleAt.map(f=>[expanded(xd,f),expanded(yd,f)]);
  windows.splice(1,0,[nearbyX,nearbyY]);
  for(const [xx,yy] of windows){
   const e=implicitEdges(s,xx,yy);
   if(e.interior && !insideWindow)insideWindow=[xx,yy];
   if(!Number.isFinite(e.xs[0]))continue;
   if(!best)best=e;
   if(!e.edge){best=e;break;}
   // An open line or hyperbola can cross every search box. Keep the first
   // useful scale, but allow a larger box to recover a closed curve.
  }
  if(best){for(const x of best.xs)include(xLimits,x);for(const y of best.ys)include(yLimits,y);fitted++;}
  else if(insideWindow){for(const x of insideWindow[0])include(xLimits,x);for(const y of insideWindow[1])include(yLimits,y);fitted++;}
 }
 if(!fitted)return {error:'No finite plot values were found to fit.'};
 const center=range=>(range[0]+range[1])/2, width=range=>range[1]-range[0];
 const span=1.12*Math.max(surface?width(zLimits):0,width(xLimits),width(yLimits)*(surface?1:aspect),1);
 const centers=[center(xLimits),center(yLimits),...(surface?[center(zLimits)]:[])];
 if(!(span<=maxSpan)||centers.some(n=>!Number.isFinite(n)||Math.abs(n)>1e12))return {error:'These plots exceed the supported graph range. Hide a distant plot and try Fit again.'};
 return {x:centers[0],y:centers[1],z:centers[2],span,fitted};
}
function fitGraphView(){
 const plots=graphSeries.filter(s=>!s.row.plotHidden);
 if(!plots.length){describeGraph();return;}
 const surface=inSurface(),frame=estimateGraphFrame(plots,surface?surfaceView:graphView,graphCanvas.clientWidth/Math.max(1,graphCanvas.clientHeight),surface);
 if(frame.error){$('#graphStatus').textContent=frame.error;return;}
 if(surface){
  stopSurfaceSpin();Object.assign(surfaceView,{cx:frame.x,cy:frame.y,cz:frame.z,span:frame.span});
  syncSurfaceControls();saveSurfaceSoon();
 }else{
  const crossing=linearSystem(plots);
  Object.assign(graphView,{x:frame.x,y:frame.y,span:frame.span});
  if(crossing?.kind==='crossing'){
   const g=graphGeometry(graphCanvas.clientWidth,graphCanvas.clientHeight);
   if(g.screenX(crossing.x)<8||g.screenX(crossing.x)>graphCanvas.clientWidth-8||
      g.screenY(crossing.y)<8||g.screenY(crossing.y)>graphCanvas.clientHeight-8){
    graphView.x=crossing.x;graphView.y=crossing.y;
   }
  }
 }
 $('#surfaceProbe').hidden=$('#graphCoordinates').hidden=true;
 describeGraph();redrawGraph();
 if(frame.fitted<plots.length)$('#graphStatus').textContent='Framed '+frame.fitted+' of '+plots.length+' plots with finite samples.';
}
$('#graphFit').addEventListener('click',fitGraphView);
