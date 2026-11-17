"""Store edits for each workspace independently and recover concurrent versions."""
from pathlib import Path


def install_draft_safety(source):
    def change(before, after):
        nonlocal source
        if source.count(before) != 1:
            raise ValueError('Unexpected autosave hook: '+before[:100])
        source=source.replace(before,after,1)

    start=source.index('function persist(){')
    end=source.index('function blankDraft(mode)',start)
    source=source[:start]+Path(__file__).with_name('draft-safety.js').read_text()+'\n'+source[end:]
    change("applyDraft(mode,drafts[mode]||(mode==='surface'?{...blankDraft(mode),entries:initialSurfaceEntries()}:blankDraft(mode)));", "openStoredWorkspace(mode);")
    change("const draft=drafts.formulas||blankDraft('formulas');", "const draft=latestWorkspaceDraft('formulas')||blankDraft('formulas');")
    change("drafts.formulas=draft;persist();$('#calcStatus').textContent='Saved to your Formulas draft.';", "const ok=writeWorkspaceDraft('formulas',draft);$('#calcStatus').textContent=ok?'Saved to your Formulas draft.':'Formulas is in memory. Open Formulas and use Save draft.';")
    start=source.index("await customElements.whenDefined('math-field');let saved,legacy;")
    end=source.index('  startHistory();scheduleSpelling();',start)
    source=source[:start]+"await customElements.whenDefined('math-field');loadWorkspaceDrafts();\n\n"+source[end:]
    change('  draftsLoaded = true;\n  persist();','  draftsLoaded = true;\n  persist();updateDraftNotice();')
    change('id="saveDraft">Save draft</button>', 'id="saveDraft">Save draft</button><button class="copy" type="button" id="storedCopies" hidden>Saved copies</button>')
    change("$('#clear').onclick=()=>{stopSliders();", "$('#clear').onclick=()=>{if(workspaceMode==='proofs'){if(startNewAssignment('proofs',blankDraft('proofs')))active?.focus();return;}stopSliders();")
    change("$('#workspaceTitle').textContent=", "$('#clear').textContent=proof?'New proof':'Clear page';$('#workspaceTitle').textContent=")
    change('<main inert', '<dialog id="copiesDialog" aria-labelledby="copiesTitle"><h2 id="copiesTitle">Saved copies</h2><ul id="copyList"></ul><button type="button" class="copy" id="closeCopies">Close</button></dialog>\n<main inert')
    change('</head>','''<style>
#copiesDialog{max-width:min(36rem,94vw);border:1px solid var(--border);border-radius:12px;padding:1.3rem;background:var(--card,#fff);color:inherit}
html[data-theme=dark] #copiesDialog{background:#17263a;color:#e0e9f4}
#copiesDialog h2{margin:0 0 1rem}#copyList{padding:0;max-height:55vh;overflow:auto;list-style:none}#copyList li{display:flex;gap:.5rem;align-items:center;padding:.65rem 0;border-bottom:1px solid var(--border)}#copyList li>div{flex:1;min-width:0;overflow-wrap:anywhere}#copyList small{display:block}#storedCopies[hidden]{display:none}
</style></head>''')
    return source
