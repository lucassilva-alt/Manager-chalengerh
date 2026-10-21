// L2: pênalti na tela — a favor (deslizar) e contra (escolher o canto).
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
  await page.goto(`${base}?dev=highlight&penalty=1&seed=2&quality=low${query}`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  return { page, errors };
}

test('pênalti a favor: abre no close da bola, sem Cancelar; deslizar bate', async () => {
  const { page, errors } = await open('');
  assert.equal(await page.evaluate(() => window.__hl.world().mode), 'penalty');
  assert.equal(await page.evaluate(() => window.__hl.mode()), 'shot');
  assert.equal(await page.getByRole('button', { name: 'Cancelar' }).count(), 0);
  await page.getByText('Deslize na bola para bater o pênalti').waitFor();
  await page.mouse.move(422, 370);
  await page.mouse.down();
  await page.mouse.move(470, 280, { steps: 4 });
  await page.mouse.move(520, 190, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'shot', null, { timeout: 5000 });
  await page.waitForFunction(() => window.__hl.world().status !== 'live', null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('pênalti contra: escolher o canto faz o batedor do jogo cobrar', async () => {
  const { page, errors } = await open('&defense=1');
  assert.equal(await page.evaluate(() => window.__hl.world().mode), 'penaltyDefense');
  await page.getByRole('button', { name: 'Pular à esquerda' }).click();
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'shot', null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__hl.world().penalty.diveDir), -1);
  await page.waitForFunction(() => window.__hl.world().status !== 'live', null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await page.close();
});
