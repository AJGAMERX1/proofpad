from pathlib import Path

ROOT=Path(__file__).resolve().parent

def install_series_style(source):
    def change(old,new):
        nonlocal source
        if source.count(old)!=1: raise ValueError('Series style installer expected one '+old[:85])
        source=source.replace(old,new,1)

    # Native modal inherits the same palette names in both themes.
    for old in ['main[data-mode="calculator"], #matrixDialog {',
                'html[data-theme="dark"] :is(main[data-mode="calculator"], #matrixDialog) {',
                ':is(main[data-mode="calculator"], #graphPanel) {']:
        if old.startswith(':is'):
            # Both palette declarations share this suffix.
            assert source.count(old)==2
            source=source.replace(old,old.replace('#graphPanel)', '#graphPanel, #seriesStyleDialog)'))
        else:
            replacement=old.replace('#matrixDialog {','#matrixDialog, #seriesStyleDialog {').replace('#matrixDialog)', '#matrixDialog, #seriesStyleDialog)')
            change(old,replacement)
    surface_editor=(ROOT/'surface-style-editor.html').read_text()
    change('<dialog id="matrixDialog"', f'''<dialog id="seriesStyleDialog" aria-labelledby="seriesStyleHeading">
 <h2 id="seriesStyleHeading">Plot style</h2>
{surface_editor}

 <fieldset><legend>Solid color</legend><div id="seriesHues"></div></fieldset>
 <details id="seriesMorePalettes" open><summary>More color palettes</summary><fieldset><legend>Gradient</legend><div id="seriesRamps"></div></fieldset></details>
 <fieldset id="seriesStrokeOptions"><legend>Line pattern</legend><div id="seriesStrokes"></div></fieldset>
 <div class="series-dialog-footer"><button type="button" id="seriesResetStyle">Use automatic style</button><button type="button" id="seriesStyleDone">Done</button></div>
</dialog>
<dialog id="matrixDialog"''')
    change('...(r.sliderConfig?{slider:r.sliderConfig}:{})','...(r.sliderConfig?{slider:r.sliderConfig}:{}),...(r.appearance?{appearance:r.appearance}:{}),...(r.plotHidden?{plotHidden:true}:{})')
    change("format='plain',slider=null,refreshList=true){", "format='plain',slider=null,refreshList=true,appearance=null,plotHidden=false){")
    change(" const num=document.createElement('span');num.className='number';", " row.plotHidden=plotHidden===true;\n const savedAppearance=normalizeSeriesAppearance(appearance);if(savedAppearance)row.appearance=savedAppearance;\n const num=document.createElement('span');num.className='number';")
    change('entry.format, entry.slider, false);','entry.format, entry.slider, false, entry.appearance, entry.plotHidden);')
    change('function calculateNotebook(ComputeEngine,', (ROOT/'series-style.js').read_text()+'\n'+(ROOT/'surface-style-editor.js').read_text()+'\nfunction calculateNotebook(ComputeEngine,')
    change('</head>', '<style>\n'+(ROOT/'series-style.css').read_text()+'</style>\n</head>')
    return source
