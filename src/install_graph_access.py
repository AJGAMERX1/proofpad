"""Give students direct access to editing and keyboard-readable graph coordinates."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def install_graph_access(source):
    def change(old,new):
        nonlocal source
        if source.count(old)!=1: raise ValueError('Graph access hook: '+old[:80])
        source=source.replace(old,new,1)
    change('<div class="slice-layout">','''<details id="graphTrace"><summary>Trace coordinates</summary>
  <div class="trace-controls"><label>Curve <select id="traceLine"></select></label><label><span id="traceAxis">x =</span> <input id="traceCoordinate" type="number" step="any" value="0" aria-label="x coordinate"></label>
  <output id="traceStatus" aria-live="polite" aria-atomic="true"></output></div></details>
  <div class="slice-layout">''')
    change('<div id="intersectionLayer">','<div id="traceMarkers" aria-hidden="true"></div><div id="intersectionLayer">')
    change('if(canvas===graphCanvas)refreshIntersections(shown,w,h,g);','if(canvas===graphCanvas){refreshIntersections(shown,w,h,g);updateGraphTrace();}')
    change("document.querySelector('#graphZoomIn').onclick", (ROOT/'graph-trace.js').read_text()+"\ndocument.querySelector('#graphZoomIn').onclick")
    source=source.replace('Press Home to reset.', 'Press Home to reset. Press T to trace coordinates.')
    change('</head>','''<style>
/* Chromium cannot insert text into a zero-size contenteditable. The
   MathLive keyboard sink remains clipped while it has a caret rectangle. */
math-field::part(keyboard-sink){min-width:2px;min-height:2px}
#graphTrace :is(select,input){border:1px solid var(--border);border-radius:6px;background:var(--panel,#f4f8fb);color:inherit;font:500 13px/1.3 system-ui;padding:6px 10px}
@media(max-width:650px){body>header{height:auto;min-height:60px;flex-wrap:wrap;gap:6px 10px;padding:8px 12px}.header-actions{margin-left:auto}}
#graphTrace{padding:8px 15px;border-bottom:1px solid var(--pad-line);font:13px/1.4 system-ui;color:var(--pad-ink)}
#graphTrace summary{cursor:pointer;width:fit-content}#traceCoordinate{width:7em}
.trace-controls{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:8px}
#traceStatus{font-variant-numeric:tabular-nums}main:not([data-workspace="calculator"]) :is(#graphTrace,#traceMarkers){display:none}
#traceMarkers{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#traceMarkers i{position:absolute;transform:translate(-50%,-50%);width:11px;height:11px;border:2px solid var(--pad-accent);background:var(--graph-paper);border-radius:50%}
</style></head>''')
    return source
