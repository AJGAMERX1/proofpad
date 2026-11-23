// Test Proofpad's authoring and transport. The fixture replaces the remote UI
// so this regression can run offline against a locally served build.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [engine = 'chromium', url = 'http://127.0.0.1:9221/'] = process.argv.slice(2);

async function download(page, button) {
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()]);
  return { name: file.suggestedFilename(), text: await fs.readFile(await file.path(), 'utf8') };
}

async function main() {
  const browser = await playwright[engine].launch();
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    const externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.route('https://live.lean-lang.org/**', route => {
      externalRequests.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: '<title>Transport fixture</title>' });
    });
    const panel = page.locator('#leanPanel');
    const source = page.locator('#leanSource');
    const open = async () => {
      if (!await panel.evaluate(element => element.open)) await panel.locator('summary').click();
      await source.waitFor({ state: 'visible' });
    };
    const expectSource = value => page.waitForFunction(expected =>
      document.querySelector('#leanSource').value === expected, value);

    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('main').inert);
    await open();
    await page.selectOption('#leanExample', 'substitution');
    assert.match(await source.inputValue(), /rw \[h\]/);
    await page.selectOption('#leanExample', 'algebra');
    assert.match(await source.inputValue(), /linarith/);

    // Include URL delimiters, Unicode and indentation to catch corrupt links.
    const sample = '-- Symbols in a comment: + & # = % ∀\nexample (x : Nat) : x = x := by\n  rfl\n';
    await page.locator('#leanFile').setInputFiles({ name: 'example.lean', mimeType: 'text/plain', buffer: Buffer.from(sample) });
    await expectSource(sample);
    const file = await download(page, page.locator('#leanDownload'));
    assert.match(file.name, /\.lean$/);
    assert.equal(file.text, sample);

    assert.equal(externalRequests.length, 0, 'Writing and exchanging .lean files must stay local');
    await page.locator('#leanCheck').click();
    await page.locator('#leanDialog[open]').waitFor();
    const frame = page.locator('#leanFrameHost iframe');
    await frame.waitFor({ state: 'attached' });
    const frameURL = new URL(await frame.getAttribute('src'));
    assert.equal(frameURL.origin, 'https://live.lean-lang.org');
    const encoded = /(?:^#|&)code=([^&]*)/.exec(frameURL.hash);
    assert(encoded, 'Expected the official editor’s documented #code argument');
    assert.equal(decodeURIComponent(encoded[1]), sample);
    assert.equal(new URL(await page.locator('#leanExternal').getAttribute('href')).href, frameURL.href);
    await page.locator('#leanClose').click();
    await frame.waitFor({ state: 'detached' });
    await expectSource(sample);
    await page.locator('#leanCheck').click();
    await page.locator('#leanReturnOpen').click();
    const edited = sample + '-- reviewed\n';
    await page.locator('#leanReturnSource').fill(edited);
    await page.locator('#leanReturnCancel').click();
    await expectSource(sample);
    await page.locator('#leanReturnOpen').click();
    await page.locator('#leanReturnSource').fill(edited);
    await page.locator('#leanReturnApply').click();
    await expectSource(edited);
    await frame.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: examples, .lean round-trip, private editing, checker handoff, cancellation and saving returned edits.`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
