// Use actual touch taps; hardware keyboard APIs miss iOS's suppressed-click bug.
const assert=require('node:assert/strict');
const playwright=require(process.env.PROOFPAD_PLAYWRIGHT||'playwright');
const [engine='webkit',url='http://127.0.0.1:9221/']=process.argv.slice(2);
(async()=>{
 const browser=await playwright[engine].launch();
 try{
  const page=await browser.newPage({...playwright.devices[engine==='webkit'?'iPhone 13':'Pixel 5']});
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForFunction(()=>!document.querySelector('main').inert);
  const tap=selector=>page.locator(selector).tap();
  const key=label=>tap('.ML__keyboard .MLK__keycap[aria-label='+JSON.stringify(label)+']:visible');
  const action=name=>tap('.ML__keyboard [data-command*='+JSON.stringify('('+name+')')+']:visible');
  const value=()=>page.evaluate(()=>active.value);
  const waitValue=text=>page.waitForFunction(text=>active.value===text,text);
  const visible=()=>page.waitForFunction(()=>mathVirtualKeyboard.visible);
  const hidden=()=>page.waitForFunction(()=>!mathVirtualKeyboard.visible);
  await tap('#rows math-field');await visible();
  for(const letter of 'cat')await key(letter);
  await waitValue('\\text{cat}');
  for(let i=0;i<3;i++)await action('deleteBackward');
  await page.waitForFunction(()=>!hasContent(active.value)&&active.mode==='text');
  for(const letter of 'for')await key(letter);
  await waitValue('\\text{for}');
  await action('commit');
  await page.waitForFunction(()=>rows().length===2&&active===rows()[1].querySelector('math-field'));
  await visible();await key('x');await waitValue('\\text{x}');
  await tap('.toolbar [data-command="moveToSubscript"]');await visible();await key('2');
  assert((await value()).includes('_'));assert((await value()).includes('2'));
  await tap('.toolbar [data-command="moveAfterParent"]');
  assert.equal(await page.evaluate(()=>active.mode),'text');
  await tap('#textMode');assert.equal(await page.evaluate(()=>active.mode),'math');
  await tap('#textMode');assert.equal(await page.evaluate(()=>active.mode),'text');
  await tap('#showKeyboard');await hidden();
  await tap('#showKeyboard');await visible();
  // Tapping the symbol palette must insert exactly once and retain prose mode.
  await tap('[data-tab="greek"]');await tap('#keys button[aria-label="Sigma"]');
  assert((await value()).includes('\\sigma'));assert.equal(await page.evaluate(()=>active.mode),'text');
  const withSigma=await value();await tap('#undoEdit');
  await page.waitForFunction(value=>active.value!==value,withSigma);
  await tap('#redoEdit');await waitValue(withSigma);
  await tap('#matrixTool');await page.locator('#matrixDialog[open]').waitFor();
  await page.fill('#matrixRows','2');await page.fill('#matrixCols','2');await page.selectOption('#matrixFill','identity');
  await tap('#matrixConfirm');await page.locator('#matrixDialog').waitFor({state:'hidden'});
  assert((await value()).includes('\\begin{bmatrix}'));
  await tap('#pasteOpen');await page.locator('#pastePanel').waitFor({state:'visible'});
  await page.fill('#pasteInput','q=4');await page.selectOption('#pasteType','math');await tap('#pasteInsert');
  assert((await value()).includes('q=4'));
  await tap('#copyLine');
  await page.waitForFunction(()=>/Line copied as LaTeX|Press Cmd\/Ctrl\+C to copy/.test(document.querySelector('#status').textContent));
  await tap('#graph2D');await tap('#rows math-field');await visible();
  await key('8');await key('&divide;');await key('2');
  assert(/^\\frac(?:\{8\}|8)(?:\{2\}|2)$/.test(await value()));
  // Our larger calculator keypad uses the same touch activation path.
  await tap('[data-calc-key="+"]');await tap('[data-calc-key="7"]');
  assert((await value()).includes('7'));
  await tap('.calc-keypad [data-command="deleteBackward"]');
  assert(!(await value()).includes('7'));
  await tap('#matrixTool');await page.locator('#matrixDialog[open]').waitFor();await tap('#matrixCancel');
  await tap('[data-mode="proofs"]');await tap('#addText');await visible();
  // Repeated immediate keys after Return catch MathLive's delayed focus race.
  for(let i=0;i<5;i++){
   await key('x');await key('y');await waitValue('\\text{xy}');
   const count=await page.locator('#rows math-field').count();
   await action('commit');await page.waitForFunction(count=>rows().length===count+1,count);
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine}: touch letters, empty explanation, Return, subscript, modes, keyboard toggle, symbols, undo/redo, matrix, paste/copy, fractions, calculator keys.`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
