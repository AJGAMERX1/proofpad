// Exercise the paper-to-Lean flow using normal Proofpad draft files and UI.
const assert = require('node:assert/strict');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine = 'chromium', url = 'http://127.0.0.1:9221/'] = process.argv.slice(2);

(async () => {
  const browser = await playwright[engine].launch();
  try {
    const page = await browser.newPage({viewport:{width:375,height:750}});
    const errors = [];
    const checkerRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://live.lean-lang.org/**', route => {
      checkerRequests.push(route.request().url());
      return route.fulfill({contentType:'text/html', body:'<title>Lean transport fixture</title>'});
    });
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('main').inert);
    const paper = page.locator('#leanFromPaper');
    const source = page.locator('#leanSource');
    const current = () => source.inputValue();
    const openDraft = async draft => {
      await page.locator('#draftFile').setInputFiles({
        name:'work.proofpad.json', mimeType:'application/json',
        buffer:Buffer.from(JSON.stringify({app:'proofpad',workspace:'proofs',version:1,draft}))
      });
      await page.waitForFunction(title => document.querySelector('#title').value === title, draft.title);
    };
    await paper.click();
    assert(await page.locator('#leanReviewSave').isDisabled(), 'An empty proof has nothing to convert');
    await page.locator('#leanReviewClose').click();
    const oldSource = 'import Mathlib.Data.Real.Basic\nimport Mathlib.Tactic.Linarith\n\n-- Keep this edit\n';
    const draft = {
      title:'Solving an equation',
      leanSource:oldSource,
      statement:'Rearrange the given equation.',
      entries:[
        {type:'text',value:'Start from the given equation.'},
        {type:'math',value:'2x-3y=6'},
        {type:'math',value:'2x=3y+6'},
        {type:'math',value:'x=\\frac{3}{2}y+3'}
      ]
    };
    await openDraft(draft);
    await page.locator('#leanPanel summary').click();
    await page.locator('#leanUpdateImport').click();
    assert.equal(await current(), 'import Mathlib\n\n-- Keep this edit\n');
    assert(await page.locator('#leanLegacyImport').isHidden());
    await page.locator('#undoEdit').click();
    assert.equal(await current(), oldSource);
    await paper.click();
    assert.equal(await page.locator('#leanGoal').inputValue(),'step-4');
    assert.equal(await page.locator('#leanGivenChoices input:checked').count(),0);
    await page.locator('#leanGivenChoices input[value="step-2"]').check();
    const selected = await page.locator('#leanPreviewCode').textContent();
    assert.match(selected,/proofpadGiven1/);
    assert.match(selected,/Step 3/);
    assert.match(selected,/Start from the given equation/);
    assert.match(await page.locator('#leanNotesLabel').textContent(),/2/);
    const notes = page.locator('#leanReviewNotes summary');
    await notes.click();
    assert.match(await page.locator('#leanNotesList').textContent(),/Statement.*Step 1/s);
    assert(await page.locator('#leanReview').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    assert.equal(checkerRequests.length,0);
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#leanReviewSave').click();
    assert.equal(await current(),oldSource);
    assert(await page.locator('#leanReview').isVisible());
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#leanReviewCheck').click();
    await page.locator('#leanFrameHost iframe').waitFor();
    assert.equal(await current(),selected);
    assert.equal(decodeURIComponent(new URL(await page.locator('#leanExternal').getAttribute('href')).hash.slice(6)),selected);
    await page.locator('#leanClose').click();
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('main').inert);
    assert.equal(await current(),selected);
    assert.equal(await page.locator('#statement').inputValue(),draft.statement);
    assert.equal(await page.locator('#rows math-field').count(),4);
    await openDraft({title:'Parity',statement:'The sum of two even integers is even.',entries:[{type:'text',value:'Write each even integer as twice another integer.'}]});
    await paper.click();
    assert(await page.locator('#leanReviewCheck').isHidden());
    await page.getByRole('button',{name:'Open editable outline'}).click();
    const outline = await current();
    assert.match(outline,/sum of two even integers/);
    assert.match(outline,/twice another integer/);
    assert.match(outline,/theorem proofpad_result/);
    await page.locator('[data-mode="formulas"]').click();
    assert(await paper.isHidden());
    assert.deepEqual(errors,[]);
    console.log('PASS '+engine+' written proof, given selection, migration, cancel, online handoff, mobile, undo and prose outline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
