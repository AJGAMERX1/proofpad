// Exercise the 3D curve editor from a saved notebook, including the old 2D trace.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine='chromium', url='http://127.0.0.1:9221/'] = process.argv.slice(2);

(async () => {
 const browser=await playwright[engine].launch();
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('main').inert);
  await page.locator('#draftFile').setInputFiles({
   name:'curves.proofpad.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify({app:'proofpad',version:1,workspace:'surface',draft:{
    entries:[
     {type:'math',value:String.raw`\left(t,a\sin(t),\cos(t)\right)`,curveRange:{min:'-π',max:'π'}},
     {type:'math',value:'a=2'},
     {type:'math',value:'(t,0,0)'},
     {type:'math',value:'(x,t,0)',curveRange:{min:'0',max:'12'}},
    ],
   }}))
  });
  const first=page.locator('#rows .row').nth(0);
  const last=page.locator('#rows .row').nth(2);
  const bound=(row,key)=>row.locator('[data-curve-bound='+key+']');
  await bound(first,'min').waitFor();
  assert.equal(await bound(first,'min').inputValue(),'-π');
  assert.equal(await bound(last,'min').inputValue(),'-2π');
  assert.equal(await bound(last,'max').inputValue(),'2π');
  const wrong=page.locator('#rows .row').nth(3);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.calc-result')).some(el=>el.textContent==='Use t as the parameter for a 3D curve.'));
  assert.equal(await bound(wrong,'max').inputValue(),'12');
  await bound(wrong,'max').fill('16');
  assert.equal(await wrong.locator('.calc-result').textContent(),'Use t as the parameter for a 3D curve.');
  await page.locator('#graphTrace summary').click();
  const trace=page.locator('#traceCoordinate');
  const reading=text=>page.waitForFunction(text=>document.querySelector('#traceStatus').textContent.includes(text),text);
  await trace.fill('pi/2');
  await reading('x = 1.5708, y = 2, z = 0');
  await page.locator('#rows .slider-range:visible').press('ArrowRight');
  await reading('y = 2.1');
  await bound(first,'max').fill('pi/4');
  await reading('Enter t between');
  await bound(first,'max').fill('hello');
  await reading('Check the t range');
  assert.equal(await bound(first,'max').getAttribute('aria-invalid'),'true');
  assert.match(await first.locator('.calc-result').textContent(),/range/);
  await bound(first,'max').fill('2pi');
  await reading('y = 2.1');
  await bound(first,'max').press('Control+z');
  await page.waitForFunction(()=>document.activeElement?.dataset.curveBound==='max');
  // The coalesced edit can return directly to the original max.
  assert.notEqual(await bound(first,'max').inputValue(),'2pi');
  await bound(first,'max').press('Control+Shift+z');
  await page.waitForFunction(()=>document.querySelector('#rows [data-curve-bound=max]').value==='2pi');
  const pending=page.waitForEvent('download');
  await page.locator('#saveDraft').click();
  const saved=JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
  assert.deepEqual(saved.draft.entries[0].curveRange,{min:'-π',max:'2pi'});
  assert.deepEqual(saved.draft.entries[3].curveRange,{min:'0',max:'16'});
  await page.reload();
  await bound(first,'max').waitFor();
  assert.equal(await bound(first,'max').inputValue(),'2pi');
  await first.locator('button[data-move=down]').click();
  assert.equal(await bound(page.locator('#rows .row').nth(1),'max').inputValue(),'2pi');
  await page.locator('#surfaceHeatmap').click();
  assert(await page.locator('#graphTrace').isHidden());
  await page.locator('#surfaceOrbit').click();
  assert(await page.locator('#graphTrace').isVisible());
  await page.locator('#graph2D').click();
  await page.locator('#draftFile').setInputFiles({name:'plane.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify({app:'proofpad',version:1,workspace:'calculator',draft:{entries:[{type:'math',value:'y=x^2'}]}}))
  });
  if (!await page.locator('#graphTrace').evaluate(el=>el.open)) await page.locator('#graphTrace summary').click();
  await trace.fill('3');
  await reading('x = 3, y = 9');
  assert.deepEqual(errors,[]);
  console.log('PASS '+engine+': curve interval inputs, trace XYZ, slider, invalid bounds, undo/redo, backup, reopen, reorder, heat map, and 2D trace.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
