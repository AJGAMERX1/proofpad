// Cover the import, curve framing, touch, and assistive labels from the external audit.
const assert = require('node:assert/strict');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine='chromium', url='http://127.0.0.1:9221/'] = process.argv.slice(2);

(async()=>{
 const browser=await playwright[engine].launch();
 try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(()=>!document.querySelector('main').inert);
  await page.locator('#rows math-field').first().click();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#rows .row').first().evaluate(row=>getComputedStyle(row).outlineStyle),'solid');
  const source=String.raw`First paragraph.
\begin{tabular}{cc}
a & b \\
\end{tabular}
\[x=7\]
Last paragraph.`;
  await page.click('#texOpen');
  await page.fill('#texSource',source);
  assert.match(await page.textContent('#texInfo'),/Preserved.*tabular/);
  await page.click('#texConfirm');
  await page.waitForFunction(()=>document.querySelectorAll('#rows math-field').length===4);
  const content=await page.locator('#rows math-field').evaluateAll(fields=>fields.map(f=>f.value));
  assert.match(content[0],/First paragraph/);
  assert.match(content[1],/begin.*tabular.*a.*b.*end/);
  assert.match(content[2],/x=7/);
  assert.match(content[3],/Last paragraph/);
  await page.click('#graph3D');
  await page.selectOption('#surfacePreset','helix');
  await page.click('#graphExample');
  const curve=page.locator('[data-curve-bound=max]').last();
  await curve.waitFor();
  const name=(await page.locator('#graphLegend button').allTextContents()).find(t=>/^Curve /.test(t));
  assert.ok(name);
  await page.click('#graphTrace summary');
  await page.waitForFunction(label=>[...document.querySelectorAll('#traceLine option')].some(option=>option.textContent===label),name);
  const frame=await page.evaluate(()=>{
   const w=560,h=360,view=surfaceView,g=surfaceProjection(w,h,view);
   const p=Array.from({length:251},(_,i)=>{
    const t=-2*Math.PI+4*Math.PI*i/250,unit=2/view.span;
    return g.project(t*unit,Math.sin(t)*unit,Math.cos(t)*unit);
   });
   return {bounds:p.every(({u,v})=>u>0&&u<w&&v>0&&v<h),radius:g.scale,
    backwards:p.filter((v,i)=>i&&v.u<p[i-1].u).length};
  });
  assert.ok(frame.bounds && frame.radius>12 && frame.backwards>20,JSON.stringify(frame));
  await curve.fill('1000000');
  assert.match(await page.locator('.curve-range-error').last().textContent(),/wide t range/);
  assert.equal(await curve.getAttribute('aria-invalid'),'false');
  await curve.fill('2pi');
  assert.equal(await page.locator('.curve-range-error').last().textContent(),'');
  const values=[String.raw`\begin{bmatrix}1&2\\3&4\end{bmatrix}`,String.raw`\sqrt{-1}`,'1/3+1/6'];
  const draft={app:'proofpad',version:1,workspace:'calculator',draft:{entries:values.map(value=>({type:'math',value}))}};
  await page.locator('#draftFile').setInputFiles({name:'speech.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(draft))});
  await page.waitForFunction(()=>[...document.querySelectorAll('#rows .calc-result')].filter(el=>el.querySelector('svg')).length===3);
  const results=await page.locator('#rows [role=math].calc-result').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')));
  assert.equal(results.length,3);
  assert.match(results[0],/matrix.*row 1.*column 2/i);
  assert.match(results[1],/imaginary unit i/i);
  assert.doesNotMatch(results.join(' '),/[\\{}]/);
  const phone=await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  await phone.goto(url);
  await phone.waitForFunction(()=>!document.querySelector('main').inert);
  await phone.click('#graph3D');
  await phone.waitForFunction(()=>document.querySelector('#graphStatus').textContent.includes('Two fingers'));
  for(const id of ['#surfaceMesh','#greekShortcuts']){
   const b=await phone.locator(id).boundingBox();assert.ok(b.width>=24&&b.height>=24,id);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS '+engine+': partial LaTeX import, helix framing and names, wide ranges, spoken math, touch instructions and target sizes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
