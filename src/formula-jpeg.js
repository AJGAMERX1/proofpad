// Keep the typeset vector sheet for the current revision so JPEG resolution is
// independent of the preview canvas and the user's PNG resolution setting.
let jpegSheet=null;
let jpegJob=null;
function setJpegSheet(sheet){
 jpegSheet=sheet;
 $('#jpegDownload').disabled=!sheet||!!jpegJob;
}
function jpegRasterSize(width,height,scale){
 const factor=Math.min(scale,16000/width,16000/height,Math.sqrt(16000000/(width*height)));
 return {width:Math.max(1,Math.floor(width*factor)),height:Math.max(1,Math.floor(height*factor))};
}
$('#jpegDownload').onclick=async()=>{
 const sheet=jpegSheet;
 if(!sheet||jpegJob||revision!==sheet.revision||isCalculatorMode())return;
 const compact=$('#jpegQuality').value==='compact';
 const {width,height}=jpegRasterSize(sheet.width,sheet.height,compact?1:4);
 const svg=sheet.root.cloneNode(true);
 svg.setAttribute('width',width);svg.setAttribute('height',height);
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
 const job={};jpegJob=job;$('#jpegDownload').disabled=true;
 const current=()=>jpegSheet===sheet&&revision===sheet.revision&&!isCalculatorMode();
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Could not prepare this JPEG.'));img.src=url});
  if(!current())return;
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Could not prepare this JPEG. Try Compact JPEG.');
  ctx.fillStyle=sheet.paper;
  ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',compact?.75:.96));
  canvas.width=canvas.height=1;
  if(!current())return;
  if(!blob||blob.type!=='image/jpeg')throw Error('This browser could not encode the JPEG. Try Compact JPEG or Download PNG.');
  saveDownload(blob,compact?'proofpad-compact.jpg':'proofpad-sharp.jpg');
  status((compact?'Compact':'Sharp')+' JPEG downloaded · '+width.toLocaleString()+' × '+height.toLocaleString()+' px.');
 }catch(error){if(current())status(error.message||'Could not export the JPEG.',true)}
 finally{
  URL.revokeObjectURL(url);
  if(jpegJob===job)jpegJob=null;
  $('#jpegDownload').disabled=!jpegSheet||jpegSheet.revision!==revision||isCalculatorMode();
 }
};
