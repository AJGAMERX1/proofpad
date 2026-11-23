const traceBox=$('#graphTrace'),traceLine=$('#traceLine'),traceInput=$('#traceCoordinate');
let traceRun=null,traceKey='',traceList='';
const traceValues={calculator:'0',surface:'0'};
let traceWorkspace='calculator';

function traceCurvePoint(curve,t,w,h) {
 const marker=$('#traceMarkers');
 const range=curve && graphCurveRange(curve);
 let point, reading;
 if (!curve) reading='Show a 3D curve to read its coordinates.';
 else if (!range) reading='Check the t range for this curve.';
 else if (!Number.isFinite(t)) reading='Enter a finite value for t.';
 else if (t<range[0] || t>range[1]) reading='Enter t between '+graphNumber(range[0])+' and '+graphNumber(range[1])+'.';
 else {
  point=curve.run(t);
  if (point?.every(Number.isFinite)) {
   reading=point.map((value,index)=>'xyz'[index]+' = '+graphNumber(value)).join(', ');
  } else {
   point=null; reading='Undefined at t = '+graphNumber(t)+'.';
  }
 }
 const output=$('#traceStatus');
 if (output.textContent!==reading) output.textContent=reading;
 if (point && w && h && !surfaceView.heatmap) {
  const half=surfaceView.span/2;
  const normalized=point.map((value,index)=>(value-[surfaceView.cx,surfaceView.cy,surfaceView.cz][index])/half);
  if (normalized.every(value=>Math.abs(value)<=1)) {
   const screen=surfaceProjection(w,h,surfaceView).project(...normalized);
   let dot=marker.firstElementChild;
   if (!dot || marker.childElementCount!==1) {dot=document.createElement('i'); marker.replaceChildren(dot);}
   dot.style.left=screen.u+'px'; dot.style.top=screen.v+'px'; dot.style.borderColor=curve.look?.color || '';
   return;
  }
 }
 if (marker.childElementCount) marker.replaceChildren();
}

function updateGraphTrace(){
 if(!isCalculatorMode())return;
 const space=inSurface();
 if (workspaceMode!==traceWorkspace) {
  traceValues[traceWorkspace]=traceInput.value;
  traceWorkspace=workspaceMode;
  traceInput.type=space?'text':'number';
  traceInput.value=traceValues[workspaceMode];
  $('#traceAxis').textContent=space?'t =':'x =';
  traceInput.setAttribute('aria-label',space?'t parameter':'x coordinate');
  traceRun=null; traceKey='';
 }
 if (!traceBox.open) return;
 const curves=graphSeries.filter(s=>!s.row.plotHidden && (space?s.kind==='curve':s.kind!=='region'));
 const list=workspaceMode+':'+curves.map(s=>s.line).join(',');
 if(list!==traceList || !traceLine.options.length){
  const old=traceLine.value;
  traceLine.replaceChildren(...curves.map(s=>new Option('Line '+s.line,s.line)));
  if(curves.some(s=>s.line===old))traceLine.value=old;
  traceList=list;
 }
 const curve=curves.find(s=>s.line===traceLine.value);
 const h=graphCanvas.clientHeight,w=graphCanvas.clientWidth;
 if (space) {traceCurvePoint(curve,parseCurveParameter(traceInput.value),w,h);return;}
 const v=traceInput.valueAsNumber;
 const key=[curve?.line,v,graphView.x,graphView.y,graphView.span,w,h].join('|');
 if(traceRun===curve?.run && traceKey===key)return;
 traceKey=key;traceRun=curve?.run;
 $('#traceMarkers').replaceChildren();
 const sideways=curve?.kind==='x',axis=sideways?'y':'x';
 $('#traceAxis').textContent=axis+' =';
 traceInput.setAttribute('aria-label',axis+' coordinate');
 const out=$('#traceStatus');
 if(!curve || !Number.isFinite(v)||!w||!h){
  out.textContent=curve?'Enter a finite coordinate.':'Plot a visible equation to read its coordinates.';return;
 }
 const g=graphGeometry(w,h);
 let points=[];
 if(curve.kind==='implicit'){
  const vertical={kind:'x',line:'trace',run:()=>v};
  points=visibleIntersections([vertical,curve],{left:Math.min(v,g.worldX(0)),right:Math.max(v,g.worldX(w)),bottom:g.worldY(h),top:g.worldY(0),width:w,height:h}).points;
 }else{
  const result=sideways?curve.run(0,v):curve.run(v,0);
  if(Number.isFinite(result))points=[sideways?{x:result,y:v}:{x:v,y:result}];
 }
 const number=n=>String(Number(n.toPrecision(9)));
 const readings=points.map(p=>'x = '+number(p.x)+', y = '+number(p.y));
 out.textContent=readings.length?readings.join(' · '):curve.kind==='implicit'?'No isolated point found in the visible y range.':'Undefined at '+axis+' = '+number(v)+'.';
 for(const p of points){
  const x=g.screenX(p.x),y=g.screenY(p.y);
  if(x<0||y<0||x>w||y>h)continue;
  const dot=document.createElement('i');dot.style.left=x+'px';dot.style.top=y+'px';$('#traceMarkers').append(dot);
 }
}
// Empty explanation blocks have no glyph for MathLive's hit test.
// Give a first click a real caret before keyboard input arrives.
$('#rows').addEventListener('pointerdown',event=>{
 const field=event.target.closest('math-field');
 if(!field || hasContent(field.value) || event.button!==0)return;
 HTMLElement.prototype.focus.call(field,{preventScroll:true});
 field.focus({preventScroll:true});
});
function focusPlot(){
 if(!isCalculatorMode())switchWorkspace('calculator');
 graphCanvas.scrollIntoView({block:'center'});graphCanvas.focus({preventScroll:true});
}
function focusWriting(){
 const field=(active?.isConnected?active:null)||$('#rows math-field');
 if(field){
  field.scrollIntoView({block:'center'});
  // MathLive schedules focus. Give the editor keyboard focus in this event
  // so a student who immediately starts typing keeps their first character.
  HTMLElement.prototype.focus.call(field,{preventScroll:true});
  field.focus({preventScroll:true});
 }
}
document.querySelectorAll('button[data-mode]').forEach(button=>button.addEventListener('click',event=>{
 if(event.detail===0){if(isCalculatorMode())focusPlot();else focusWriting();}
}));
traceLine.onchange=traceInput.oninput=updateGraphTrace;
traceBox.ontoggle=()=>{
 if(traceBox.open){traceKey='';updateGraphTrace();}
 else $('#traceMarkers').replaceChildren();
};
traceInput.onkeydown=event=>{
 const sign={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[event.key];if(!sign)return;
 if (inSurface() && ['ArrowLeft','ArrowRight'].includes(event.key)) return;
 const current=inSurface()?parseCurveParameter(traceInput.value):traceInput.valueAsNumber;
 event.preventDefault();traceInput.value=Number(((Number.isFinite(current)?current:0)+sign*(event.shiftKey?.1:1)).toPrecision(12));updateGraphTrace();
};
graphCanvas.addEventListener('keydown',event=>{
 if(!isCalculatorMode()||event.key.toLowerCase()!=='t'||event.ctrlKey||event.metaKey||event.altKey)return;
 if(inSurface() && (surfaceView.heatmap || !graphSeries.some(s=>s.kind==='curve' && !s.row.plotHidden)))return;
 event.preventDefault();traceBox.open=true;updateGraphTrace();traceInput.focus();traceInput.select();
});
