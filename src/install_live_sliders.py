"""Connect the slider preview to worker, graph, history and draft lifecycles."""
from pathlib import Path


def install_live_sliders(source):
    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Unexpected slider integration point: ' + old[:100])
        source = source.replace(old, new, 1)

    change(' const specs=compileGraphs?.(graphNodes,angle,dimension,',
           ' const scalarPreviews=[];\n const specs=compileGraphs?.(graphNodes,angle,dimension,')
    change("entry.expr=ce.expr(expanded,{form:'raw'});\n });",
           "entry.expr=ce.expr(expanded,{form:'raw'});\n },(index,plan)=>{scalarPreviews[index]=plan;});")
    change('  const graph=specs[index];\n  if(!graph)return result;',
           '  if(scalarPreviews[index] && Number.isFinite(result.number))result.scalarPreview=scalarPreviews[index];\n'
           '  const graph=specs[index];\n  if(!graph)return result;')
    change(' graphSeries=specs;\n legend.replaceChildren', ' graphSeries=specs;\n prepareSliderLinks(results,list);\n legend.replaceChildren')
    change('function scheduleCalculator(){\n if(!isCalculatorMode())return;',
           'function scheduleCalculator(sliderOnly=false){\n if(!isCalculatorMode())return;\n'
           ' if(!sliderOnly){commitGraphSlider();sliderLinks.clear();}')
    change(" calculatorRows().forEach(row=>{row.calcResult=null;",
           " if(!sliderOnly)calculatorRows().forEach(row=>{row.hasScalarPreview=false;row.calcResult=null;")
    change("could not start the calculator.')}},100);", "could not start the calculator.')}},sliderOnly?0:100);")
    change("if(mode===workspaceMode)return;commitHistory();", "if(mode===workspaceMode)return;commitGraphSlider();commitHistory();")
    change("function travelHistory(direction) {\n commitHistory();", "function travelHistory(direction) {\n commitGraphSlider();commitHistory();")
    change("document.addEventListener('pointerdown', () => beforeEdit(), true);",
           "document.addEventListener('pointerdown', event => {if(!sliderEditOpen || !event.target.closest?.('.slider-track'))beforeEdit()}, true);")
    change('function sendCalculation(row){\n if(!row.calcResult?.latex)return;',
           'function sendCalculation(row){\n flushSliderFields();\n if(!row.calcResult?.latex)return;')
    change("function applyDraft(mode,data){\n const previousMode", "function applyDraft(mode,data){\n heldSlider=null;commitGraphSlider();\n const previousMode")
    change("value:r.querySelector('math-field,textarea').value,format:", "value:sliderFields.get(r)??r.querySelector('math-field,textarea').value,format:")
    change('range.oninput=()=>setSliderValue(row,Number(range.value));',
           'range.oninput=()=>setSliderValue(row,Number(range.value));\n range.onchange=()=>{if(!sliderAnimations.size)finishGraphSlider();};')
    start = source.index('function setSliderValue(row,value){')
    end = source.index('async function renderCalculatorResults(', start)
    return source[:start] + Path(__file__).with_name('live-sliders.js').read_text() + '\n' + source[end:]
