// This editor changes the same per-row appearance used by drafts and exports.
const surfaceLookPresets = [
 {id:'sea-glass',name:'Sea glass',ramp:'coast',finish:'gloss',grid:'off'},
 {id:'peach-silk',name:'Peach silk',ramp:'peach',finish:'soft',grid:'off'},
 {id:'lilac',name:'Lilac',ramp:'lilac',finish:'gloss',grid:'fine'},
 {id:'citrus',name:'Citrus',ramp:'citrus',finish:'flat',grid:'fine'},
 {id:'dusk',name:'Dusk',ramp:'dusk',finish:'soft',grid:'off'},
 {id:'blueprint',name:'Blueprint',ramp:'glacier',finish:'wire',grid:'fine'}
];
const surfaceLookStorageKey='proofpad-surface-looks-v1';
let personalSurfaceLooks=[];
let surfacePreviewFrame=0;

function readSurfaceLooks() {
 try {
  const stored=JSON.parse(localStorage.getItem(surfaceLookStorageKey));
  if(!Array.isArray(stored))return [];
  return stored.slice(0,12).filter(item=>
   item && typeof item.name==='string' && item.name.trim() && normalizeSeriesAppearance(item.appearance)
  ).map(item=>({name:item.name.trim().slice(0,28),appearance:normalizeSeriesAppearance(item.appearance)}));
 } catch { return []; }
}
personalSurfaceLooks=readSurfaceLooks();

function resolvedSurfaceAppearance(look) {
 return normalizeSeriesAppearance({
  mode:look.mode,hue:look.hue,ramp:look.rampKey,
  colors:styleTarget?.appearance?.colors,
  finish:look.finish,grid:look.grid,opacity:look.opacity,reverse:look.reverse
 });
}

