// Preserve the visual MathJax page and its real positions while giving PDF readers
// a searchable text run for each line. Print pagination clones these alongside the ink.
function markPrintLine(lineNode,line,x,y,fontSize){
 if(!line.runs.length)return;
 const text=line.runs.map(run=>run.pdfText??' ').join('').trimEnd();
 let end=line.runs.length;while(end&&!line.runs[end-1].svg)end--;
 const last=line.runs[end-1];
 if(!text||!last)return;
 const label=svgElement('text',{x,y,'font-family':'Georgia,serif','font-size':fontSize,
  opacity:0,'aria-hidden':'true','data-pdf-line':'',textLength:last.x+last.w,lengthAdjust:'spacingAndGlyphs'});
 label.textContent=text;
 lineNode.append(label);
}
function readablePrintRun(latex){
 const prose=/^\\text\{([\s\S]*)\}$/.exec(latex);
 if(!prose)return latex;
 return prose[1].replace(/\\textbackslash\{\}/g,'\\').replace(/\\textasciitilde\{\}/g,'~')
  .replace(/\\textasciicircum\{\}/g,'^').replace(/\\([{}%$#&_])/g,'$1');
}
function addPrintText(pdf,page,paper){
 const matrix=page.getScreenCTM();
 if(!matrix)return;
 const pageInverse=matrix.inverse();
 const mm=paper.width/page.viewBox.baseVal.width;
 for(const node of page.querySelectorAll('text')){
  // Any fallback <text> within MathJax itself belongs to an outlined expression.
  if(node.closest('[data-mml-node]'))continue;
  const value=node.textContent;
  if(!value?.trim())continue;
  const relative=pageInverse.multiply(node.getScreenCTM());
  const size=Number(node.getAttribute('font-size'));
  const baseline=Number(node.getAttribute('y'));
  const width=node.hasAttribute('textLength')?node.textLength.baseVal.value:node.getComputedTextLength();
  const rightAligned=node.getAttribute('text-anchor')==='end';
  const x=Number(node.getAttribute('x'))-(rightAligned?width:0);
  const position=new DOMPoint(x,baseline).matrixTransform(relative);
  const fontPoints=Math.hypot(relative.c,relative.d)*size*mm*72/25.4;
  if(!Number.isFinite(fontPoints)||fontPoints<=0)continue;
  pdf.setFont('times',node.getAttribute('font-weight')==='bold'?'bold':node.getAttribute('font-style')==='italic'?'italic':'normal');
  pdf.setFontSize(fontPoints);
  const encoded=value.replace(/[^\u0020-\u007e\u00a0-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu,'?');
  // PDF ActualText carries the original UTF-16 when a standard font lacks a glyph.
  if(encoded!==value){
   let hex='FEFF';
   for(let i=0;i<value.length;i++)hex+=value.charCodeAt(i).toString(16).padStart(4,'0');
   pdf.internal.write('/Span << /ActualText <'+hex+'> >> BDC');
  }
  const nominal=pdf.getTextWidth(encoded);
  const stretch=nominal>0?Math.hypot(relative.a,relative.b)*width*mm/nominal:1;
  pdf.text(encoded,position.x*mm,position.y*mm,{renderingMode:'invisible',horizontalScale:stretch||1});
  if(encoded!==value)pdf.internal.write('EMC');
 }
}
