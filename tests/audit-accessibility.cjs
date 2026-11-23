// Run with axe-core installed or PROOFPAD_AXE pointing to axe.min.js.
const assert=require('node:assert/strict');
const playwright=require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const axe=require.resolve(process.env.PROOFPAD_AXE || 'axe-core/axe.min.js');
const [engine='chromium',url='http://127.0.0.1:9221/']=process.argv.slice(2);

(async()=>{
 const browser=await playwright[engine].launch();
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('main').inert);
  await page.addScriptTag({path:axe});
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.click('#themeSwitch');
   for(const mode of ['proofs','formulas','calculator','surface']){
    await page.click('button[data-mode="'+mode+'"]');
    if(mode==='surface')await page.waitForFunction(()=>graphSeries.length>0);
    const failures=await page.evaluate(async()=>{
     const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag21aaa']},resultTypes:['violations']});
     return result.violations.map(v=>({rule:v.id,elements:v.nodes.map(n=>n.target)}));
    });
    assert.deepEqual(failures,[],theme+' '+mode+': '+JSON.stringify(failures));
   }
  }
  console.log('PASS '+engine+': all four workspaces in both themes passed the automated accessibility checks.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
