// The plane, its intersection lines, and the chart share world coordinates.
const sliceChart=$('#slicePlot'),sliceHandle=$('#sliceHandle');
const sliceSamples=new WeakMap();
let sliceProbe=0,sliceDrag=null,sliceScene=null,sliceHandleVector=null;
let sliceBackdrop=null,sliceOverlayFrame=0;
// A moving cut changes only the overlay. Keep one background bitmap at the
// displayed resolution while the slice inspector is open.
function rememberSliceBackdrop(canvas){
 if(sliceOverlayFrame){cancelAnimationFrame(sliceOverlayFrame);sliceOverlayFrame=0;}
 if(!sliceBackdrop)sliceBackdrop=document.createElement('canvas');
 if(sliceBackdrop.width!==canvas.width)sliceBackdrop.width=canvas.width;
 if(sliceBackdrop.height!==canvas.height)sliceBackdrop.height=canvas.height;
 sliceBackdrop.getContext('2d').drawImage(canvas,0,0);
}
function redrawSliceOverlay(){
 if(graphFrame||sliceOverlayFrame)return;
 if(!sliceBackdrop||!sliceScene){redrawGraph();return;}
 sliceOverlayFrame=requestAnimationFrame(()=>{
  sliceOverlayFrame=0;
  if(graphFrame||!inSurface()||!surfaceView.slicing)return;
  const w=graphCanvas.clientWidth,h=graphCanvas.clientHeight;
  if(!w||!h)return;
  if(!sliceBackdrop||!sliceScene||sliceBackdrop.width!==graphCanvas.width||sliceBackdrop.height!==graphCanvas.height){
   redrawGraph();return;
  }
  const ctx=graphCanvas.getContext('2d');
  ctx.setTransform(graphCanvas.width/w,0,0,graphCanvas.height/h,0,0);
  ctx.drawImage(sliceBackdrop,0,0,w,h);
  const shown=graphSeries.filter(s=>!s.row.plotHidden);
  paintLinkedSlice(ctx,w,h,shown,sliceScene.palette,true);
 });
}
function sliceFrame(view){
 const onY=view.sliceAxis==='y',axis=onY?'y':'x',half=view.span/2;
 const fixedCenter=onY?view.cy:view.cx,freeCenter=onY?view.cx:view.cy,key=onY?'sliceY':'sliceX';
 const at=bounded(view[key],fixedCenter-half,fixedCenter+half,fixedCenter);
 return {onY,axis,free:onY?'x':'y',at,half,freeCenter,fixedCenter,key,cz:view.cz,
  normal:(at-fixedCenter)/half};
}
function syncSliceControls(){
 const active=inSurface()&&surfaceView.slicing===true;
 $('#surfaceSlice').setAttribute('aria-expanded',String(active));
 graphPanel.dataset.sliceOpen=String(active);
 $('#slicePanel').hidden=!active;sliceHandle.hidden=!active;
 if(!active){
  if(sliceOverlayFrame)cancelAnimationFrame(sliceOverlayFrame);
  sliceOverlayFrame=0;sliceScene=null;
  if(sliceBackdrop){sliceBackdrop.width=sliceBackdrop.height=1;sliceBackdrop=null;}
  return;
 }
 const frame=sliceFrame(surfaceView);
 surfaceView[frame.key]=frame.at;
 $('#sliceAxis').value=frame.axis;
 $('#slicePosition').value=Math.round(frame.normal*500);
 const caption=frame.axis+' = '+graphNumber(frame.at);
 $('#sliceAt').textContent=caption;
 $('#slicePosition').setAttribute('aria-valuetext',caption);
}
function setSliceNormal(normal){
 const frame=sliceFrame(surfaceView);
 surfaceView[frame.key]=frame.fixedCenter+frame.half*bounded(normal,-1,1,0);
 syncSliceControls();redrawSliceOverlay();saveSurfaceSoon();
}
$('#surfaceSlice').onclick=()=>{
 surfaceView.slicing=!surfaceView.slicing;syncSliceControls();persist();redrawGraph();
};
$('#sliceAxis').onchange=e=>{
 surfaceView.sliceAxis=e.target.value;syncSliceControls();persist();redrawSliceOverlay();
};
$('#slicePosition').oninput=e=>setSliceNormal(Number(e.target.value)/500);

