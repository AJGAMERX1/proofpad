// Optional network smoke test. Open the public editor once, through Proofpad,
// and read the feedback a user sees for these synthetic examples.
const assert = require('node:assert/strict');
const playwright = require(process.env.PROOFPAD_PLAYWRIGHT || 'playwright');
const [url = 'http://127.0.0.1:9221/'] = process.argv.slice(2);

async function main() {
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('main').inert);
    await page.locator('#leanPanel summary').click();
    await page.locator('#leanExample').selectOption('algebra');
    const source = [
      await page.locator('#leanSource').inputValue(),
      '#check isolate_x',
      'theorem proofpad_identity (n : Nat) : n = n := by rfl',
      'example : 1 = 2 := by rfl',
      'example : True := by sorry',
      '#check proofpad_identity',
    ].join('\n');
    await page.locator('#leanSource').fill(source);
    await page.locator('#leanCheck').click();
    const editor = page.frameLocator('#leanFrameHost iframe');
    const info = editor.frameLocator('iframe');
    const allMessages = info.locator('summary').filter({ hasText: 'All Messages' });
    await allMessages.waitFor({ timeout: 90000 });
    const intro = editor.getByRole('button', { name: "Don't show this again" });
    if (await intro.isVisible()) await intro.click();
    if (!await allMessages.evaluate(element => element.parentElement.open)) {
      await allMessages.click();
    }
    await info.getByText(/Tactic .rfl. failed/).first().waitFor({ timeout: 90000 });
    const messages = allMessages.locator('..');
    await messages.getByText(/proofpad_identity\s*\(n/).first().waitFor({ timeout: 90000 });
    const feedback = (await messages.innerText()).replace(/\s+/g, ' ');
    assert.match(feedback, /isolate_x\s*\(x y\s*:\s*ℝ\)/);
    assert.doesNotMatch(feedback, /deprecated/i);
    assert.match(feedback, /proofpad_identity\s*\(n\s*:\s*(?:Nat|ℕ)\)\s*:\s*n\s*=\s*n/);
    assert.match(feedback, /declaration uses .sorry./i);
    await page.locator('#leanClose').click();
    await page.locator('#leanFrameHost iframe').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#leanSource').inputValue(), source);
    console.log('PASS live Lean editor checks the algebra example without deprecation warnings and distinguishes valid, invalid and unfinished proofs.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
