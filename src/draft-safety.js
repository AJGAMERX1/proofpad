// Each commit has its own storage key. Replacing a revision deletes only that
// precise parent, so simultaneous writes from separate tabs survive as siblings.
const workspaceModes=['proofs','formulas','calculator','surface'];
const draftPrefix='proofpad-draft-v4:';
const draftLocations=new Map();
const dirtyWorkspaces=new Set();
let openingStoredDraft=false,lastModeWritten='',storageError='';
const workspaceLabels={proofs:'Proof',formulas:'Formulas',calculator:'Calculator',surface:'3D graph'};
function keyPrefix(mode){return draftPrefix+mode+':';}
function listDraftHeads(mode){
 const prefix=keyPrefix(mode),all=[],parents=new Set();
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);
  if(!key?.startsWith(prefix))continue;
  const [id,parent]=key.slice(prefix.length).split('~');
  all.push({key,id});if(parent)parents.add(parent);
 }
 return all.filter(item=>!parents.has(item.id)).sort((a,b)=>b.id.localeCompare(a.id));
}
function setSaveState(message,error=false){
 const state=$('#saveState');state.textContent=message;state.classList.toggle('save-error',error);
}
function storageFailure(){
 storageError='Could not save on this device. Use Save draft.';
 setSaveState(storageError,true);
}
function updateDraftNotice(heads){
 if(!draftsLoaded||openingStoredDraft)return;
 try{
  heads=heads||listDraftHeads(workspaceMode);
  const location=draftLocations.get(workspaceMode);
  const newer=heads.length>0 && !heads.some(item=>item.key===location?.key);
  $('#storedCopies').hidden=heads.length<2&&!newer;
  if(storageError || dirtyWorkspaces.has(workspaceMode)){setSaveState(storageError || 'Could not save on this device. Use Save draft.',true);return;}
  if(newer)setSaveState('Updated in another tab · see saved copies');
  else if(heads.length>1)setSaveState('Saved on this device · copies available');
  else setSaveState('Saved on this device');
 }catch{storageFailure();}
}
function loadHead(mode,choice){
 let heads=listDraftHeads(mode);
 for(let attempt=0;attempt<2;attempt++){
  const entry=choice?heads.find(head=>head.key===choice):heads[0];
  if(!entry)return null;
  const json=localStorage.getItem(entry.key);
  if(json!==null){
   const draft=JSON.parse(json);
   if(!draft||!Array.isArray(draft.entries))throw Error('Invalid stored draft');
   return {...entry,json,draft};
  }
  heads=listDraftHeads(mode);
 }
 return null;
}
function latestWorkspaceDraft(mode,choice=null){
 if(dirtyWorkspaces.has(mode)&&!choice)return drafts[mode];
 try{
  const loaded=loadHead(mode,choice);
  if(loaded){
   draftLocations.set(mode,{key:loaded.key,id:loaded.id,json:loaded.json});
   return drafts[mode]=loaded.draft;
  }
 }catch{storageFailure();}
 return drafts[mode]||null;
}
function writeWorkspaceDraft(mode,draft,force=false){
 const json=JSON.stringify(draft),base=draftLocations.get(mode);
 drafts[mode]=draft;
 if(!force && base?.json===json && !dirtyWorkspaces.has(mode))return true;
 try{
  // A timestamp newer than the parent keeps sequential edits correctly
  // ordered even when the system clock is changed or several inputs coincide.
  const now=Math.max(Date.now(),(parseInt((base?.id||'0').split('.')[0],36)||0)+1);
  const rand=Array.from(crypto.getRandomValues(new Uint32Array(3)),n=>n.toString(36)).join('.');
  const id=now.toString(36).padStart(10,'0')+'.'+rand;
  const key=keyPrefix(mode)+id+'~'+(base?.id||'');
  localStorage.setItem(key,json);
  draftLocations.set(mode,{key,id,json});dirtyWorkspaces.delete(mode);storageError='';
  if(base?.key)localStorage.removeItem(base.key);
  if(mode===workspaceMode)updateDraftNotice();
  return true;
 }catch{
  dirtyWorkspaces.add(mode);storageFailure();return false;
 }
}
function persist(){
 if(restoring||!draftsLoaded||openingStoredDraft)return;
 writeWorkspaceDraft(workspaceMode,snapshotDraft());
}
function openStoredWorkspace(mode,choice=null){
 const draft=latestWorkspaceDraft(mode,choice)||(mode==='surface'?{...blankDraft(mode),entries:initialSurfaceEntries()}:blankDraft(mode));
 openingStoredDraft=true;
 try{applyDraft(mode,draft);}finally{openingStoredDraft=false;}
 drafts[mode]=snapshotDraft();
 if(!dirtyWorkspaces.has(mode)){
  const previous=draftLocations.get(mode)||{};
  draftLocations.set(mode,{...previous,json:JSON.stringify(drafts[mode])});
 }
 if(lastModeWritten!==mode){
  try{
   sessionStorage.setItem('proofpad-active-workspace',mode);
   localStorage.setItem('proofpad-last-workspace',mode);lastModeWritten=mode;
  }catch{storageFailure();}
 }
 updateDraftNotice();
}
function startNewAssignment(mode,next){
 if(mode!==workspaceMode)switchWorkspace(mode);
 beforeEdit();const current=snapshotDraft();
 const occupied=current.title?.trim()||current.statement?.trim()||current.entries.some(e=>hasContent(e.value));
 if(occupied){
  if(!writeWorkspaceDraft(mode,current,!draftLocations.get(mode)?.key)){
   status('Use Save draft to keep your current assignment before starting another.',true);return false;
  }
  // Leave the old assignment as another available head in Saved copies.
  draftLocations.delete(mode);
 }
 applyDraft(mode,next);commitHistory();schedule();return true;
}
function readSavedMode(fallback){
 try{
  const mode=sessionStorage.getItem('proofpad-active-workspace')||localStorage.getItem('proofpad-last-workspace');
  if(workspaceModes.includes(mode))return mode;
 }catch{storageFailure();}
 return workspaceModes.includes(fallback)?fallback:'proofs';
}
function loadWorkspaceDrafts(){
 let legacy,oldMode='proofs';
 try{
  const saved=JSON.parse(localStorage.getItem('proofpad-workspaces-v3'));
  if(saved?.drafts&&typeof saved.drafts==='object'){
   drafts=saved.drafts;oldMode=saved.activeMode;
  }else{
   legacy=JSON.parse(localStorage.getItem('formula-note-v2'));
   if(!legacy){const v1=JSON.parse(localStorage.getItem('formula-note-v1'));if(v1?.values)legacy={...v1,entries:v1.values.map(value=>({type:'math',value}))};}
   if(Array.isArray(legacy?.entries)){
    oldMode=legacy.qed||legacy.entries.some(e=>e.type==='text')?'proofs':'formulas';drafts[oldMode]=legacy;
   }
  }
 }catch{storageFailure();}
 openStoredWorkspace(readSavedMode(oldMode));
}
function showStoredCopies(){
 const box=$('#copyList');box.replaceChildren();
 try{
  for(const head of listDraftHeads(workspaceMode)){
   const raw=localStorage.getItem(head.key);if(!raw)continue;
   const draft=JSON.parse(raw);
   const row=document.createElement('li'),description=document.createElement('div');
   const title=document.createElement('strong');title.textContent=draft.title||'Untitled '+workspaceLabels[workspaceMode].toLowerCase();
   const info=document.createElement('small');
   const changed=new Date(parseInt(head.id.split('.')[0],36)).toLocaleString();
   info.textContent=changed+' · '+draft.entries.filter(e=>hasContent(e.value)).length+' blocks';
   description.append(title,info);row.append(description);
   const open=document.createElement('button');open.type='button';open.className='copy';
   const isCurrent=head.key===draftLocations.get(workspaceMode)?.key;
   open.textContent=isCurrent?'Current':'Open';open.disabled=isCurrent;
   open.onclick=()=>{
    const mode=workspaceMode;
    if(!writeWorkspaceDraft(mode,snapshotDraft()))return;
    if(!localStorage.getItem(head.key)){showStoredCopies();return;}
    beforeEdit();openStoredWorkspace(mode,head.key);
    // An explicitly opened copy becomes the one reopened next time.
    writeWorkspaceDraft(mode,snapshotDraft(),true);
    commitHistory();$('#copiesDialog').close();active?.focus();
   };
   const download=document.createElement('button');download.type='button';download.className='quiet';download.textContent='Download';
   download.onclick=()=>saveDownload(new Blob([JSON.stringify({app:'proofpad',version:1,workspace:workspaceMode,draft},null,2)],{type:'application/json'}),'proofpad-'+workspaceMode+'.proofpad.json');
   row.append(open,download);box.append(row);
  }
 }catch{storageFailure();}
 if(!box.children.length){const li=document.createElement('li');li.textContent='No other saved copies.';box.append(li);}
 if(!$('#copiesDialog').open)$('#copiesDialog').showModal();
}
$('#storedCopies').onclick=showStoredCopies;
$('#closeCopies').onclick=()=>$('#copiesDialog').close();
let draftNoticeTimer=0;
window.addEventListener('storage',event=>{
 if(event.key!==null && !event.key.startsWith(keyPrefix(workspaceMode)))return;
 clearTimeout(draftNoticeTimer);
 draftNoticeTimer=setTimeout(()=>{updateDraftNotice();if($('#copiesDialog').open)showStoredCopies();},30);
});
