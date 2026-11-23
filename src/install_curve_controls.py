"""Attach per-expression curve intervals and their controls to the existing row lifecycle."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def install_curve_controls(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Curve controls hook: ' + old[:90])
        source = source.replace(old, new, 1)

    change('</head>', '<style>\n' + (ROOT/'curve-controls.css').read_text() + '</style></head>')
    change('const traceBox=', (ROOT/'curve-controls.js').read_text() + '\nconst traceBox=')
    change('...(r.plotHidden?{plotHidden:true}:{})', '...(r.plotHidden?{plotHidden:true}:{}),...(r.curveRange?{curveRange:r.curveRange}:{})')
    change('appearance=null,plotHidden=false){', 'appearance=null,plotHidden=false,curveRange=null){')
    change(' row.plotHidden=plotHidden===true;', ''' row.plotHidden=plotHidden===true;
 if(inSurface() && validSavedCurveRange(curveRange))row.curveRange={min:curveRange.min,max:curveRange.max};''')
    change('entry.appearance, entry.plotHidden);', 'entry.appearance, entry.plotHidden, entry.curveRange);')
    change(' graphSeries=specs;', ''' graphSeries=specs;
 graphPanel.dataset.curves=String(inSurface() && specs.some(s=>s.kind==='curve'));
 list.forEach((row,index)=>syncCurveRangeControls(row,inSurface() && results[index]?.graph?.kind==='curve'));
 if(isCalculatorMode() && traceWorkspace!==workspaceMode)updateGraphTrace();''')
    change("const label=data.plotOnly?'Plotted':", "const label=data.plotOnly?(data.graph?.kind==='curve' && !graphCurveRange({row})?'Check t range':'Plotted'):")
    change(' const focused = document.activeElement;\n if (', ''' const focused = document.activeElement;
 if(focused?.dataset.curveBound)return {row:rows().indexOf(focused.closest('.row')),curveBound:focused.dataset.curveBound,start:focused.selectionStart,end:focused.selectionEnd};
 if (''')
    change('function restoreHistoryCursor(cursor) {\n if (!cursor) return;', '''function restoreHistoryCursor(cursor) {
 if (!cursor) return;
 if(cursor.curveBound && inSurface()){
  const row=rows()[cursor.row];if(!row)return;
  syncCurveRangeControls(row,true);
  const input=row.querySelector('[data-curve-bound="'+cursor.curveBound+'"]');
  if(input){input.focus({preventScroll:true});input.setSelectionRange(cursor.start,cursor.end);}
  return;
 }''')
    change(" for(const key of ['title','statement'])if(draft[key]", """ if (draft.entries.some(e=>e.curveRange!=null && !validSavedCurveRange(e.curveRange)))throw new Error('The draft contains an invalid curve range.');
 for(const key of ['title','statement'])if(draft[key]""")
    return source
