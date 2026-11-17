const graphExportFormat=document.querySelector('#graphExportFormat');
const graphSaveButton=document.querySelector('#graphSave');

graphExportFormat.onchange=()=>{
 graphSaveButton.textContent=graphExportFormat.value==='png'?'Save graph PNG':'Save graph JPEG';
};

graphSaveButton.onclick=async()=>{
 const width=graphCanvas.clientWidth,height=graphCanvas.clientHeight;
 const status=document.querySelector('#graphStatus');
 if(!width||!height){status.textContent='Open the graph to save it.';return}
 const mode=workspaceMode,format=graphExportFormat.value,jpeg=format!=='png';
 const base=inSurface()?(surfaceView.heatmap?'proofpad-heat-map':'proofpad-3d-graph'):'proofpad-graph';
 const sharp=format==='jpeg-sharp',label=jpeg?(sharp?'Sharp JPEG':'Compact JPEG'):'PNG';
 const mime=jpeg?'image/jpeg':'image/png';
 const filename=base+(jpeg?(sharp?'-sharp.jpg':'-compact.jpg'):'.png');
 const target=jpeg?document.createElement('canvas'):graphCanvas;
 graphSaveButton.disabled=true;
 try{
  if(jpeg){
   // Draw the current viewport directly at the export resolution. Limit the
   // backing store for browsers with smaller canvas memory budgets.
   const scale=Math.min(sharp?4:1,8192/width,8192/height,Math.sqrt(15_500_000/(width*height)));
   paintGraph({canvas:target,pixelRatio:scale,fullDetail:true});
  }else paintGraph({fullDetail:true});
  const pixelSize=target.width+' × '+target.height;
  const quality=sharp ? 0.96 : 0.75;
  const blob=await new Promise(resolve=>target.toBlob(resolve,mime,jpeg ? quality : undefined));
  if(!blob||blob.type!==mime)throw new Error('Unsupported image format');
  saveDownload(blob,filename);
  if(workspaceMode===mode)status.textContent=label+' saved · '+pixelSize+' px';
 }catch{
  if(workspaceMode===mode)status.textContent='Could not save this graph as '+label+'. Try again.';
 }finally{
  if(jpeg){target.width=1;target.height=1}
  graphSaveButton.disabled=false;
 }
};
