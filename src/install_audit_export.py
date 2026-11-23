"""Apply shared preview, accessible print, and PDF dependency updates."""
from bundle_offline import PACKAGES, replace_once


def install_audit_export(source):
    def once(old, new):
        nonlocal source
        source = replace_once(source, old, new)

    once('jspdf@2.5.2/dist/jspdf.umd.min.js', PACKAGES['jspdf'])
    # Cache the text with its LaTeX run and only pay the speech cost for print.
    once('async function explanationPiece(value,size,n){', 'async function explanationPiece(value,size,n,forPrint){')
    once("Math.round(size*.66),null))", "Math.round(size*.66),null,forPrint))")
    once("Math.round(size*.66),number));continue}", "Math.round(size*.66),number,forPrint));continue}")
    once("runs.push({...run,pdfText:readablePrintRun(token.latex)})",
         "if(forPrint)run.pdfText??=readablePrintRun(token.latex);runs.push({...run})")
    once("const number=entry.number??++stepNum;",
         "const number=entry.number??++stepNum;const label=(workspaceMode==='proofs'?'Proof step ':'Formula ')+number;")
    once("new Error('Fill in the empty math placeholders before exporting.')",
         "new Error(label+' contains empty math placeholders. Fill them in before exporting.')")
    once("new Error('Check your math step for an incomplete or unsupported LaTeX command.')",
         "new Error(label+' contains incomplete or unsupported LaTeX. Check the expression before exporting.')")
    once("pieces.push({type:'math',svg,w:", "pieces.push({type:'math',latex:entry.value,baseline:-vb[1]/vb[3],svg,w:")
    once("p.svg.removeAttribute('style');block.append(p.svg);",
         "p.svg.removeAttribute('style');block.append(p.svg);\n"
         "    if(forPrint)markPrintAlternative(block,proofpadSpokenMath(p.latex),x,y+p.h*p.baseline,p.w,Math.min(size,p.h));")

    start = source.index('  let pw=Math.ceil(w*scale),ph=Math.ceil(h*scale);')
    end = source.index("  const root=svgElement('svg'", start)
    once(source[start:end], """  let pw=Math.ceil(w*scale),ph=Math.ceil(h*scale);
  let reduced=false;
  if(!forPrint){
   const preferred=jpegRasterSize(w,h,scale);
   if(preferred.width<pw||preferred.height<ph){
    const compact=jpegRasterSize(w,h,Math.min(1,scale));
    pw=compact.width;ph=compact.height;reduced=true;
   }
  }
""")
    once("return {root,w,h,pw,ph,blocks};", "return {root,w,h,pw,ph,blocks,reduced};")
    once("const {root,w,h,pw,ph}=await createSheet(content,title);",
         "const {root,w,h,pw,ph,reduced}=await createSheet(content,title);")
    once("  if(pw>16000||ph>16000||pw*ph>32000000)throw new Error('The PNG is too large. Choose Compact resolution or download a JPEG.');\n", "")
    once("canvas.getContext('2d').drawImage(img,0,0);const blob=",
         "const ctx=canvas.getContext('2d');if(!ctx)throw new Error('The browser could not allocate a PNG canvas. Use Print preview for a paginated PDF.');ctx.drawImage(img,0,0);const blob=")
    once("canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not export this image. Try a smaller size.');",
         "canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=1;if(!blob)throw new Error('The browser could not encode this PNG. Use Print preview for a paginated PDF.');")
    once("$('#dimensions').textContent=`${pw.toLocaleString()} × ${ph.toLocaleString()} px`;",
         "$('#dimensions').textContent=`${pw.toLocaleString()} × ${ph.toLocaleString()} px`"
         "+(reduced?` · ${Number((pw/w).toFixed(3))}× · auto-fit`:'');")
    once("$('#copy').disabled=false;status('')}finally{URL.revokeObjectURL(url)}",
         "$('#copy').disabled=false;status(reduced?'PNG resolution adjusted to fit this document. Print preview exports PDF pages without the PNG dimension limit.':'')}finally{URL.revokeObjectURL(url)}")
    once("$('#placeholder').textContent='Finish this step to see your proof.';",
         "$('#placeholder').textContent=e.message||'The export preview could not be generated.';")
    return source
