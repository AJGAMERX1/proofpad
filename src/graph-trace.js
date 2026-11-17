const traceBox=$('#graphTrace'),traceLine=$('#traceLine'),traceInput=$('#traceCoordinate');
let traceRun=null,traceKey='',traceList='';
function updateGraphTrace(){
 if(!traceBox.open||workspaceMode!=='calculator')return;
 const curves=graphSeries.filter(s=>!s.row.plotHidden && s.kind!=='region');
 const list=curves.map(s=>s.line).join(',');
 if(list!==traceList || !traceLine.options.length){
  const old=traceLine.value;
  traceLine.replaceChildren(...curves.map(s=>new Option('Line '+s.line,s.line)));
  if(curves.some(s=>s.line===old))traceLine.value=old;
  traceList=list;
 }
 const curve=curves.find(s=>s.line===traceLine.value),v=traceInput.valueAsNumber;
 const h=graphCanvas.clientHeight,w=graphCanvas.clientWidth;
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
$('#jumpWrite').onclick=focusWriting;
$('#jumpGraph').onclick=focusPlot;
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
 event.preventDefault();traceInput.value=Number(((traceInput.valueAsNumber||0)+sign*(event.shiftKey?.1:1)).toPrecision(12));updateGraphTrace();
};
graphCanvas.addEventListener('keydown',event=>{
 if(workspaceMode!=='calculator'||event.key.toLowerCase()!=='t'||event.ctrlKey||event.metaKey||event.altKey)return;
 event.preventDefault();traceBox.open=true;updateGraphTrace();traceInput.focus();traceInput.select();
});
