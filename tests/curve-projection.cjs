// Check the actual canvas pixels, including the PNG encoding, in a browser.
const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine = 'chromium', url = 'http://127.0.0.1:9221/'] = process.argv.slice(2);

(async () => {
 const browser = await playwright[engine].launch();
 try {
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('main').inert);
  const result = await page.evaluate(async () => {
   const width = 470, height = 340;
   const canvas = document.createElement('canvas');
   canvas.width = width; canvas.height = height;
   const ctx = canvas.getContext('2d', {willReadFrequently:true});
   const color = '#e60066';
   const helix = {kind:'curve', run:t => [t, Math.sin(t), Math.cos(t)], color,
    range:[-2*Math.PI, 2*Math.PI]};
   const surface = {kind:'surface', run:(x,y) => Math.sin(x)*Math.cos(y), color:'#046700',
    ramp:['#047400','#027300'], finish:'flat', grid:'off'};
   const view = {cx:0, cy:0, cz:0, span:14, yaw:Math.PI/2, pitch:0, mesh:false};
   const palette = {paper:'#fff', axis:'#444', grid:'#aaa', label:'#111', ramp:['#240','#840']};
   const paint = (series, camera = view) => paintSurfacePlot(ctx,width,height,series,camera,palette);

   // Looking along x removes the first coordinate: y² + z² must be one in
   // world units, for every colored pixel apart from the finite line width.
   paint([surface, helix]);
   const image = new Image();
   image.src = canvas.toDataURL('image/png');
   await image.decode();
   ctx.drawImage(image, 0, 0);
   const pixels = ctx.getImageData(0,0,width,height).data;
   const radius = surfaceProjection(width,height,view).scale;
   const buckets = new Set();
   let colored = 0, radialError = 0;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=4*(y*width+x);
    if(pixels[k]<210 || pixels[k+1]>34 || Math.abs(pixels[k+2]-102)>30)continue;
    const dx=x+.5-width/2,dy=y+.5-height/2;
    buckets.add(Math.floor((Math.atan2(dy,dx)+Math.PI)*24/(2*Math.PI))%24);
    radialError=Math.max(radialError,Math.abs(Math.hypot(dx,dy)-radius));
    colored++;
   }
   const samePixels = (a,b) => a.length===b.length && a.every((v,i)=>v===b[i]);
   const snapshot = () => ctx.getImageData(0,0,width,height).data;
   const orbit = {...view, yaw:.72, pitch:.52};
   paint([surface], orbit);
   const original = snapshot();
   paint([surface,{...helix,range:null}],orbit);
   const unchangedSurface = samePixels(original,snapshot());
   paint([surface,helix],orbit);
   const orbitHasCurve = !samePixels(original,snapshot());
   const heat = {...view,heatmap:true};
   paint([surface],heat);
   const originalHeat = snapshot();
   paint([surface,{...helix,run(){throw Error('Heat map tried to sample a curve.');}}],heat);
   const unchangedHeat = samePixels(originalHeat,snapshot());
   const offscreen = paint([{...helix,run:t=>[0,100+t,0]}]);
   const clipped = clipCurveSegment([-8,0,0],[8,0,0],[0,0,0],4);
   return {colored,buckets:buckets.size,radialError,unchangedSurface,orbitHasCurve,unchangedHeat,offscreen,clipped};
  });
  assert(result.colored>50 && result.buckets===24,'The series-color circle must be visible all around in the PNG.');
  assert(result.radialError<1.9,'Every colored pixel must be within the stroke width of a unit circle.');
  assert(result.unchangedSurface && result.orbitHasCurve && result.unchangedHeat);
  assert.equal(result.offscreen,false);
  assert.deepEqual(result.clipped,[.25,.75]);

  // Exercise the actual preset and export button as well as the renderer.
  await page.click('#graph3D');
  await page.waitForFunction(()=>graphSeries.some(s=>s.kind==='surface'));
  assert(await page.locator('#surfacePreset option[value="peaks"]').count());
  await page.selectOption('#surfacePreset',{label:'Helix'});
  await page.click('#graphExample');
  await page.waitForFunction(()=>graphSeries.some(s=>s.kind==='curve'));
  const curve=page.locator('#graphLegend button').filter({hasText:/^Curve /});
  assert.equal(await curve.getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#rows [data-curve-bound=min]').inputValue(),'-2π');
  assert.equal(await page.locator('#rows [data-curve-bound=max]').inputValue(),'2π');
  await page.click('#graphFit');
  await page.click('#surfaceViewX');
  assert.equal(await page.evaluate(()=>surfaceView.yaw===Math.PI/2 && surfaceView.pitch===0),true);
  const capture = async () => {
   const pending=page.waitForEvent('download');
   await page.click('#graphSave');
   const file=await pending;
   assert.equal(file.suggestedFilename(),'proofpad-3d-graph.png');
   return readFile(await file.path());
  };
  const withCurve=await capture();
  assert.equal(withCurve.subarray(1,4).toString(),'PNG');
  await curve.click();
  assert.equal(await curve.getAttribute('aria-pressed'),'false');
  assert(!withCurve.equals(await capture()),'The real PNG export must include the curve, including over an existing surface.');
  console.log('PASS '+engine+' Helix preset, end-on unit circle, mixed surface, legend toggle, PNG export, clipping and heat-map filtering.');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
