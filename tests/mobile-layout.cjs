// Serve docs/ first. Pass an engine and URL to check a deployed build.
const assert = require('node:assert/strict');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine = 'webkit', url = 'http://127.0.0.1:9221/'] = process.argv.slice(2);

(async () => {
 const browser = await playwright[engine].launch();
 try {
  const page = await browser.newPage({
   ...playwright.devices[engine === 'webkit' ? 'iPhone 13' : 'Pixel 7'],
   viewport:{width:320,height:780},
  });
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('main').inert);
  const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const caretVisible=()=>page.waitForFunction(()=>{
   const keyboard=window.mathVirtualKeyboard;
   const field=document.activeElement;
   if(!keyboard?.visible || field?.tagName!=='MATH-FIELD')return false;
   // Read the rendered caret: MathLive's element-info cache can lag scrolling.
   const caret=field.shadowRoot.querySelector('.ML__text-caret,.ML__caret');
   if(!caret)return false;
   const box=caret.getBoundingClientRect(),top=window.visualViewport?.offsetTop||0;
   return box.top>=top && box.bottom<=keyboard.boundingRect.top && keyboard.boundingRect.top<innerHeight;
  });
  await noOverflow();
  await page.locator('#rows math-field').first().tap();
  await caretVisible();
  await page.keyboard.insertText('Let these variables be real numbers. '.repeat(15));
  await caretVisible();
  assert((await page.locator('#rows math-field').first().evaluate(f=>f.value)).includes('variables'));
  await noOverflow();
  await page.setViewportSize({width:844,height:390});
  await caretVisible();
  await noOverflow();
  await page.locator('#showKeyboard').tap();
  await page.waitForFunction(()=>!mathVirtualKeyboard.visible);
  await page.locator('#showKeyboard').tap();
  await caretVisible();
  await page.locator('#rows math-field').first().locator('[part="virtual-keyboard-toggle"]').tap();
  await page.waitForFunction(()=>!mathVirtualKeyboard.visible);

  // Both dialogs must work by touch and hide the math keyboard.
  await page.setViewportSize({width:320,height:780});
  await page.locator('#matrixTool').tap();
  await page.locator('#matrixDialog[open]').waitFor();
  await page.waitForFunction(()=>!mathVirtualKeyboard.visible);
  await noOverflow();
  await page.locator('#matrixFill').selectOption('paste');
  await page.locator('#matrixData').fill('1\t2\n3\t4');
  await page.locator('#matrixConfirm').tap();
  assert((await page.locator('#rows math-field').first().evaluate(f=>f.value)).includes('matrix'));
  await page.locator('#graph3D').tap();
  await page.waitForFunction(()=>graphSeries.length>0);
  await page.waitForFunction(()=>!mathVirtualKeyboard.visible);
  await page.locator('#surfaceStyles').tap();
  await page.locator('#seriesStyleDialog[open]').waitFor();
  await page.locator('#surfaceCustomize summary').tap();
  await page.locator('#surfaceLookName').fill('Phone look');
  await page.locator('#saveSurfaceLook').tap();
  await noOverflow();
  await page.locator('#seriesStyleDone').tap();
  assert.deepEqual(errors,[]);
  console.log('PASS mobile 320px layout, long-entry caret scrolling, landscape, keyboard dismissal, matrix and style dialogs in '+engine);
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
