// L4: escanteio na tela — a favor (tocar o alvo, cabecear no tempo) e contra (afastar).
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

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?dev=highlight&corner=1&seed=2&quality=low${query}`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  return { page, errors };
}

test('escanteio a favor: área à vista; tocar nela cruza; botão cabeceia', async () => {
  const { page, errors } = await open('');
  assert.equal(await page.evaluate(() => window.__hl.world().mode), 'corner');
  await page.getByText('Toque na área para onde cruzar').waitFor();
  // Marca do pênalti visível na tela, e um toque nela vira o alvo do cruzamento.
  const spot = await page.evaluate(() => window.__hl.screenOfPoint({ x: 46, y: 0, z: 0 }));
  assert.ok(spot.x > 0 && spot.x < 844 && spot.y > 0 && spot.y < 390, JSON.stringify(spot));
  await page.mouse.click(spot.x, spot.y);
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'cross', null, { timeout: 5000 });
  const to = await page.evaluate(() => window.__hl.world().corner.target);
  assert.ok(Math.hypot(to.x - 46, to.y) < 4, JSON.stringify(to));
  // Círculo do tempo do cabeceio aparece sobre o alvo.
  assert.equal(await page.evaluate(() => window.__hl.overlay().timing), true);
  await page.getByRole('button', { name: 'Cabecear no meio' }).click();
  assert.notEqual(await page.evaluate(() => window.__hl.world().corner?.pressAt ?? 'resolvido'), null);
  await page.waitForFunction(() => window.__hl.world().status !== 'live' || window.__hl.world().corner === null, null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('escanteio contra: Cobrar faz o jogo cruzar e Afastar vale na hora', async () => {
  const { page, errors } = await open('&defense=1');
  assert.equal(await page.evaluate(() => window.__hl.world().mode), 'cornerDefense');
  await page.getByRole('button', { name: 'Cobrar' }).click();
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'cross', null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Afastar' }).click();
  assert.notEqual(await page.evaluate(() => window.__hl.world().corner?.pressAt ?? 'resolvido'), null);
  await page.waitForFunction(() => window.__hl.world().status !== 'live' || window.__hl.world().corner === null, null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await page.close();
});
