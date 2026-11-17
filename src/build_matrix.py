"""Install the large-matrix builder into a standalone Proofpad v1 document."""
from pathlib import Path

BASE = Path(__file__).resolve().parent

def install_matrix(source):
    def replace(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError(f"Matrix installer expected one match for {old[:75]!r}")
        source = source.replace(old, new, 1)

    replace("</head>", "<style>\n"+(BASE/"matrix.css").read_text()+"</style>\n</head>")
    replace('<dialog id="texImport"', (BASE/"matrix.html").read_text()+'<dialog id="texImport"')
    button = '<button type="button" class="tool" id="matrixTool" aria-haspopup="dialog" aria-controls="matrixDialog"><span class="symbol" aria-hidden="true">▦</span>Matrix…</button>'
    replace('<button class="tool" data-command="moveAfterParent"', button+'<button class="tool" data-command="moveAfterParent"')
    replace("field.defaultMode='math';field.value=type===", "field.defaultMode='math';field.maxMatrixCols=MATRIX_MAX_SIDE;field.value=type===")
    # MathLive serializes blank cells as individual LaTeX placeholder commands.
    # A full 100-by-100 empty matrix exceeds the former 100 KB per-block limit.
    replace("e.value.length>100000", "e.value.length>500000")
    replace("tex:{packages:{'[+]':['ams']}}", "tex:{packages:{'[+]':['ams']},maxBuffer:524288}")
    replace("field.menuItems=patch(field.menuItems);", """const menu=patch(field.menuItems);
 const picker=menu.findIndex(item=>item.id==='insert-matrix');
 menu.splice(picker+1,0,{id:'proofpad-custom-matrix',label:'Custom matrix…',onMenuSelect:()=>openMatrixDialog(field)});
 field.menuItems=menu;""")
    # Inside an explanation, MathLive's container normally clips its unwrapped
    # contents. Keep wrapping the prose while letting wide inline math scroll.
    replace(":host(.explanation-field) .ML__container{overflow-x:clip}", ":host(.explanation-field) .ML__container{overflow-x:auto}")
    # Render a complete matrix even when the user's selected PNG resolution
    # exceeds a browser canvas limit. Preserve the SVG ratio and report the
    # actual pixel size in the existing preview.
    replace(",pw=Math.ceil(w*scale),ph=Math.ceil(h*scale);",
            """;
  let pw=Math.ceil(w*scale),ph=Math.ceil(h*scale);
  if(!forPrint&&content.some(entry=>/\\\\begin\\{[bpvV]?matrix\\}/.test(entry.value))){
   const matrixScale=Math.min(1,16000/pw,16000/ph,Math.sqrt(16000000/(pw*ph)));
   if(matrixScale<1){pw=Math.max(1,Math.floor(pw*matrixScale));ph=Math.max(1,Math.floor(ph*matrixScale))}
  }""")
    replace("showKeys('proof');\nwindow.addEventListener('load'", (BASE/"matrix.js").read_text()+"\nshowKeys('proof');\nwindow.addEventListener('load'")
    return source
