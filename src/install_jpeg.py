"""Add source-resolution JPEG downloads to Proofpad's vector sheet export."""
from pathlib import Path

def install_jpeg(source):
    def change(before,after):
        nonlocal source
        if source.count(before)!=1:
            raise ValueError('JPEG export expected one match near '+before[:90])
        source=source.replace(before,after,1)
    change('</head>', '''<style>
.jpeg-export {display:flex;align-items:end;gap:12px;margin-top:12px;flex-wrap:wrap}
.jpeg-export label {flex:1;min-width:130px}
.jpeg-export select {width:100%}
.jpeg-export .copy {white-space:nowrap}
</style>
</head>''')
    change('<div class="note">Only your work is exported.',
           '''<div class="jpeg-export"><label for="jpegQuality"><span class="label">JPEG quality</span><select id="jpegQuality"><option value="sharp">Sharp JPEG · up to 4×</option><option value="compact">Compact JPEG · up to 1×</option></select></label><button type="button" class="copy" id="jpegDownload" disabled>Download JPEG</button></div><div class="note">Only your work is exported.''')
    # The chosen PNG resolution may exceed browser limits even when Compact JPEG fits.
    # Check PNG dimensions only after retaining the successfully typeset SVG.
    guard="if(!forPrint&&(pw>16000||ph>16000||pw*ph>32000000))throw new Error('This image is too large. Use Compact resolution or split the proof across exports.');"
    change(guard,'')
    change('  const {root,w,h,pw,ph}=await createSheet(content,title);',
           '''  const {root,w,h,pw,ph}=await createSheet(content,title);
  if(rev!==revision)return;
  setJpegSheet({root,width:w,height:h,paper:exportStyles[selectedExportStyle()].surface,revision:rev});
  if(pw>16000||ph>16000||pw*ph>32000000)throw new Error('The PNG is too large. Choose Compact resolution or download a JPEG.');''')
    change("revision++;pngBlob=null;$('#download').disabled=", "revision++;pngBlob=null;setJpegSheet(null);$('#download').disabled=")
    snippet=(Path(__file__).parent/'formula-jpeg.js').read_text()
    change("$('#download').onclick=",snippet+"\n$('#download').onclick=")
    return source
