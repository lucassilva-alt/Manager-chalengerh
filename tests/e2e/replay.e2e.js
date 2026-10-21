// L5: replay do lance — câmera lenta, dois ângulos (TV e atrás do gol).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.js';

let server, browser, base;
before(async () => {
  server = await startServer();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
});
after(async () => { await browser?.close(); server?.close(); });

async function finishedPenalty() {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?dev=highlight&penalty=1&seed=2&quality=low`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 20000 });
  await page.evaluate(() => window.__hl.input({ type: 'shoot', dir: { x: 11, y: 2.5 }, power: 0.8, lift: 0.1, curl: 0 }));
  await page.waitForFunction(() => window.__hl.world().status !== 'live', null, { timeout: 15000 });
  return { page, errors };
}

test('replay: câmera lenta pela TV e depois atrás do gol, com selo REPLAY', async () => {
  const { page, errors } = await finishedPenalty();
  assert.equal(await page.getByRole('button', { name: 'Ver replay' }).count(), 1);
  await page.getByRole('button', { name: 'Ver replay' }).click();
  await page.locator('.hl-replay-badge').waitFor();
  assert.equal(await page.evaluate(() => window.__hl.mode()), 'replay');
  assert.equal(await page.evaluate(() => window.__hl.replayAngle()), 'tv');
  // Câmera lenta: o relógio do replay anda mais devagar que o real.
  const t0 = await page.evaluate(() => [window.__hl.replayTime(), performance.now()]);
  await page.waitForTimeout(800);
  const t1 = await page.evaluate(() => [window.__hl.replayTime(), performance.now()]);
  assert.ok((t1[0] - t0[0]) < 0.75 * ((t1[1] - t0[1]) / 1000), `replay ${t1[0] - t0[0]}s em ${(t1[1] - t0[1]) / 1000}s`);
  await page.waitForFunction(() => window.__hl.replayAngle() === 'goal', null, { timeout: 30000 });
  await page.waitForFunction(() => window.__hl.mode() !== 'replay', null, { timeout: 30000 });
  assert.equal(await page.locator('.hl-replay-badge').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Ver replay' }).count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('replay: Pular replay volta na hora', async () => {
  const { page, errors } = await finishedPenalty();
  await page.getByRole('button', { name: 'Ver replay' }).click();
  await page.getByRole('button', { name: 'Pular replay' }).click();
  await page.waitForFunction(() => window.__hl.mode() !== 'replay', null, { timeout: 3000 });
  assert.equal(await page.locator('.hl-replay-badge').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});
