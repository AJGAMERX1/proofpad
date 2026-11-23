// MathLive's speech rules describe nested expressions, including individual matrix cells.
function proofpadSpokenMath(latex){
 const source=String(latex??'').trim();
 if(!source)return '';
 try{
  const spoken=window.MathLive?.convertLatexToSpeakableText(source.replace(/\\imaginaryI\b/g,'\\text{ the imaginary unit i }'));
  if(spoken?.trim())return spoken.replace(/'([A-Za-z])'/g,'$1').replace(/\s+/g,' ').trim();
 }catch{/* Keep the equation readable when speech conversion is unavailable. */}
 return source.replace(/\\([A-Za-z]+)/g,' $1 ').replace(/_/g,' subscript ').replace(/\^/g,' to the power of ')
  .replace(/[{}]/g,' ').replace(/&/g,', ').replace(/\s+/g,' ').trim();
}
// Print pagination clones each alternative with the ink at its original position.
function markPrintAlternative(parent,text,x,y,width,fontSize){
 if(!text||!(width>0))return;
 const label=svgElement('text',{x,y,'font-family':'Georgia,serif','font-size':fontSize,
  opacity:0,'aria-hidden':'true','data-pdf-line':'',textLength:width,lengthAdjust:'spacingAndGlyphs'});
 label.textContent=text;
 parent.append(label);
}
function markPrintLine(lineNode,line,x,y,fontSize){
 if(!line.runs.length)return;
 const text=line.runs.map(run=>run.pdfText??' ').join('').replace(/\s+([,.!?;:])/g,'$1').replace(/\s+/g,' ').trim();
 let end=line.runs.length;while(end&&!line.runs[end-1].svg)end--;
 const last=line.runs[end-1];
 if(last)markPrintAlternative(lineNode,text,x,y,last.x+last.w,fontSize);
}
function readablePrintRun(latex){
 const prose=/^\\text\{([\s\S]*)\}$/.exec(latex);
 if(!prose)return ' '+proofpadSpokenMath(latex)+' ';
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
