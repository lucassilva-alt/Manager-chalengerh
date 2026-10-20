// A1: a casca abre sem erro no console e as bibliotecas fixadas carregam.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.js';

let server, browser, base;
before(async () => {
  server = await startServer();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`casca abre sem erros em ${viewport.width}x${viewport.height}`, async () => {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base);
    await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 10000 });
    const libs = await page.evaluate(() => window.__app.libs);
    assert.equal(libs.three, '186');
    assert.equal(libs.preact, true);
    assert.equal(await page.locator('#app').count(), 1);
    assert.deepEqual(errors, []);
    await page.close();
  });
}
