const surfaceRamps={
 coast:['#174b80','#278fac','#72c6bf','#e2f1d7'],
 peach:['#8e315a','#d96b79','#f5ae91','#fff0ce'],
 lilac:['#443270','#7e65b3','#b6a1dd','#f2e9ff'],
 mint:['#12595c','#3e9c90','#99d7bc','#eef4bf'],
 dusk:['#343d6a','#786196','#bf8daa','#f4c5b8'],
 citrus:['#286348','#79a85b','#d5d974','#fff0af'],

 aurora:['#39266d','#3961ac','#139ca0','#60d49b','#f5ed8c'],
 ember:['#332041','#843463','#d15451','#fa9854','#fff3a0'],
 glacier:['#142648','#224fa1','#277fae','#65cde2','#e1fcff'],
 prism:['#50278c','#3761c0','#12a7ab','#b1df56','#ffac49','#d74277'],
 rose:['#370e27','#7a163f','#bd345a','#ec7586','#f8b5aa','#fff0d9'],
 meadow:['#0b342d','#126343','#3d8951','#7eaf50','#b9cf66','#f4edaf'],
 twilight:['#182548','#384b91','#7158ae','#ae72ae','#eaa0a0','#ffd79e'],
 lava:['#1d1225','#53133d','#971d32','#d43b1c','#fa7a12','#ffd541','#fff7bf'],
 lagoon:['#082e45','#005775','#007e96','#10a6ae','#68d1bd','#d1f2d1'],
 copper:['#153c45','#30666b','#748579','#ac866a','#d39774','#f8d2a6'],
 orchid:['#231746','#54266f','#8a3e98','#b963b1','#db9cda','#f8e3fd'],
 // Nine evenly spaced samples of Matplotlib's published Cividis color map.
 cividis:['#00224e','#1a386f','#434e6c','#61656f','#7d7c78','#9a9376','#bbad6d','#ddc858','#fee838']
};
function surfaceRampLabel(key){
 return Object.hasOwn(surfaceRamps,key)?key[0].toUpperCase()+key.slice(1):'Aurora';
}
const surfaceHome={yaw:.72,pitch:.52,span:12,cx:0,cy:0,cz:0};
const surfaceView={...surfaceHome,heatmap:false,mesh:true,palette:'aurora'};
const surfaceExamples={
 ripple:String.raw`\cos\left(\sqrt{x^2+y^2}\right)`,
 saddle:String.raw`\frac{x^2-y^2}{5}`,
 waves:String.raw`\sin(x)\cos(y)`,
 peaks:String.raw`2e^{-\frac{(x-2)^2+y^2}{4}}+2e^{-\frac{(x+2)^2+(y-1)^2}{3}}-1`
};
let spinFrame=0, spinLast=0, surfaceSaveTimer=0;
function isCalculatorMode(mode=workspaceMode){return mode==='calculator'||mode==='surface'}
function inSurface(){return workspaceMode==='surface'}
function bounded(n,min,max,fallback){return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function surfaceDraftSettings(){return {...surfaceView,...calculatorPreferences()}}
function restoreSurfaceSettings(saved={}){
 if(!saved||typeof saved!=='object')saved={};
 Object.assign(surfaceView,surfaceHome,{
  yaw:bounded(saved.yaw,-Math.PI*2,Math.PI*2,surfaceHome.yaw),pitch:bounded(saved.pitch,-1.48,1.48,surfaceHome.pitch),
  span:bounded(saved.span,1e-5,1e7,surfaceHome.span),mesh:saved.mesh!==false,heatmap:saved.heatmap===true,
  palette:Object.hasOwn(surfaceRamps,saved.palette)?saved.palette:'aurora'
 });
 for(const axis of ['cx','cy','cz'])surfaceView[axis]=bounded(saved[axis],-1e12,1e12,0);
 $('#calcAngle').value=saved.angle==='deg'?'deg':'rad';
 $('#calcDigits').value=[6,10,15].includes(saved.digits)?saved.digits:10;
}
function applyGraphWorkspace(previousMode,data){
 stopSurfaceSpin();
 if(inSurface()){
  if(!historyRestoring)restoreSurfaceSettings(data.surfaceView);
 }else if(previousMode==='surface'){
  let saved={};try{saved=JSON.parse(localStorage.getItem('proofpad-calculator-settings'))||{}}catch{}
  $('#calcAngle').value=saved.angle==='deg'?'deg':'rad';
  $('#calcDigits').value=[6,10,15].includes(saved.digits)?saved.digits:10;
 }
 $('#graphHeading').textContent=inSurface()?'Surface explorer':'Graph';
 $('#graphExample').textContent=inSurface()?'Add example':'Plot example';
 $('#surfaceProbe').hidden=$('#graphCoordinates').hidden=true;
 $('#graphKeys').textContent=inSurface()?'Drag or use arrow keys to rotate the surface or pan the heat map. Shift-drag pans the surface. Scroll, pinch, or use plus and minus to zoom. Home resets the view.':'Drag or use the arrow keys to pan. Scroll, pinch, or press plus and minus to zoom. Press Home to reset.';
 syncSurfaceControls();
}
function syncSurfaceControls(){
 $('#surfaceOrbit').setAttribute('aria-pressed',String(!surfaceView.heatmap));
 $('#surfaceHeatmap').setAttribute('aria-pressed',String(surfaceView.heatmap));
 $('#surfacePalette').value=surfaceView.palette;
 $('#surfaceMesh').checked=surfaceView.mesh;
 $('#surfaceMeshLabel').textContent=surfaceView.heatmap?'Contours':'Mesh';
 $('#surfaceSpin').disabled=surfaceView.heatmap;
 graphPanel.dataset.heat=String(surfaceView.heatmap && inSurface());
 updateSurfaceKeys();
}
function updateSurfaceKeys(){
 if(!inSurface())return;
 const box=$('#surfaceKeys');
 const visible=graphSeries.filter(s=>s.look && !s.row.plotHidden);
 const minimum=graphNumber(surfaceView.cz-surfaceView.span/2);
 const maximum=graphNumber(surfaceView.cz+surfaceView.span/2);
 const signature=[minimum,maximum,...visible.map(s=>s.line+' '+s.look.rampName+' '+s.look.ramp.join(','))].join('|');
 if(box.dataset.key===signature)return;
 box.dataset.key=signature;
 const keys=document.createDocumentFragment();
 for(const series of visible){
  const key=document.createElement('div');key.className='surface-key';
  const name=document.createElement('span');name.textContent='Line '+series.line+' · '+series.look.rampName;
  const low=document.createElement('span');low.textContent=minimum;
  const bar=document.createElement('i');bar.style.background='linear-gradient(90deg,'+series.look.ramp.join(',')+')';
  const high=document.createElement('span');high.textContent=maximum;
  key.append(name,low,bar,high);keys.append(key);
 }
 box.replaceChildren(keys);box.parentElement.hidden=!visible.length;
}
function saveSurfaceSoon(){
 clearTimeout(surfaceSaveTimer);
 surfaceSaveTimer=setTimeout(()=>{if(inSurface())persist()},200);
}
function surfaceStatus(){
 if(!graphSeries.length)return 'Enter z = x² + y² or add an example.';
 return surfaceView.heatmap?'Move over the map to read x, y and height. Drag to pan.':'Drag to rotate · Shift-drag to pan · Scroll or pinch to zoom';
}
function updateSurfaceMode(heatmap){
 stopSurfaceSpin();surfaceView.heatmap=heatmap;$('#surfaceProbe').hidden=$('#graphCoordinates').hidden=true;
 syncSurfaceControls();describeGraph();persist();redrawGraph();
}
function stopSurfaceSpin(){
 if(spinFrame){cancelAnimationFrame(spinFrame);redrawGraph();}
 spinFrame=0;spinLast=0;$('#surfaceSpin').setAttribute('aria-pressed','false');
}
function spinSurface(t){
 if(!inSurface()||surfaceView.heatmap||document.hidden){stopSurfaceSpin();return}
 if(spinLast)surfaceView.yaw=(surfaceView.yaw+Math.min(80,t-spinLast)*.00032)%(2*Math.PI);
 spinLast=t;redrawGraph();spinFrame=requestAnimationFrame(spinSurface);
}
$('#surfaceOrbit').onclick=()=>updateSurfaceMode(false);
$('#surfaceHeatmap').onclick=()=>updateSurfaceMode(true);
$('#surfacePalette').onchange=e=>{surfaceView.palette=e.target.value;syncSurfaceControls();persist();onSeriesStyleChanged()};
$('#surfaceMesh').onchange=e=>{surfaceView.mesh=e.target.checked;persist();redrawGraph()};
$('#surfaceSpin').onclick=()=>{
 if(spinFrame){stopSurfaceSpin();persist();return}
 spinFrame=requestAnimationFrame(spinSurface);$('#surfaceSpin').setAttribute('aria-pressed','true');
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSurfaceSpin()});
function orbitSurface(dx,dy){
 surfaceView.yaw=(surfaceView.yaw+dx*.009)%(2*Math.PI);
 surfaceView.pitch=bounded(surfaceView.pitch+dy*.009,-1.48,1.48,.52);
}
function panSurface(dx,dy){
 const w=graphCanvas.clientWidth,h=graphCanvas.clientHeight;
 if(surfaceView.heatmap){
  const g=surfaceHeatGeometry(w,h,surfaceView);
  surfaceView.cx-=dx/g.scale;surfaceView.cy+=dy/g.scale;
 }else{
  const g=surfaceProjection(w,h,surfaceView);
  ['cx','cy','cz'].forEach((axis,i)=>surfaceView[axis]-=(dx*g.right[i]-dy*g.up[i])/g.scale);
 }
 syncSurfaceControls();
}
function inspectHeatmap(p){
 const output=$('#graphCoordinates'),g=surfaceHeatGeometry(graphCanvas.clientWidth,graphCanvas.clientHeight,surfaceView);
 const probe=$('#surfaceProbe');
 if(!g.inside(p.x,p.y)){output.hidden=probe.hidden=true;return}
 const x=g.x(p.x),y=g.y(p.y),minimum=surfaceView.cz-surfaceView.span/2,maximum=surfaceView.cz+surfaceView.span/2;
 let highest=-Infinity,topLine=null;
 for(const series of graphSeries){
  if(series.row.plotHidden)continue;
  const z=series.run(x,y);
  if(Number.isFinite(z)&&z>=minimum&&z<=maximum&&z>highest){highest=z;topLine=series.line;}
 }
 output.textContent=(topLine && graphSeries.length>1?'Line '+topLine+'   ':'')+'x '+graphNumber(x)+'   y '+graphNumber(y)+(Number.isFinite(highest)?'   z '+graphNumber(highest):'   z —');
 probe.style.left=p.x+'px';probe.style.top=p.y+'px';probe.hidden=false;
 output.hidden=false;
}
function initialSurfaceEntries(){
 return [{type:'math',value:'z=a'+surfaceExamples.ripple},{type:'math',value:'a=2'}];
}
function addSurfaceExample(){
 const expression=surfaceExamples[$('#surfacePreset').value];
 const value='z='+(['ripple','waves'].includes($('#surfacePreset').value)?'2':'')+expression;
 if(entries().every(entry=>!hasContent(entry.value)))replaceEntries([{type:'math',value}]);
 else addRow(value,true,'math');
 schedule();resetGraph();
}
