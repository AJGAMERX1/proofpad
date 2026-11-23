// Appearance is stored on the expression row alongside its slider settings.
const seriesHueNames=['Blue','Rose','Green','Violet','Amber','Teal'];
const seriesRampOrder=['aurora','ember','glacier','prism','rose','meadow','twilight','lava','lagoon','copper','orchid','cividis','coast','peach','lilac','mint','dusk','citrus'];
const seriesPatterns=['solid','dashed','dotted'];

function normalizeSeriesAppearance(value){
 if(!value||typeof value!=='object')return null;
 const result={};
 if(Number.isInteger(value.hue)&&value.hue>=0&&value.hue<seriesHueNames.length)result.hue=value.hue;
 if(value.mode==='solid'||value.mode==='gradient')result.mode=value.mode;
 if(seriesRampOrder.includes(value.ramp))result.ramp=value.ramp;
 if(seriesPatterns.includes(value.pattern))result.pattern=value.pattern;
 if(Array.isArray(value.colors) && value.colors.length===3 &&
    value.colors.every(color=>typeof color==='string' && /^#[0-9a-f]{6}$/i.test(color))){
  result.colors=value.colors.map(color=>color.toLowerCase());
 }
 if(['soft','gloss','flat','wire'].includes(value.finish))result.finish=value.finish;
 if(['auto','off','fine','bold'].includes(value.grid))result.grid=value.grid;
 if(typeof value.opacity==='number' && Number.isFinite(value.opacity)){
  result.opacity=Math.min(1,Math.max(.25,value.opacity));
 }
 if(typeof value.reverse==='boolean')result.reverse=value.reverse;
 return Object.keys(result).length?result:null;
}
function seriesAppearance(series,index,style,is3d){
 const saved=series.row.appearance||{}, sequence=Math.max(0,index);
 const hue=saved.hue??(sequence%seriesHueNames.length),colorVar='--graph-curve'+(hue+1);
 let color=style.getPropertyValue(colorVar).trim();
 const rampKeys=seriesRampOrder,start=Math.max(0,rampKeys.indexOf(surfaceView.palette));
 const rampKey=saved.ramp||rampKeys[((is3d?start:0)+sequence)%rampKeys.length];
 const mode=series.kind==='curve'?'solid':saved.mode||(is3d?'gradient':'solid');
 let ramp=mode==='gradient'?(saved.colors||surfaceRamps[rampKey]).slice():[color,color];
 if(saved.reverse)ramp.reverse();
 if(mode==='gradient')color=ramp[Math.floor(ramp.length/2)];
 const strictRegion=series.kind==='region'&&['Less','Greater'].includes(series.relation);
 const lineGroup=Math.floor(sequence/seriesHueNames.length)%seriesPatterns.length;
 const pattern=saved.pattern||(is3d?'solid':strictRegion?'dashed':seriesPatterns[lineGroup]);
 const rampName=mode==='gradient'?(saved.colors?'Custom blend':surfaceRampLabel(rampKey)):seriesHueNames[hue];
 return {hue,color,colorVar,mode,ramp,rampKey,rampName,pattern,finish:saved.finish||'soft',grid:saved.grid||'auto',opacity:saved.opacity??1,reverse:saved.reverse===true};
}
const seriesStyleDialog=document.querySelector('#seriesStyleDialog');
let styleTarget=null;
function selectedSeriesStyle(){
 const index=graphSeries.findIndex(series=>series.row===styleTarget);
 return index<0?null:{series:graphSeries[index],index};
}
function setSeriesAppearance(partial){
 const target=selectedSeriesStyle();
 if(!target)return;
 beforeEdit('surface-style');
 const row=target.series.row;
 const value=partial?normalizeSeriesAppearance({...row.appearance,...partial}):null;
 if(value)row.appearance=value;else delete row.appearance;
 commitHistory();persist();onSeriesStyleChanged();syncSeriesDialog();
}
function syncSeriesDialog(){
 const target=selectedSeriesStyle();
 if(!target||!seriesStyleDialog.open)return;
 const {series,index}=target,look=seriesAppearance(series,index,getComputedStyle(graphPanel),inSurface());
 document.querySelector('#seriesStyleHeading').textContent=graphSeriesLabel(series.kind,series.line)+' style';
 syncSurfaceStyleEditor(target,look);
 document.querySelector('#seriesStrokeOptions').hidden=inSurface();
 document.querySelector('#seriesMorePalettes').hidden=series.kind==='curve';
 document.querySelector('#seriesResetStyle').disabled=!series.row.appearance;
 document.querySelectorAll('[data-series-hue]').forEach(button=>button.setAttribute('aria-pressed',String(look.mode==='solid'&&Number(button.dataset.seriesHue)===look.hue)));
 document.querySelectorAll('[data-series-ramp]').forEach(button=>button.setAttribute('aria-pressed',String(look.mode==='gradient'&&!series.row.appearance?.colors&&button.dataset.seriesRamp===look.rampKey)));
 document.querySelectorAll('[data-series-pattern]').forEach(button=>button.setAttribute('aria-pressed',String(look.pattern===button.dataset.seriesPattern)));
}
function openSeriesStyle(series){
 if(!series?.row?.isConnected)return;
 styleTarget=series.row;
 $('#seriesMorePalettes').open=!inSurface();
 $('#surfaceStyleMessage').textContent='';
 seriesStyleDialog.style.removeProperty('--picker-left');seriesStyleDialog.style.removeProperty('--picker-top');
 if(!seriesStyleDialog.open)seriesStyleDialog.showModal();
 syncSeriesDialog();
 if(series.kind==='surface')renderSurfaceLookThumbnails();
 if(!inSurface() && innerWidth>900){
  const anchor=series.row.querySelector('.plot-style-trigger')?.getBoundingClientRect();
  const box=seriesStyleDialog.getBoundingClientRect();
  if(anchor){
   const x=Math.max(10,Math.min(anchor.left,innerWidth-box.width-10));
   const y=Math.max(10,Math.min(anchor.bottom+5,innerHeight-box.height-10));
   seriesStyleDialog.style.setProperty('--picker-left',x+'px');seriesStyleDialog.style.setProperty('--picker-top',y+'px');
  }
 }
}
seriesStyleDialog.addEventListener('close',()=>{styleTarget=null});
document.querySelector('#seriesStyleDone').onclick=()=>seriesStyleDialog.close();
document.querySelector('#seriesResetStyle').onclick=()=>setSeriesAppearance(null);
seriesHueNames.forEach((name,index)=>{
 const button=document.createElement('button');
 button.type='button';button.dataset.seriesHue=index;button.textContent=name;
 button.style.setProperty('--series-sample','var(--graph-curve'+(index+1)+')');
 button.onclick=()=>setSeriesAppearance({mode:'solid',hue:index});
 document.querySelector('#seriesHues').append(button);
});
for(const key of seriesRampOrder){
 const name=surfaceRampLabel(key);
 const button=document.createElement('button');
 button.type='button';button.dataset.seriesRamp=key;button.textContent=name;
 // These stops are shared with the heat map and the exported PNG renderer.
 button.style.setProperty('--series-sample','linear-gradient(90deg,'+surfaceRamps[key].join(',')+')');
 button.onclick=()=>setSeriesAppearance({mode:'gradient',ramp:key,colors:null,reverse:false});
 document.querySelector('#seriesRamps').append(button);
}
for(const key of seriesPatterns){
 const button=document.createElement('button');
 button.type='button';button.dataset.seriesPattern=key;button.textContent=key[0].toUpperCase()+key.slice(1);
 button.style.setProperty('--series-stroke',key);
 button.onclick=()=>setSeriesAppearance({pattern:key});
 document.querySelector('#seriesStrokes').append(button);
}
function refreshSeriesStyleControls(seriesList=graphSeries){
 const plotted=new Set(seriesList.map(series=>series.row));
 for(const trigger of document.querySelectorAll('#rows .plot-style-trigger')){
  if(!plotted.has(trigger.closest('.row')))trigger.remove();
 }
 if(seriesStyleDialog.open && !plotted.has(styleTarget))seriesStyleDialog.close();
 $('#surfaceStyles').disabled=!seriesList.length;
 const style=getComputedStyle(graphPanel);
 seriesList.forEach((series,index)=>{
  const row=series.row, look=seriesAppearance(series,index,style,inSurface());
  let trigger=row.querySelector('.plot-style-trigger');
  if(!trigger){
   trigger=document.createElement('button');trigger.type='button';trigger.className='plot-style-trigger';trigger.textContent='Style';
   trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','seriesStyleDialog');
   row.querySelector('.calc-output').prepend(trigger);
   trigger.onclick=()=>openSeriesStyle(graphSeries.find(item=>item.row===row));
  }
  trigger.style.setProperty('--series-sample',look.mode==='gradient'?'linear-gradient(90deg,'+look.ramp.join(',')+')':'var('+look.colorVar+')');
  trigger.setAttribute('aria-label','Style for line '+series.line);
  trigger.title='Style for line '+series.line+' · '+look.rampName;
 });
 syncSeriesDialog();
}
