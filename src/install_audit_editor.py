"""Keep paragraph math local, preserve authored examples, and expose overflowing equations."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def install_audit_editor(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Editor audit hook: ' + old[:100])
        source = source.replace(old, new, 1)

    change('const scriptReturns=new WeakMap();', 'const scriptReturns=new WeakMap();\n' + (ROOT/'audit-editor.js').read_text())
    change("r.querySelector('math-field,textarea').value,format:", "savedFieldValue(r.querySelector('math-field,textarea')),format:")
    change("type==='text'?explanationSource(value,format):value;", "type==='text'?paragraphLatex(explanationSource(value,format)):value;")
    change("$('#latex').value=active?.value||''", "$('#latex').value=active?savedFieldValue(active):''")
    change('value=field.getValue(field.selection)||field.value;', 'value=savedFieldValue(field,field.getValue(field.selection)||field.value);')
    source = source.replace("$('#latex').value=field.value", "$('#latex').value=savedFieldValue(field)").replace("$('#latex').value=f.value", "$('#latex').value=savedFieldValue(f)")
    change("  field.addEventListener('keydown',e=>{\n   if(e.key==='/'", """  if(type==='text'){
   field.addEventListener('pointerdown',()=>erasedProse.delete(field));
   field.addEventListener('beforeinput',event=>{
    if(event.inputType==='deleteContentBackward'||event.inputType==='deleteContentForward')prepareParagraphInput(field,'Backspace');
    if(event.inputType==='insertText'&&typeof event.data==='string'&&event.data.length===1)prepareParagraphInput(field,event.data);
   },true);
  }
  field.addEventListener('keydown',e=>{
   if(type==='text'&&!e.ctrlKey&&!e.metaKey&&!e.altKey)prepareParagraphInput(field,e.key);
   if(e.key==='/'""")
    change("if(type==='text'&&e.key==='_'&&field.mode", "if(type==='text'&&(e.key==='_'||e.key==='^')&&field.mode")
    change("choose(field);command('moveToSubscript');return}", "choose(field);command(e.key==='_'?'moveToSubscript':'moveToSuperscript');return}")
    change("$('#textMode').onclick=()=>{const f=ensureMath();", "$('#textMode').onclick=()=>{const f=ensureMath();scriptReturns.delete(f);erasedProse.delete(f);")
    change("f.executeCommand(cmd);if(cmd==='deleteBackward')resetEmptyExplanation(f);if(fromText&&['moveToSubscript','moveToSuperscript'].includes(cmd))scriptReturns.set(f,{depth:f.getElementInfo(f.position)?.depth??0,typed:false});",
           "if(fromText&&['moveToSubscript','moveToSuperscript'].includes(cmd))startParagraphScript(f,cmd);else f.executeCommand(cmd);if(cmd==='deleteBackward')resetEmptyExplanation(f);")
    change("   field.executeCommand(event.data.command);", """   const command=event.data.command;
   if(field.classList.contains('explanation-field')&&Array.isArray(command)&&command[0]==='typedText'){
    prepareParagraphInput(field,command[1]);
    if(field.mode==='text'&&['_','^'].includes(command[1])){
     startParagraphScript(field,command[1]==='_'?'moveToSubscript':'moveToSuperscript');return;
    }
   }
   field.executeCommand(command);""")
    change(" const f=ensureMath(),prose=f.mode==='text'&&f.closest('.row').dataset.type==='text';", r""" const f=ensureMath(),paragraph=f.classList.contains('explanation-field');
 if(paragraph && latex===String.raw`\;`){
  prepareParagraphInput(f,' ');
  if(f.mode==='text'){
   f.insert(textLatex(' '),{format:'latex',mode:'math',selectionMode:'after'});
   f.executeCommand(['switchMode','text']);choose(f);schedule();return;
  }
 }
 const prose=paragraph && f.mode==='text';""")
    change('function renumber() {', 'function renumber() {\n scheduleEquationScrollHints();')
    change('</head>', '''<style>
.row[data-type="math"] math-field::part(content){overflow-x:auto;scrollbar-width:thin}
.equation-scroll-hint{display:block;font:11px/1.35 system-ui,sans-serif;color:var(--muted);margin:3px 0}
.equation-scroll-hint[hidden]{display:none}
</style></head>''')
    old = next(line for line in source.splitlines() if line.startswith("document.querySelectorAll('[data-example]').forEach(b=>b.onclick="))
    change(old, "document.querySelectorAll('[data-example]').forEach(button=>button.onclick=()=>insertNotebookExample(examples[button.dataset.example]));")
    return source
