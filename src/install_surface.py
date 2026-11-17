"""Wire the dedicated surface notebook into Proofpad’s existing calculator/draft lifecycle."""
from pathlib import Path
import re

root=Path(__file__).resolve().parent
def install_surface(source):
    def change(old,new):
        nonlocal source
        if source.count(old)!=1:
            raise ValueError('Unexpected source: '+old[:100])
        source=source.replace(old,new,1)
    def fragment(name):
        return (root/name).read_text().strip()+'\n'
    # Both calculators share editor/worker machinery and CSS, while storage,
    # undo, selection and restoration distinguish the workspaces by mode.
    source=re.sub(r"workspaceMode\s*(===|!==)\s*'calculator'",
                  lambda m:('!' if m[1]=='!==' else '')+'isCalculatorMode()',source)
    change("$('#proofSetup').hidden=!proof;", "$('main').dataset.workspace=workspaceMode;$('#proofSetup').hidden=!proof;")
    change("$('main').dataset.mode=workspaceMode;", "$('main').dataset.mode=calculator?'calculator':workspaceMode;")
    source=source.replace("document.querySelectorAll('[data-mode]')","document.querySelectorAll('button[data-mode]')")
    change('<button class="mode-tab" data-mode="calculator"', '<button class="mode-tab" id="graph2D" data-mode="calculator"')
    change('<b>Calculator</b><small>Plot &amp; calculate</small></button>',
           '<b>Calculator</b><small>2D graphs &amp; values</small></button><button class="mode-tab" id="graph3D" data-mode="surface" aria-label="3D Graph workspace" aria-pressed="false"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10L3 7m9 5 9-5m-9 5v10"/></svg></span><b>3D Graph</b><small>Surfaces &amp; heat maps</small></button>')
    change("calculator?'Expressions'", "inSurface()?'Surface expressions':calculator?'Expressions'")
    change("calculator?'CALCULATOR · GRAPH & EVALUATE'", "inSurface()?'3D GRAPH · SURFACE EXPLORER':calculator?'CALCULATOR · GRAPH & EVALUATE'")
    change("function applyDraft(mode,data){\n restoring=true;", "function applyDraft(mode,data){\n const previousMode=workspaceMode;restoring=true;")
    change(' updateModeUI();savePrintSettings();replaceEntries', ' applyGraphWorkspace(previousMode,data);updateModeUI();savePrintSettings();replaceEntries')
    change("applyDraft(mode,drafts[mode]||blankDraft(mode));startHistory();", "applyDraft(mode,drafts[mode]||(mode==='surface'?{...blankDraft(mode),entries:initialSurfaceEntries()}:blankDraft(mode)));startHistory();")
    change("function snapshotDraft(){return {entries:entries(),", "function snapshotDraft(){return {...(inSurface()?{surfaceView:surfaceDraftSettings()}:{}),entries:entries(),")
    change("return {draft, key:JSON.stringify(draft), cursor:historyCursor()};","const {surfaceView:camera,...content}=draft;\n return {draft,key:JSON.stringify(content),cursor:historyCursor()};")
    change("['proofs','formulas','calculator'].includes(file.workspace)", "['proofs','formulas','calculator','surface'].includes(file.workspace)")
    change("['formulas','calculator'].includes(saved.activeMode)", "['formulas','calculator','surface'].includes(saved.activeMode)")
    change("function saveCalculatorPreferences(){try{", "function saveCalculatorPreferences(){if(inSurface()){persist();scheduleCalculator();return}try{")
    change("function calculateNotebook(ComputeEngine,values,angle='rad',digits=10,compileGraphs=null){",
           fragment('surface-render.js')+fragment('surface-ui.js')+"\nfunction calculateNotebook(ComputeEngine,values,angle='rad',digits=10,compileGraphs=null,dimension='2d'){")
    change("data.digits,compileGraphRows)", "data.digits,compileGraphRows,data.dimension)")
    change("calculatorPending={id,values:", "calculatorPending={id,dimension:inSurface()?'3d':'2d',values:")
    change("clearTimeout(timer);stopSliders();calculatorRevision++;", "clearTimeout(timer);clearTimeout(calculatorTimer);stopSliders();calculatorRevision++;")
    change("return result.error?{error:graph.error,graph}:result;", "return result.error || (dimension==='3d' && !result.symbol && !result.matrix)?{error:graph.error,graph}:result;")
    change("$('#workspaceTip').textContent=proof?", "$('#workspaceTip').textContent=inSurface()?'Define a parameter such as a=2 on its own line to get a slider. Use it in a surface such as z=a(x²−y²).':proof?")
    change('</head>','<style>\n'+fragment('surface.css')+'</style>\n</head>')
    return source