function scheduleSurfaceStylePreview() {
 if(surfacePreviewFrame || !seriesStyleDialog.open || !inSurface())return;
 // redrawGraph is already queued by the style change, so copy the completed frame.
 surfacePreviewFrame=requestAnimationFrame(()=>{
  surfacePreviewFrame=0;
  if(!seriesStyleDialog.open || !inSurface())return;
  const canvas=$('#surfaceStylePreview');
  const context=canvas.getContext('2d');
  const background=getComputedStyle(graphPanel).getPropertyValue('--graph-paper').trim();
  context.fillStyle=background;
  context.fillRect(0,0,canvas.width,canvas.height);
  if(!graphCanvas.width||!graphCanvas.height)return;
  const scale=Math.min(canvas.width/graphCanvas.width,canvas.height/graphCanvas.height);
  const width=graphCanvas.width*scale,height=graphCanvas.height*scale;
  context.drawImage(graphCanvas,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
 });
}

function syncSurfaceStyleEditor(target,look) {
 const surface=target.series.kind==='surface';
 seriesStyleDialog.classList.toggle('surface-style-dialog',surface);
 $('#surfaceStyleEditor').hidden=!surface;
 $('#seriesHues').closest('fieldset').hidden=surface;
 $('#seriesRamps').closest('fieldset').classList.toggle('extra-surface-colors',surface);
 if(!surface)return;
 const select=$('#surfaceStyleTarget');
 const surfaces=graphSeries.filter(series=>series.kind==='surface');
 const signature=surfaces.map(series=>series.line).join(',');
 if(select.dataset.lines!==signature) {
  select.replaceChildren(...surfaces.map(series=>new Option(graphSeriesLabel(series.kind,series.line),series.line)));
  select.dataset.lines=signature;
 }
 select.value=target.series.line;
 $('#separateSurfaceColors').disabled=surfaces.length<2;
 const colors=target.series.row.appearance?.colors;
 const source=look.ramp;
 const samples=[source[0],source[Math.floor(source.length/2)],source.at(-1)];
 ['Low','Middle','High'].forEach((part,index)=>{$('#surfaceColor'+part).value=samples[index]});
 $('#surfaceGrid').value=look.grid;
 $('#surfaceGrid').querySelector('option[value="off"]').disabled=look.finish==='wire';
 $('#surfaceOpacity').value=Math.round((1-look.opacity)*100);
 $('#surfaceOpacityValue').textContent=look.opacity===1?'Solid':Math.round((1-look.opacity)*100)+'%';
 $('#surfaceReverse').setAttribute('aria-pressed',String(look.reverse));
 document.querySelectorAll('[data-finish]').forEach(button=>
  button.setAttribute('aria-pressed',String(button.dataset.finish===look.finish))
 );
 document.querySelectorAll('[data-surface-look]').forEach(button=>{
  const preset=surfaceLookPresets.find(item=>item.id===button.dataset.surfaceLook);
  const matches=!colors && look.mode==='gradient' && preset.ramp===look.rampKey &&
   preset.finish===look.finish && preset.grid===look.grid && look.opacity===1 && !look.reverse;
  button.setAttribute('aria-pressed',String(matches));
 });
 scheduleSurfaceStylePreview();
}

function renderSavedSurfaceLooks() {
 $('#savedSurfaceLooks').hidden=!personalSurfaceLooks.length;
 const list=$('#surfaceSavedList');
 list.replaceChildren();
 for(const [index,item] of personalSurfaceLooks.entries()) {
  const wrapper=document.createElement('div');
  const button=document.createElement('button');
  button.type='button';button.textContent=item.name;
  button.onclick=()=>setSeriesAppearance({...item.appearance,colors:item.appearance.colors||null});
  const remove=document.createElement('button');
  remove.type='button';remove.textContent='×';
  remove.setAttribute('aria-label','Remove '+item.name+' from saved looks');
  remove.onclick=()=>{
   const next=personalSurfaceLooks.filter((_,position)=>position!==index);
   try {
    localStorage.setItem(surfaceLookStorageKey,JSON.stringify(next));
    personalSurfaceLooks=next;renderSavedSurfaceLooks();
   } catch { $('#surfaceStyleMessage').textContent='Could not remove this saved look.'; }
  };
  wrapper.append(button,remove);list.append(wrapper);
 }
}

function renderSurfaceLookThumbnails() {
 const style=getComputedStyle(graphPanel);
 const palette={};
 for(const key of ['paper','grid','axis','label'])palette[key]=style.getPropertyValue('--graph-'+key).trim();
 for(const preset of surfaceLookPresets) {
  const canvas=$('[data-surface-look="'+preset.id+'"] canvas');
  const ramp=surfaceRamps[preset.ramp];
  const series={...preset,color:ramp[2],ramp,run:(x,y)=>1.3*Math.cos(Math.hypot(x,y))};
  const view={...surfaceHome,span:8,mesh:true};
  const context=canvas.getContext('2d');
  context.save();
  context.translate(canvas.width/2,canvas.height/2);
  context.scale(1.7,1.7);
  context.translate(-canvas.width/2,-canvas.height/2);
  const thumbnailPalette={...palette,axis:palette.paper,label:palette.paper,grid:palette.paper};
  paintSurfacePlot(context,canvas.width,canvas.height,[series],view,thumbnailPalette,'slider');
  context.restore();
 }
}

for(const preset of surfaceLookPresets) {
 const button=document.createElement('button');
 button.type='button';button.dataset.surfaceLook=preset.id;
 const canvas=document.createElement('canvas');canvas.width=180;canvas.height=115;
 canvas.setAttribute('aria-hidden','true');
 const label=document.createElement('span');label.textContent=preset.name;
 button.append(canvas,label);
 button.onclick=()=>setSeriesAppearance({
  mode:'gradient',ramp:preset.ramp,colors:null,reverse:false,
  finish:preset.finish,grid:preset.grid,opacity:1
 });
 $('#surfaceLooks').append(button);
}
$('#surfaceStyles').onclick=()=>{
 const series=graphSeries.find(item=>item.row.contains(active))||graphSeries.find(item=>!item.row.plotHidden)||graphSeries[0];
 if(series)openSeriesStyle(series);
};
$('#surfaceStyleTarget').onchange=event=>{
 const series=graphSeries.find(item=>item.line===event.target.value);
 if(series){styleTarget=series.row;syncSeriesDialog();}
};
$('#separateSurfaceColors').onclick=()=>{
 beforeEdit();
 const first=['coast','peach','lilac','citrus','dusk','mint'];
 const palettes=[...first,...seriesRampOrder.filter(key=>!first.includes(key))];
 graphSeries.filter(series=>series.kind==='surface').forEach((series,index)=>{
  series.row.appearance=normalizeSeriesAppearance({
   ...series.row.appearance,mode:'gradient',colors:null,reverse:false,
   ramp:palettes[index%palettes.length]
  });
 });
 commitHistory();persist();onSeriesStyleChanged();
};
for(const part of ['Low','Middle','High']) {
 $('#surfaceColor'+part).oninput=()=>setSeriesAppearance({
  mode:'gradient',reverse:false,colors:['Low','Middle','High'].map(name=>$('#surfaceColor'+name).value)
 });
}
$('#surfaceReverse').onclick=()=>{
 const target=selectedSeriesStyle();
 if(target)setSeriesAppearance({reverse:!target.series.row.appearance?.reverse});
};
document.querySelectorAll('[data-finish]').forEach(button=>{
 button.onclick=()=>{
  const partial={finish:button.dataset.finish};
  if(partial.finish==='wire' && styleTarget?.appearance?.grid==='off')partial.grid='fine';
  setSeriesAppearance(partial);
 };
});
$('#surfaceGrid').onchange=event=>setSeriesAppearance({grid:event.target.value});
$('#surfaceOpacity').oninput=event=>setSeriesAppearance({opacity:1-Number(event.target.value)/100});
$('#saveSurfaceLook').onclick=()=>{
 const name=$('#surfaceLookName').value.trim(),target=selectedSeriesStyle();
 if(!name){$('#surfaceStyleMessage').textContent='Give your look a name first.';$('#surfaceLookName').focus();return;}
 if(!target)return;
 const look=seriesAppearance(target.series,target.index,getComputedStyle(graphPanel),true);
 const next=personalSurfaceLooks.filter(item=>item.name.toLowerCase()!==name.toLowerCase());
 if(next.length>=12){$('#surfaceStyleMessage').textContent='You have 12 saved looks. Remove one to make room.';return;}
 next.push({name,appearance:resolvedSurfaceAppearance(look)});
 try {
  localStorage.setItem(surfaceLookStorageKey,JSON.stringify(next));
  personalSurfaceLooks=next;renderSavedSurfaceLooks();
  $('#surfaceStyleMessage').textContent='Saved '+name+'.';
 } catch { $('#surfaceStyleMessage').textContent='This browser could not save the look. Its colors are still part of your draft.'; }
};
renderSavedSurfaceLooks();
