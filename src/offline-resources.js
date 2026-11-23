// Native gzip is asynchronous. The bundled decoder also works on older browsers.
function unpackWithFflate(bytes){
 const module={exports:{}};
 const exports=module.exports;
 /* STANDALONE_FFLATE_UMD */
 return module.exports.gunzipSync(bytes);
}
async function unpackProofpadResource(encoded,size){
 let packed;
 if(Uint8Array.fromBase64)packed=Uint8Array.fromBase64(encoded);
 else{
  const binary=atob(encoded);
  packed=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)packed[i]=binary.charCodeAt(i);
 }
 let content;
 if(typeof DecompressionStream==='function'){
  try{
   const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
   content=new Uint8Array(await new Response(stream).arrayBuffer());
  }catch{/* Older browser implementations can use the bundled decoder. */}
 }
 if(!content)content=unpackWithFflate(packed);
 if(content.length!==size)throw Error('The embedded resource is incomplete.');
 return content;
}
function packedProofpadResource(id){
 const node=document.getElementById(id);
 return {encoded:node.textContent,size:Number(node.dataset.size)};
}
async function offlineWordList(){
 const {encoded,size}=packedProofpadResource('spellingWords');
 return new TextDecoder().decode(await unpackProofpadResource(encoded,size));
}
// A single file:// worker must contain all of its code for Safari. Only the
// newest pending notebook is dispatched by its ordinary ready handshake.
let offlineEngineBytes=null,offlineEnginePending=null;
function offlineEngineReady(){
 if(offlineEngineBytes)return true;
 if(!offlineEnginePending){
  const {encoded,size}=packedProofpadResource('offlineEngine');
  offlineEnginePending=unpackProofpadResource(encoded,size).then(bytes=>{
   offlineEngineBytes=bytes;
   if(isCalculatorMode()&&calculatorPending)startCalculator();
  }).catch(()=>{
   if(isCalculatorMode())calculatorFailed('Could not open the embedded calculator. Use Retry.');
  }).finally(()=>{offlineEnginePending=null;});
 }
 return false;
}