function sampleSliceLine(run,f,count){
 const key=[f.axis,f.at,f.freeCenter,f.half,f.cz,count].join(',');
 const cached=sliceSamples.get(run);
 if(cached?.key===key)return cached.segments;
 const segments=[];
 function z(t){
  const free=f.freeCenter+t*f.half;
  return ((f.onY?run(free,f.at):run(f.at,free))-f.cz)/f.half;
 }
 let a=-1,za=z(a);
 for(let i=1;i<=count;i++){
  const b=2*i/count-1,zb=z(b);
  if(Number.isFinite(za)&&Number.isFinite(zb)&&Math.min(za,zb)<=1&&Math.max(za,zb)>=-1){
   const mid=z((a+b)/2);
   // Checking the midpoint also separates opposite branches across a pole.
   if(Number.isFinite(mid)&&Math.abs(mid-(za+zb)/2)<=Math.max(.005,.12*Math.abs(za-zb))){
    const d=zb-za;
    const start=za>1?(1-za)/d:za< -1?(-1-za)/d:0;
    const end=zb>1?(1-za)/d:zb< -1?(-1-za)/d:1;
    segments.push([a+(b-a)*start,Math.max(-1,Math.min(1,za+d*start)),
                   a+(b-a)*end,Math.max(-1,Math.min(1,za+d*end))]);
   }
  }
  a=b;za=zb;
 }
 sliceSamples.set(run,{key,segments});
 return segments;
}
function traceSliceLine(ctx,segments,project){
 let lastT=NaN,lastZ=NaN;
 ctx.beginPath();
 for(const [t,z,nextT,nextZ] of segments){
  if(t!==lastT||z!==lastZ){const p=project(t,z);ctx.moveTo(p.u,p.v);}
  const q=project(nextT,nextZ);ctx.lineTo(q.u,q.v);
  lastT=nextT;lastZ=nextZ;
 }
}
function positionSliceHandle(p,q){
 sliceHandle.style.left=p.u+'px';sliceHandle.style.top=p.v+'px';
 const dx=q.u-p.u,dy=q.v-p.v;
 sliceHandleVector={dx,dy};
 const angle=Math.atan2(dy,dx);
 sliceHandle.firstElementChild.style.transform='rotate('+angle+'rad)';
}
function paintLinkedSlice(ctx,w,h,series,palette,onscreen){
 const shown=series.filter(s=>s.kind!=='curve');
 const f=sliceFrame(surfaceView);
 const cost=shown.reduce((sum,s)=>sum+Math.max(1,s.cost||1),0);
 const count=Math.max(32,Math.min(420,Math.ceil(w),Math.floor(100000/Math.max(cost,1))));
 const curves=shown.map(s=>({series:s,segments:sampleSliceLine(s.run,f,count)}));
 const accent=getComputedStyle(graphPanel).getPropertyValue('--pad-accent').trim();
 ctx.save();
 ctx.strokeStyle=ctx.fillStyle=accent;
 if(surfaceView.heatmap){
  const g=surfaceHeatGeometry(w,h,surfaceView);
  const project=(normal,free)=>f.onY?{u:g.px(f.freeCenter+free*f.half),v:g.py(f.fixedCenter+normal*f.half)}:
   {u:g.px(f.fixedCenter+normal*f.half),v:g.py(f.freeCenter+free*f.half)};
  const p=project(f.normal,-1),q=project(f.normal,1);
  ctx.beginPath();ctx.moveTo(p.u,p.v);ctx.lineTo(q.u,q.v);
  ctx.strokeStyle=palette.paper;ctx.lineWidth=3.6;ctx.stroke();ctx.strokeStyle=accent;ctx.lineWidth=1.8;ctx.setLineDash([6,4]);ctx.stroke();
  if(onscreen)positionSliceHandle(project(f.normal,.76),project(f.normal+1,.76));
 }else{
  const camera=surfaceProjection(w,h,surfaceView);
  const point=(normal,t,z)=>f.onY?camera.project(t,normal,z):camera.project(normal,t,z);
  const onPlane=(t,z)=>point(f.normal,t,z);
  ctx.beginPath();
  for(const [i,[t,z]] of [[-1,-1],[1,-1],[1,1],[-1,1]].entries()){
   const p=onPlane(t,z);
   if(i===0)ctx.moveTo(p.u,p.v);else ctx.lineTo(p.u,p.v);
  }
  ctx.closePath();ctx.globalAlpha=.13;ctx.fill();
  ctx.globalAlpha=.8;ctx.setLineDash([5,4]);ctx.lineWidth=1.2;ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);
  for(const {series,segments} of curves){
   traceSliceLine(ctx,segments,onPlane);ctx.strokeStyle=palette.paper;ctx.lineWidth=4;ctx.stroke();
   ctx.strokeStyle=series.look.color;ctx.lineWidth=2.2;ctx.stroke();
  }
  if(onscreen)positionSliceHandle(onPlane(0,.83),point(f.normal+1,0,.83));
 }
 ctx.restore();
 if(onscreen){sliceScene={f,curves,palette,accent};paintSliceChart();}
}

