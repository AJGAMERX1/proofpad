// Open real draft files and exercise the preview and download controls.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine='chromium', url='http://127.0.0.1:9221/', pdfPath] = process.argv.slice(2);

(async () => {
 const browser=await playwright[engine].launch();
 try {
  const page=await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('main').inert);
  async function open(workspace,entries,title) {
   const draft={app:'proofpad',version:1,workspace,draft:{title,quality:'2',entries}};
   await page.locator('#draftFile').setInputFiles({name:'export.proofpad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(draft))});
   await page.waitForFunction(title=>document.querySelector('#title').value===title,title);
  }
  const long=Array.from({length:150},(_,i)=>({type:'math',value:String.raw`\frac{${i+1}}{1+x^2}`}));
  for(const workspace of ['proofs','formulas']){
   await open(workspace,long,'Long '+workspace);
   await page.waitForFunction(()=>!document.querySelector('#download').disabled&&document.querySelector('#dimensions').textContent.includes('auto-fit'));
   const preview=await page.locator('#preview').evaluate(async img=>{
    await img.decode();return [img.naturalWidth,img.naturalHeight];
   });
   assert(preview[0]>0 && preview[1]>8000 && preview[1]<=16000);
   assert(preview[0]*preview[1]<=16000000);
   const file=page.waitForEvent('download');
   await page.locator('#download').click();
   const png=await fs.readFile(await (await file).path());
   assert.equal(png.toString('ascii',1,4),'PNG');
   assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],preview);
   if(workspace==='formulas'){
    await page.locator('#printFlow').selectOption('pages');
    await page.locator('#printPreview').click();
    await page.locator('#printDialog[open]').waitFor();
    assert(await page.locator('.print-page').count()>1);
    assert.equal(await page.locator('#printPages [data-pdf-line]').count(),150);
    await page.locator('#closePrint').click();
   }
   await open(workspace,[{type:'math',value:String.raw`\frac{1}{\placeholder{}}`}],'Incomplete '+workspace);
   await page.waitForFunction(()=>/empty math placeholders/.test(document.querySelector('#placeholder').textContent));
   assert(await page.locator('#download').isDisabled());
  }
  await open('proofs',[
   {type:'text',format:'math-latex',value:String.raw`\text{Compare }a_{k+1}-a_k\text{ with the following matrix.}`},
   {type:'math',value:String.raw`\begin{bmatrix}1&2\\3&4\end{bmatrix}`},
   {type:'math',value:String.raw`x^2+\alpha=\frac{1}{2}`},
  ],'Searchable math');
  await page.waitForFunction(()=>!document.querySelector('#download').disabled&&!document.querySelector('#dimensions').textContent.includes('auto-fit'));
  await page.locator('#printPreview').click();
  await page.locator('#printDialog[open]').waitFor();
  const labels=await page.locator('#printPages [data-pdf-line]').allTextContents();
  assert(labels.some(line=>/Compare .*subscript.* minus .* sub .* with the following matrix\./i.test(line)),labels.join('|'));
  assert(labels.some(line=>/matrix row 1 column 1: 1, column 2: 2, row 2 column 1: 3, column 2: 4/i.test(line)));
  assert(labels.some(line=>/x squared plus alpha equals.*half/i.test(line)));
  assert(labels.every(line=>!line.includes('\\')&&!line.includes('_{')));
  assert.equal(await page.evaluate(()=>proofpadSpokenMath('3+2\\imaginaryI')),'3 plus 2 the imaginary unit i');
  const file=page.waitForEvent('download');
  await page.locator('#downloadPdf').click();
  const downloaded=await file;
  const pdf=await fs.readFile(await downloaded.path());
  assert.equal(pdf.toString('ascii',0,5),'%PDF-');
  assert.match(pdf.toString('latin1'),/jsPDF 4\./);
  if(pdfPath)await downloaded.saveAs(pdfPath);
  console.log(engine,'150-row PNG and invalid preview in both modes, searchable inline and display math, PDF download passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
