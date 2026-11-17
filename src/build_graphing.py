"""Assemble the graphing calculator and matrix editor into the existing standalone file."""
from pathlib import Path
from hashlib import sha256
from general_fixes import apply as apply_editor_fixes
from build_matrix import install_matrix
from install_surface import install_surface
from install_jpeg import install_jpeg
from install_graph_export import install_graph_export
from install_series_style import install_series_style
from install_intersections import install_intersections
from install_fit_view import install_fit_view
from install_slices import install_slices
from install_live_sliders import install_live_sliders
from install_drag_render import install_drag_render
from install_graph_access import install_graph_access
from install_math_accuracy import install_math_accuracy
from install_course_paper import install_course_paper
from install_draft_safety import install_draft_safety

root = Path(__file__).resolve().parent
base = (root / 'release-inputs/base.html').read_bytes()
assert sha256(base).hexdigest() == '2e41943e7fc0c957b4c98612e1f691f4bb16ecdf3ef2eedc1092f1ebc4f39918'
s = install_matrix(apply_editor_fixes(base.decode()))

def change(before, after):
    global s
    if s.count(before) != 1:
        raise ValueError('Expected one match for ' + before[:80])
    s = s.replace(before, after, 1)

def fragment(name):
    return (root / name).read_text().strip() + '\n'

change('</head>', '<style>\n' + fragment('graph.css') + fragment('graph-theme.css') + '</style>\n</head>')
change('<aside id="calculatorGuide" class="calculator-guide" hidden>', '<aside id="calculatorGuide" class="calculator-guide" hidden>\n' + fragment('graph.html'))
change('<title>Proofpad — Print & editing update</title>', '<title>Proofpad — Graphs &amp; Matrices</title>')
change('Explore with live values', 'Plot &amp; calculate')
change("calculator?'Your calculations'", "calculator?'Expressions'")
change("CALCULATOR · EXPLORE & EVALUATE", "CALCULATOR · GRAPH & EVALUATE")
change('<h2><span class="sectionnum">02</span>Live calculator</h2><span class="pill">LOCAL</span>', '<h2>Calculator tools</h2>')
change('Write an expression, then define its variables on any line. Drag a slider to see every result update.', 'Define a variable on any line, then drag its slider to update the graph and results.')
change(' This calculator evaluates expressions; it does not solve equations or check proofs.', '')
change("function calculateNotebook(ComputeEngine,values,angle='rad',digits=10){",
       fragment('graph.js') + "\nfunction calculateNotebook(ComputeEngine,values,angle='rad',digits=10,compileGraphs=null){")
change(' const parsed=values.map(value=>{',' const graphNodes=values.map(()=>null);\n const parsed=values.map((value,index)=>{')
change("  if(value.length>12000)return {error:'Expression is too long.'};",
       r"""  const maxLength=value.includes('\\begin{')?100000:12000;
  if(value.length>maxLength)return {error:'Expression is too long.'};""")
change(" const graphNodes=values.map(()=>null);", fragment('normalize-plot-tex.js')+" const graphNodes=values.map(()=>null);")
change("   const expr=ce.parse(value,{form:'raw'});",
       "   const math=normalizeCalculationLatex(value);\n   if(!math.trim())return {empty:true};\n   const expr=ce.parse(math,{form:'raw'});")
change('  const entry=definitions.get(symbol);\n  if(entry.duplicate)', '  const entry=definitions.get(symbol);\n  if(entry.error)throw new Error(entry.error);\n  if(entry.duplicate)')
change('   const json=expr.json;', '   const json=expr.json;graphNodes[index]=json;')
change(' function evaluate(expr){',
""" function isNumericMatrix(value) {
  const rows=value.operator==='List'?value.ops:null;
  if(!rows?.length || rows[0].operator!=='List' || !rows[0].ops.length)return false;
  const columns=rows[0].ops.length;
  return rows.every(row=>row.operator==='List' && row.ops.length===columns &&
   row.ops.every(cell=>Number.isFinite(cell.re) && Number.isFinite(cell.im)));
 }
 function evaluate(expr){""")
change("  if(value.json==='True'||value.json==='False')return value;", "  if(value.json==='True'||value.json==='False'||isNumericMatrix(value))return value;")
change(' return parsed.map(entry=>{', """ const specs=compileGraphs?.(graphNodes,angle,dimension,(index,expanded,error)=>{
  const entry=parsed[index];if(entry.error || entry.empty)return;
  if(error){entry.error=error;parsed[index]={error};return;}
  entry.expr=ce.expr(expanded,{form:'raw'});
 });
 const results=parsed.map(entry=>{""")
change('   const real=result.re,imag=result.im,bool=', r"""   if(result.operator==='List'){
    const rows=result.ops;
    const latex='\\begin{bmatrix}'+rows.map(row=>row.ops.map(cell=>cell.im===0?numberLatex(cell.re):cell.latex).join(' & ')).join('\\\\')+'\\end{bmatrix}';
    return {latex,matrix:[rows.length,rows[0].ops.length],symbol:entry.symbol||null};
   }
   const real=result.re,imag=result.im,bool=""")
