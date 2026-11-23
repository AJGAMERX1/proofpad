function refreshImportAction(){
 $('#texConfirm').textContent=$('#texAction').value==='new'?'Open document':'Append to draft';
}
$('#texAction').onchange=refreshImportAction;
$('#texConfirm').onclick=()=>{
 if(!importCandidate)return;
 const target=$('#texDestination').value;
 const isNew=$('#texAction').value==='new';
 const draft=isNew?blankDraft(target):target===workspaceMode?snapshotDraft():(latestWorkspaceDraft(target)||blankDraft(target));
 const occupied=!isNew&&(draft.entries.some(e=>hasContent(e.value))||draft.title?.trim()||draft.statement?.trim());
 const imported=importCandidate;
 const proofSetup=target==='proofs'&&!occupied?imported.proofSetup:null;
 let content=proofSetup?proofSetup.entries.slice():imported.entries.slice();
 if(occupied&&imported.title)content.unshift({type:'text',format:'math-latex',value:textLatex(imported.title)});
 if(occupied)content=[...draft.entries,...content];
 if(content.length>500){importInfo.textContent='This draft would exceed 500 blocks. Choose Open as new document or import a smaller document.';return}
 const next={...draft,...proofSetup,title:occupied?draft.title:imported.title,entries:content};
 try{
  if(isNew){
   if(startNewAssignment(target,next)===false){
    importInfo.textContent='Your current assignment could not be saved. Use Save draft before importing a new document.';
    return;
   }
  }
  else{
   if(workspaceMode!==target)switchWorkspace(target);
   beforeEdit();applyDraft(target,next);commitHistory();schedule();
  }
  importDialog.close();status((isNew?'Opened ':'Appended ')+(imported.title||'LaTeX document')+'.'+(imported.warning?' '+imported.warning:''));
 }catch(error){
  importInfo.textContent='Import could not finish. '+error.message;
 }
};
