// End-to-end coverage for the real worker, row renderer and math input boundaries.
const assert=require('node:assert/strict');
const playwright=require(process.env.PROOFPAD_PLAYWRIGHT||'playwright');
const [engine='chromium',url='http://127.0.0.1:9221/']=process.argv.slice(2);
(async()=>{
 const browser=await playwright[engine].launch();
 try {
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('main').inert);
  const raw=String.raw, values=[
   raw`\sum_{n=1}^{100}n`,raw`\prod_{j=1}^4j`,raw`\int_0^1 x^2 dx`,raw`\frac{d}{dx}x^3`,
   '1/3+1/6',raw`\int x dx`,'(t,2t,0)','t=4',raw`\style{color:blue}{\htmlClass{sample}{\mathbf{x}^2}}`
  ];
  await page.locator('#draftFile').setInputFiles({name:'calculus.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify({app:'proofpad',version:1,workspace:'calculator',draft:{entries:values.map(value=>({type:'math',value}))}}))});
  await page.waitForFunction(()=>document.querySelector('#rows .row')?.calcResult?.number===5050);
  const results=await page.locator('#rows .row').evaluateAll(rows=>rows.map(row=>row.calcResult));
  assert.equal(results[1].number,24);assert.equal(results[2].latex,raw`\frac{1}{3}`);
  assert.equal(results[3].latex,'3x^2');assert.equal(results[4].latex,raw`\frac{1}{2}`);
  assert.equal(results[4].approx,false);assert.match(results[5].error,/finite integral/);
  assert.equal(results[6].error,'3D curves go in the 3D graph.');
  const field=page.locator('#rows math-field').last();
  let value=await field.evaluate(el=>el.value);
  assert.doesNotMatch(value,/htmlClass|style\{/);assert.match(value,/mathbf/);
  await field.click();
  await page.locator('#toggleLatex').click();
  await page.locator('#latex').fill(raw`\htmlData{unit=m}{\mathrm{m}^2}`);
  value=await field.evaluate(el=>el.value);
  assert.doesNotMatch(value,/htmlData/);assert.match(value,/mathrm/);
  // Simulate a harmless styled fragment through a native paste event.
  await field.evaluate(el=>{
   el.focus();el.position=el.lastOffset;
   const data=new DataTransfer();data.setData('text/plain',String.raw`+\class{note}{y}`);
   el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
  });
  value=await field.evaluate(el=>el.value);
  assert.doesNotMatch(value,/class\{/);assert.match(value,/y/);
  await page.locator('#texOpen').click();
  await page.locator('#texSource').fill(raw`\begin{document}\[\htmlStyle{color:blue}{\sqrt{2}}\]\end{document}`);
  await page.locator('#texDestination').selectOption('formulas');
  await page.locator('#texConfirm').click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#rows math-field')).some(el=>el.value.includes('sqrt')));
  value=await page.locator('#rows math-field').first().evaluate(el=>el.value);
  assert.doesNotMatch(value,/htmlStyle/);assert.match(value,/sqrt/);
  assert.deepEqual(errors,[]);
  console.log('PASS '+engine+' real calculus worker, exact UI answers, draft, source, native paste and TeX import');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
