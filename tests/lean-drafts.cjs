// Run against a built site. Edit this temporary browser profile through the UI.
const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine='chromium', url='http://127.0.0.1:9221/'] = process.argv.slice(2);

(async () => {
 const browser = await playwright[engine].launch();
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('main').inert);
  const editor = page.locator('#leanSource');
  const readEditor = () => editor.inputValue();
  const showEditor = async () => {
   if (!await editor.isVisible()) await page.locator('#leanPanel > summary').click();
  };
  const exportDraft = async () => {
   const pending = page.waitForEvent('download');
   await page.locator('#saveDraft').click();
   const download = await pending;
   return JSON.parse(await readFile(await download.path(), 'utf8'));
  };
  const openDraft = async data => {
   await page.locator('#draftFile').setInputFiles({
    name:'example.proofpad.json', mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(data)),
   });
   await page.waitForFunction(() => document.querySelector('#draftFile').value === '');
  };
  const theorem = 'theorem identity (P : Prop) (h : P) : P := by\n  exact h\n';
  await showEditor();
  assert.equal(await readEditor(), '');
  await editor.fill(theorem);
  const saved = await exportDraft();
  assert.equal(saved.draft.leanSource, theorem);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('main').inert);
  assert.equal(await readEditor(), theorem);

  await page.locator('[data-mode="formulas"]').click();
  assert.equal(await readEditor(), '');
  assert(!Object.hasOwn((await exportDraft()).draft, 'leanSource'));
  await page.locator('[data-mode="proofs"]').click();
  assert.equal(await readEditor(), theorem);
  await showEditor();
  await editor.fill(theorem + '-- note');
  await editor.press('Control+z');
  assert.equal(await readEditor(), theorem);
  assert(await editor.evaluate(input => input === document.activeElement));
  await editor.press('Control+Shift+z');
  assert.equal(await readEditor(), theorem + '-- note');

  // With only formal source, New proof must still retain a recoverable copy.
  await page.locator('#clear').click();
  assert.equal(await readEditor(), '');
  await page.locator('#storedCopies').click();
  await page.locator('#copyList button').filter({hasText:/^Open$/}).first().click();
  assert.equal(await readEditor(), theorem + '-- note');

  const legacy = structuredClone(saved);
  delete legacy.draft.leanSource;
  await openDraft(legacy);
  assert.equal(await readEditor(), '');
  await openDraft(saved);
  assert.equal(await readEditor(), theorem);
  for (const invalid of [12, null, 'x'.repeat(100001)]) {
   await openDraft({...saved, draft:{...saved.draft, leanSource:invalid}});
   assert.equal(await readEditor(), theorem);
   assert.match(await page.locator('#status').textContent(), /Could not open.*Lean source/);
  }
  assert.deepEqual(errors, []);
  console.log('PASS Lean draft reload, backup, legacy import, workspace isolation, undo/redo, new proof recovery and validation in '+engine);
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
