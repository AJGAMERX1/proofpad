// Run against a served Proofpad build with Playwright installed.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const [engine = 'chromium', url = 'http://127.0.0.1:9221/'] = process.argv.slice(2);
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');

(async () => {
 const browser = await playwright[engine].launch();
 try {
  const page = await browser.newPage({viewport:{width:1360,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('main').inert);
  await page.click('#graph3D');
  await page.waitForFunction(()=>graphSeries.length>0);
  await page.click('#clear');
  const write = (i,value) => page.locator('#rows math-field').nth(i).evaluate((field,value)=>{
   field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
  await write(0,'z=2\\cos(x)');await page.click('#add');await write(1,'z=2\\sin(y)');
  await page.waitForFunction(()=>graphSeries.length===2);
  const look = index => page.evaluate(index=>graphSeries[index].row.appearance||null,index);
  const paint = ()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const png = ()=>page.locator('#graphCanvas').evaluate(canvas=>canvas.toDataURL());
  await page.click('#surfaceStyles');
  await page.selectOption('#surfaceStyleTarget','1');
  assert(await page.locator('#seriesStyleDialog').isVisible());
  await page.click('[data-surface-look="sea-glass"]');
  await paint();
  assert.equal((await look(0)).finish,'gloss');assert.equal(await look(1),null);
  const glass=await png();
  await page.click('[data-surface-look="blueprint"]');await paint();
  assert.notEqual(await png(),glass);assert.equal((await look(0)).finish,'wire');
  await page.click('#surfaceCustomize summary');
  for(const [part,color] of [['Low','#442287'],['Middle','#ee7788'],['High','#ffeecc']]){
   await page.locator('#surfaceColor'+part).evaluate((input,color)=>{
    input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));
   },color);
  }
  await page.click('[data-finish="gloss"]');
  await page.selectOption('#surfaceGrid','fine');
  await page.locator('#surfaceOpacity').evaluate(input=>{input.value=35;input.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.click('#surfaceReverse');
  const custom=await look(0);
  assert.deepEqual(custom.colors,['#442287','#ee7788','#ffeecc']);
  assert.equal(custom.opacity,.65);assert.equal(custom.reverse,true);
  await page.fill('#surfaceLookName','My sunset');
  await page.click('#saveSurfaceLook');
  await page.selectOption('#surfaceStyleTarget','2');
  await page.locator('#surfaceSavedList button').filter({hasText:'My sunset'}).click();
  assert.deepEqual(await look(1),{...custom,hue:0});
  await page.click('#separateSurfaceColors');
  assert.notEqual((await look(0)).ramp,(await look(1)).ramp);
  assert(!(await look(0)).colors);
  await page.click('#seriesStyleDone');
  await page.click('#undoEdit');
  await page.waitForFunction(()=>graphSeries.length===2 && graphSeries[0].row.appearance?.colors);
  assert.deepEqual(await look(0),custom);assert.deepEqual(await look(1),{...custom,hue:0});
  await page.click('#redoEdit');
  await page.waitForFunction(()=>graphSeries.length===2 && !graphSeries[0].row.appearance?.colors);
  await page.reload();await page.waitForFunction(()=>graphSeries.length===2);
  assert.notEqual((await look(0)).ramp,(await look(1)).ramp);
  await page.click('#surfaceStyles');await page.selectOption('#surfaceStyleTarget','1');
  await page.locator('#surfaceSavedList button').filter({hasText:'My sunset'}).click();
  await page.click('#seriesStyleDone');
  const appliedCustom={...custom,hue:0};
  const draftEvent=page.waitForEvent('download');await page.click('#saveDraft');
  const draft=await draftEvent;
  const stored=JSON.parse(readFileSync(await draft.path()));
  assert.deepEqual(stored.draft.entries[0].appearance,appliedCustom);
  await page.click('#clear');await page.locator('#draftFile').setInputFiles(await draft.path());
  await page.waitForFunction(()=>graphSeries.length===2);
  assert.deepEqual(await look(0),appliedCustom);
  for(const format of ['png','jpeg-compact','jpeg-sharp']){
   await page.selectOption('#graphExportFormat',format);
   const event=page.waitForEvent('download');await page.click('#graphSave');const download=await event;
   const bytes=readFileSync(await download.path());
   assert(bytes.length>1000);
   assert(format==='png'?bytes.subarray(1,4).toString()==='PNG':bytes[0]===255&&bytes[1]===216);
  }
  await page.click('#themeSwitch');
  await page.click('#surfaceHeatmap');await page.click('#surfaceStyles');await page.selectOption('#surfaceStyleTarget','1');
  assert(await page.locator('#seriesStyleDialog').isVisible());
  await page.click('[data-surface-look="peach-silk"]');await paint();
  assert.equal((await look(0)).finish,'soft');
  await page.keyboard.press('Escape');
  await page.click('#graph2D');await write(0,'y=x^2');await page.waitForFunction(()=>graphSeries.length===1);
  await page.locator('.plot-style-trigger').click();
  assert(!(await page.locator('#surfaceStyleEditor').isVisible()));
  await page.click('[data-series-hue="2"]');
  await page.click('#seriesStyleDone');
  assert.equal((await look(0)).hue,2);
  assert.deepEqual(errors,[]);
  console.log('PASS 3D presets, independent surfaces, custom colors, finishes, transparency, saved looks, undo/redo, reload, draft transfer, image exports, heat maps and 2D styles in '+engine);
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
