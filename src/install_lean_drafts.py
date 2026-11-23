"""Include the formal source in the existing proof draft and undo lifecycle."""


def install_lean_drafts(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Missing or ambiguous Lean draft hook: ' + old[:90])
        source = source.replace(old, new, 1)

    change('function snapshotDraft(){return {', """function snapshotDraft(){
 const leanSource=workspaceMode==='proofs' ? $('#leanSource').value : '';
 return {...(leanSource ? {leanSource} : {}),""")
    change(" $('#title').value=typeof d.title", """ restoreLeanSource(mode==='proofs' && typeof d.leanSource==='string' ? d.leanSource : '');
 $('#title').value=typeof d.title""")
    change('const occupied=current.title?.trim()', 'const occupied=current.leanSource?.trim()||current.title?.trim()')
    change('const occupied=!isNew&&(draft.entries.some', 'const occupied=!isNew&&(draft.leanSource?.trim()||draft.entries.some')
    change("['title', 'statement', 'latex'].includes(focused?.id)",
           "['title', 'statement', 'latex', 'leanSource'].includes(focused?.id)")
    change('function restoreHistoryCursor(cursor) {\n if (!cursor) return;', """function restoreHistoryCursor(cursor) {
 if (!cursor) return;
 if (cursor.id==='leanSource') {
  $('#leanPanel').open=true;
  const editor=$('#leanSource');
  editor.focus();
  editor.setSelectionRange(cursor.start,cursor.end);
  return;
 }""")
    change('function validateDraftFile(file) {', """const maxLeanSourceLength=100000;
const leanDraftEditor=$('#leanSource');
leanDraftEditor.maxLength=maxLeanSourceLength;
function validateLeanSource(source) {
 if (typeof source!=='string') throw new Error('Lean source must be text.');
 if (source.length>maxLeanSourceLength) throw new Error('Lean source exceeds the 100,000 character limit.');
}
function replaceLeanSource(source) {
 validateLeanSource(source);
 if (workspaceMode!=='proofs') return;
 beforeEdit();
 restoreLeanSource(source);
 commitHistory();
 persist();
}
leanDraftEditor.addEventListener('beforeinput',event=>{
 if(!event.defaultPrevented) beforeEdit(leanDraftEditor);
});
leanDraftEditor.addEventListener('input',()=>{
 queueHistory();
 persist();
});
function validateDraftFile(file) {""")
    change(" return {workspace:file.workspace,draft};",
           " if (Object.hasOwn(draft,'leanSource')) validateLeanSource(draft.leanSource);\n return {workspace:file.workspace,draft};")
    return source
