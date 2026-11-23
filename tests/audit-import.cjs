// Preserve unknown source for copy while exporting the rest of the document.
const assert=require('node:assert/strict');
const playwright=require(process.env.PROOFPAD_PLAYWRIGHT||'playwright');
const [engine='chromium',url='http://127.0.0.1:9221/']=process.argv.slice(2);
(async()=>{
 const browser=await playwright[engine].launch();
 try{
  const page=await browser.newPage();
  // Exercise Copy line and inspect exactly what it writes, including newlines.
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.lastCopy=text;}}}));
  await page.goto(url);await page.waitForFunction(()=>!document.querySelector('main').inert);
  const table=String.raw`\begin{tabular}{cc}
x & y \\ % nested marker in a comment: \end{tabular}
  \label{tab:demo}1 & 2 \\
x_i^2 & ~ \\
\end{tabular}`;
  const nested=String.raw`\begin{unknown}Outer \begin{unknown}inner\end{unknown}
\begin{tabular}{c}another\end{tabular}
\end{unknown}`;
  const inMath=String.raw`\[\begin{tabular}{c}inside\end{tabular}\]`;
  const source=['Before.',table,'\\[x+1=2\\]',nested,'After.',inMath,'Finished.'].join('\n\n');
  for(const mode of ['formulas','proofs']){
   await page.click('#texOpen');await page.fill('#texSource',source);
   await page.selectOption('#texDestination',mode);
   assert.match(await page.locator('#texInfo').textContent(),/Preserved.*tabular.*unknown/);
   await page.click('#texConfirm');
   await page.waitForFunction(()=>!document.querySelector('#texImport').open&&!document.querySelector('#download').disabled);
   assert(await page.locator('#preview').evaluate(image=>image.naturalWidth>0));
   const fields=page.locator('#rows math-field');assert.equal(await fields.count(),7);
   for(const [index,expected] of [[0,'\\text{Before.}'],[2,'x+1=2'],[4,'\\text{After.}'],[6,'\\text{Finished.}']]){
    assert.equal(await fields.nth(index).evaluate(f=>f.value),expected);
   }
   for(const [index,expected] of [[1,table],[3,nested],[5,inMath]]){
    const field=fields.nth(index);await field.click({position:{x:10,y:14}});
    await page.waitForFunction(i=>document.activeElement===document.querySelectorAll('#rows math-field')[i],index);
    await page.click('#copyLine');
    assert.equal(await page.evaluate(()=>window.lastCopy),expected);
   }
   const download=page.waitForEvent('download');await page.click('#download');
   assert.match((await download).suggestedFilename(),/\.png$/i);
  }
  console.log('PASS '+engine+' imports nested and repeated environments, copies exact source, and downloads a working PNG in both workspaces');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
