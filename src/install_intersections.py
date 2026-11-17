"""Wire the 2D intersection tools into display, graph revisions and proof history."""
from pathlib import Path


def install_intersections(source):
    root = Path(__file__).resolve().parent

    def change(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError('Unexpected intersection integration point: ' + old[:80])
        source = source.replace(old, new, 1)

    change('</head>', '<style>\n' + (root/'intersections.css').read_text() + '</style>\n</head>')
    change('  <div class="graph-tools"', '  <div id="intersectionLayer"></div>\n  <div class="graph-tools"')
    change(' <div class="surface-legend', ''' <div id="intersectionBar" hidden>
  <span id="intersectionPair" hidden><select id="intersectionFirst" aria-label="First curve for intersections"></select>
  <span>and</span><select id="intersectionSecond" aria-label="Second curve for intersections"></select></span>
  <label>Intersections <select id="intersectionChoice"></select></label>
  <span id="systemStatus" role="status"></span>
  <button id="revealCrossing" type="button" hidden>Show intersection</button>
  <button id="intersectionInsert" type="button" disabled>Insert into proof</button>
  <button id="systemProof" type="button" disabled>New proof from system</button>
 </div>
 <div class="surface-legend''')
    change('function setGraphResults(results) {',
           (root/'linear-system.js').read_text() + '\n' + (root/'intersections.js').read_text() + '\nfunction setGraphResults(results) {\n invalidateIntersections();')
    change(' const id=++calculatorRevision;', ' invalidateIntersections(true);\n const id=++calculatorRevision;')
    change(' drawGraphAxes(ctx,w,h,g,style);', ' drawGraphAxes(ctx,w,h,g,style);\n if(canvas===graphCanvas)refreshIntersections(shown,w,h,g);')
    return source
