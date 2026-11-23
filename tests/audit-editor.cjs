// Exercise actual MathLive input, including the audit's 60ms between keys.
const assert = require('node:assert/strict');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine = 'chromium', url = 'http://127.0.0.1:9221/'] = process.argv.slice(2);

(async () => {
 const browser = await playwright[engine].launch();
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('main').inert);
  const type = text => page.keyboard.type(text,{delay:60});
  const value = () => page.evaluate(() => savedFieldValue(active));
  const enter = () => page.keyboard.press('Enter');
  for (const workspace of ['proofs','formulas']) {
   if (workspace === 'formulas') {
    await page.click('[data-mode="formulas"]');
    await page.click('#addText');
   } else await page.locator('#rows math-field').first().click();
   await type('Let x_1 be the first term.');
   assert.equal(await value(),'\\text{Let }x_1\\text{ be the first term.}');
   await enter();await type('Let x^2, and x_2.');
   assert.equal(await value(),'\\text{Let }x^2\\text{, and }x_2\\text{.}');
   await enter();await type('Let x_2');
   await page.click('.toolbar [data-insert]');
   await type('and');
   assert.equal(await value(),'\\text{Let }x_2\\text{ and}');
   await enter();await type('Let x_1');await page.keyboard.press('ArrowRight');
   await type(' b');
   for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
   assert.equal(await page.evaluate(() => active.mode),'text');
   await type('more words');
   assert.equal(await value(),'\\text{Let }x_1\\text{more words}');
   await enter();await type('The sum is 17! and it is “small”.');
   assert.equal(await value(),'\\text{The sum is 17! and it is “small”.}');
   assert.equal(await page.evaluate(() => entries().at(-1).value), await value());
   const tokens = await page.evaluate(() => explanationTokens(entries().at(-1).value).map(x => x.latex).filter(Boolean));
   assert(tokens.includes('\\text{17!}'));assert(tokens.includes('\\text{“small”.}'));
   await enter();await page.click('#textMode');await type('x_2');
   assert.equal(await page.evaluate(() => active.mode),'math');
   assert(!/\\text/.test(await value()));
  }
  await page.reload();await page.waitForFunction(() => !document.querySelector('main').inert);
  assert((await page.evaluate(() => entries())).some(e => e.value.includes('17! and it is “small”.')));

  const examples = await browser.newPage({viewport:{width:360,height:790}});
  await examples.goto(url);await examples.waitForFunction(() => !document.querySelector('main').inert);
  const sample = key => examples.click('[data-example="'+key+'"]');
  await sample('telescoping');
  const longRow = examples.locator('#rows .row').nth(1);
  await longRow.locator('.equation-scroll-hint').waitFor({state:'visible'});
  assert(await longRow.locator('math-field').evaluate(field => {
   const content = field.shadowRoot.querySelector('[part="content"]');
   content.scrollLeft = 48;return content.scrollLeft > 0;
  }));
  await examples.reload();await examples.waitForFunction(() => !document.querySelector('main').inert);
  await sample('induction');await sample('logic');
  assert.equal(await examples.locator('#title').inputValue(),'A direct proof');
  assert.equal(await examples.locator('#rows .row').count(),3);
  await examples.locator('#title').fill('My modified proof');
  await sample('induction');
  assert.equal(await examples.locator('#title').inputValue(),'My modified proof');
  assert.equal(await examples.locator('#rows .row').count(),7);
  assert.deepEqual(errors,[]);
  console.log('PASS '+engine+' paragraphs, punctuation, scripts, backspace, draft reload, explicit math, proof examples and horizontal equation scrolling');
 } finally { await browser.close(); }
})().catch(error => { console.error(error);process.exitCode=1; });