function paintSliceChart(){
 if(!sliceScene||sliceChart.hidden||!sliceChart.clientWidth)return;
 const {f,curves,palette,accent}=sliceScene,w=sliceChart.clientWidth,h=sliceChart.clientHeight;
 const ratio=Math.min(3,window.devicePixelRatio||1);
 const pw=Math.round(w*ratio),ph=Math.round(h*ratio);
 if(sliceChart.width!==pw||sliceChart.height!==ph){sliceChart.width=pw;sliceChart.height=ph;}
 const ctx=sliceChart.getContext('2d');ctx.setTransform(pw/w,0,0,ph/h,0,0);
 const left=39,right=w-12,top=17,bottom=h-24;
 if(right<=left||bottom<=top)return;
 const px=t=>left+(right-left)*(t+1)/2,py=z=>bottom-(bottom-top)*(z+1)/2;
 const project=(t,z)=>({u:px(t),v:py(z)});
 ctx.fillStyle=palette.paper;ctx.fillRect(0,0,w,h);
 ctx.font='10px system-ui,sans-serif';ctx.textBaseline='top';ctx.textAlign='center';
 ctx.strokeStyle=palette.grid;ctx.lineWidth=1;ctx.fillStyle=palette.label;
 const ticksX=surfaceTicks(f.freeCenter-f.half,f.freeCenter+f.half,Math.max(2,Math.floor((right-left)/55)));
 const ticksZ=surfaceTicks(f.cz-f.half,f.cz+f.half,Math.max(2,Math.floor((bottom-top)/42)));
 ctx.beginPath();
 for(const tick of ticksX){
  const x=px((tick-f.freeCenter)/f.half);ctx.moveTo(x,top);ctx.lineTo(x,bottom);
  if(x<right-9)ctx.fillText(surfaceTickText(tick),x,bottom+5);
 }
 ctx.textAlign='right';ctx.textBaseline='middle';
 for(const tick of ticksZ){
  const y=py((tick-f.cz)/f.half);ctx.moveTo(left,y);ctx.lineTo(right,y);
  ctx.fillText(surfaceTickText(tick),left-5,y,left-7);
 }
 ctx.stroke();ctx.strokeStyle=palette.axis;ctx.strokeRect(left,top,right-left,bottom-top);
 ctx.font='italic 14px Georgia,serif';ctx.fillText('z',left+8,9);ctx.fillText(f.free,right+3,bottom+11);
 ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
 const cursorX=px(sliceProbe);
 ctx.beginPath();ctx.moveTo(cursorX,top);ctx.lineTo(cursorX,bottom);ctx.strokeStyle=accent;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
 const free=f.freeCenter+sliceProbe*f.half;
 const caption=f.free+' = '+graphNumber(free);
 const values=[{text:caption}];
 for(const {series:s,segments} of curves){
  traceSliceLine(ctx,segments,project);
  const gradient=ctx.createLinearGradient(0,bottom,0,top);
  s.look.ramp.forEach((color,i,colors)=>gradient.addColorStop(i/(colors.length-1),color));
  ctx.lineWidth=2.5;ctx.strokeStyle=gradient;ctx.stroke();
  const z=f.onY?s.run(free,f.at):s.run(f.at,free);
  const text='Line '+s.line+' · z = '+(Number.isFinite(z)?graphNumber(z):'undefined');
  values.push({text,color:s.look.color});
  if(Number.isFinite(z)&&Math.abs(z-f.cz)<=f.half){
   ctx.beginPath();ctx.arc(cursorX,py((z-f.cz)/f.half),3.5,0,Math.PI*2);
   ctx.fillStyle=s.look.color;ctx.fill();ctx.strokeStyle=palette.paper;ctx.lineWidth=1;ctx.stroke();
  }
 }
 ctx.restore();
 if(!curves.some(c=>c.segments.length)){
  ctx.font='11px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle=palette.label;
  ctx.fillText(curves.length?'No curve in this range':'No visible surfaces',(left+right)/2,(top+bottom)/2,right-left-6);
 }
 const text=values.map(v=>v.text).join(', ');
 sliceChart.setAttribute('aria-valuemin',String(f.freeCenter-f.half));
 sliceChart.setAttribute('aria-valuemax',String(f.freeCenter+f.half));
 sliceChart.setAttribute('aria-valuenow',String(free));sliceChart.setAttribute('aria-valuetext',text);
 const box=$('#sliceValues'),signature=values.map(v=>v.text+v.color).join('|');
 if(signature!==box.dataset.signature){
  box.dataset.signature=signature;
  box.replaceChildren(...values.map(v=>{
   const span=document.createElement('span');
   if(v.color){const swatch=document.createElement('i');swatch.style.background=v.color;span.append(swatch);}
   span.append(v.text);return span;
  }));
 }
}
function inspectSlice(e){
 const rect=sliceChart.getBoundingClientRect();
 sliceProbe=bounded(2*((e.clientX-rect.left)-39)/(rect.width-51)-1,-1,1,0);paintSliceChart();
}
sliceChart.addEventListener('pointermove',inspectSlice);
sliceChart.addEventListener('pointerdown',inspectSlice);
function sliceKeyboardNormal(key,current,step){
 if(key==='Home')return -1;
 if(key==='End')return 1;
 if(key==='ArrowLeft'||key==='ArrowDown')return current-step;
 if(key==='ArrowRight'||key==='ArrowUp')return current+step;
 return null;
}
sliceChart.addEventListener('keydown',e=>{
 const normal=sliceKeyboardNormal(e.key,sliceProbe,e.shiftKey?.2:.02);
 if(normal!==null){e.preventDefault();sliceProbe=bounded(normal,-1,1,0);paintSliceChart();}
});
sliceHandle.addEventListener('keydown',e=>{
 const normal=sliceKeyboardNormal(e.key,sliceFrame(surfaceView).normal,e.shiftKey?.2:.02);
 if(normal!==null){e.preventDefault();setSliceNormal(normal);}
});
sliceHandle.addEventListener('pointerdown',e=>{
 if(e.button!==0||sliceDrag||!sliceHandleVector)return;
 e.preventDefault();stopSurfaceSpin();
 sliceHandle.focus({preventScroll:true});sliceHandle.setPointerCapture(e.pointerId);
 sliceDrag={id:e.pointerId,x:e.clientX,y:e.clientY,normal:sliceFrame(surfaceView).normal,...sliceHandleVector};
});
sliceHandle.addEventListener('pointermove',e=>{
 if(!sliceDrag||sliceDrag.id!==e.pointerId)return;
 const {x,y,dx,dy,normal}=sliceDrag,length=dx*dx+dy*dy;
 const offset=length>64?((e.clientX-x)*dx+(e.clientY-y)*dy)/length:2*(e.clientX-x)/graphCanvas.clientWidth;
 setSliceNormal(normal+offset);
});
sliceHandle.addEventListener('lostpointercapture',()=>{sliceDrag=null;});
new ResizeObserver(()=>{if(sliceScene)paintSliceChart();}).observe(sliceChart);
