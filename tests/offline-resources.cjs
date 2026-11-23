// Open the standalone edition with networking disabled. Repeat with the browser's
// native gzip decoder disabled, to cover the bundled JavaScript fallback.
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const playwright=require(process.env.PROOFPAD_PLAYWRIGHT||'playwright');
const [engine='chromium',file]=process.argv.slice(2);
if(!file)throw Error('Pass a path to a standalone HTML build.');
(async()=>{
 const browser=await playwright[engine].launch();
 try{
  for(const fallback of [false,true]){
   const context=await browser.newContext({offline:true});
   const page=await context.newPage();
   if(fallback)await page.addInitScript(()=>{
    globalThis.DecompressionStream=undefined;
   });
   const network=[],errors=[];
   page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(file).href);
   await page.waitForFunction(()=>!document.querySelector('main').inert);
   await page.locator('#title').fill('telescope varible');
   await page.locator('#spellReview').click();
   await page.locator('#spellDialog[open]').waitFor();
   const issues=await page.locator('#spellResults').innerText();
   assert.match(issues,/varible/);
   assert.doesNotMatch(issues,/telescope/);
   assert(await page.evaluate(()=>dictionaryReady&&spellingWords.has('telescope')&&spellingWords.size>100000));
   await page.locator('#spellClose').click();
   const open=async(mode,values)=>{
    const entries=values.map(value=>({type:'math',value}));
    const draft={app:'proofpad',version:1,workspace:mode,draft:{entries}};
    await page.locator('#draftFile').setInputFiles({name:'calc.proofpad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(draft))});
   };
   // Exercise mode changes while the one shared decompression request is pending.
   await page.evaluate(()=>{
    const unpack=globalThis.unpackProofpadResource;
    const gate=new Promise(resolve=>{globalThis.releaseTestEngine=resolve;});
    globalThis.engineUnpacks=0;
    globalThis.unpackProofpadResource=async (encoded,size)=>{
     if(size===Number(document.querySelector('#offlineEngine').dataset.size)){
      globalThis.engineUnpacks++;
      await gate;
     }
     return unpack(encoded,size);
    };
   });
   await open('calculator',['1+1']);
   await page.waitForFunction(()=>globalThis.engineUnpacks===1);
   await open('surface',['z=x-y']);
   await page.waitForFunction(()=>calculatorPending?.dimension==='3d');
   await open('calculator',['12+30']);
   await page.waitForFunction(()=>calculatorPending?.values.includes('12+30'));
   await page.evaluate(()=>globalThis.releaseTestEngine());
   await page.waitForFunction(()=>document.querySelector('#rows .row')?.calcResult?.number===42);
   await open('surface',['z=x+y']);
   await page.waitForFunction(()=>graphSeries.some(s=>s.kind==='surface'));
   await open('calculator',['6*9']);
   await page.waitForFunction(()=>document.querySelector('#rows .row')?.calcResult?.number===54);
   assert.equal(await page.evaluate(()=>globalThis.engineUnpacks),1);
   assert.deepEqual(errors,[]);
   assert.deepEqual(network,[]);
   await context.close();
   console.log(engine,fallback?'bundled fallback':'native gzip','offline dictionary and 2D/3D calculator passed');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