change(" });\n}\n\nlet calculatorWorker=", """ });
 if(!compileGraphs)return results;
 return results.map((result,index)=>{
  const graph=specs[index];
  if(!graph)return result;
  if(graph.error)return result.error?{error:graph.error,graph}:result;
  if(result.error || (!result.symbol && !result.matrix && Array.isArray(graphNodes[index]) && ['Equal','Less','LessEqual','Greater','GreaterEqual'].includes(graphNodes[index][0])))return {graph,plotOnly:true,latex:values[index]};
  return {...result,graph};
 });
}

let calculatorWorker=""")
change('const source=calculateNotebook.toString()', "const source=compileGraphRows.toString()+'\\n'+calculateNotebook.toString()")
change('calculateNotebook(ComputeEngine,data.values,data.angle,data.digits)', 'calculateNotebook(ComputeEngine,data.values,data.angle,data.digits,compileGraphRows)')
change('else{renderCalculatorResults(data.results,data.id);', 'else{setGraphResults(data.results);renderCalculatorResults(data.results,data.id);')
change('function calculatorFailed(message){clearTimeout', 'function calculatorFailed(message){setGraphResults([]);clearTimeout')
change('calculatorRevision++;calculatorPending=null;persist();applyDraft', 'calculatorRevision++;calculatorPending=null;setGraphResults([]);persist();applyDraft')
change('  if(data.error||data.empty){', """  delete output.dataset.display;
  if(!data.slider){
   row.calcSymbolLatex=null;
   if(sliderAnimations.has(row)){clearInterval(sliderAnimations.get(row));sliderAnimations.delete(row)}
   const play=slider.querySelector('.slider-play');play.textContent='▶';play.setAttribute('aria-label','Animate variable');
   slider.hidden=true;
  }
  if(data.plotOnly || (data.matrix && data.matrix[0]*data.matrix[1]>64)){
   output.dataset.display='summary';
   const label=data.plotOnly?'Plotted':data.matrix.join(' × ')+' matrix';
   output.textContent=label;output.setAttribute('aria-label',label);continue;
  }
  if(data.error||data.empty){""")
change("output.setAttribute('aria-label','Result');slider.hidden=true;row.calcSymbolLatex=null;if(sliderAnimations.has(row)){clearInterval(sliderAnimations.get(row));sliderAnimations.delete(row)}const play=slider.querySelector('.slider-play');play.textContent='▶';play.setAttribute('aria-label','Animate variable');continue", "output.setAttribute('aria-label','Result');continue")
change("  }else{if(sliderAnimations.has(row)){clearInterval(sliderAnimations.get(row));sliderAnimations.delete(row)}row.calcSymbolLatex=null}\n }\n}", "  }\n }\n}")
change('latex=result.symbol?value:value+', 'latex=(result.symbol||result.plotOnly)?value:value+')
s = install_surface(s)
s = install_series_style(s)
s = install_graph_export(s)
s = install_jpeg(s)
s = install_intersections(s)
s = install_fit_view(s)
s = install_slices(s)
change("function stopSliders(){for(const timer of sliderAnimations.values())clearInterval(timer);sliderAnimations.clear();document.querySelectorAll('.slider-play').forEach(b=>{b.textContent='▶';b.setAttribute('aria-label','Animate variable')})}",fragment('slider-playback.js'))
play_start=s.index(" controls.querySelector('.slider-play').onclick=()=>{")
play_end=s.index("\n };",play_start)+len("\n };")
change(s[play_start:play_end]," configureSliderPlayback(row,controls,range);")
change("if(sliderAnimations.has(row)){clearInterval(sliderAnimations.get(row));sliderAnimations.delete(row)}","stopSliderPlayback(row);")
s = install_live_sliders(s)
s = install_drag_render(s)
s = install_graph_access(s)
s = install_math_accuracy(s)
s = install_course_paper(s)
s = install_draft_safety(s)
change('Type beautiful math and export compact PNGs. A visual formula editor with a math keyboard.',
       'Write mathematical proofs, explore equations in 2D and 3D, calculate with matrices, and export your work as images or a printable PDF.')
change('id="saveDraft">Save draft','id="saveDraft" title="Download an editable backup of this workspace">Save draft')
change('id="openDraft">Open draft','id="openDraft" title="Restore a saved Proofpad draft from a file">Open draft')
change('<details class="writing-guide">', '''<details class="writing-guide"><summary>How to back up or move your work</summary><p>Proofpad saves each workspace in this browser. Use <b>Save draft</b> to download an editable copy, then <b>Open draft</b> to restore it on another device or on the website. Clearing browser data also clears local drafts.</p><p>If two tabs edit the same workspace, use <b>Saved copies</b> to open or download either version.</p></details>
<details class="writing-guide">''')
if __name__ == '__main__':
    print(s, end='')
