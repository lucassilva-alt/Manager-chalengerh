// L3: falta na tela — a favor (deslizar por cima da barreira) e contra (tamanho da barreira).
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
  await page.goto(`${base}?dev=highlight&freekick=1&seed=2&quality=low${query}`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  return { page, errors };
}

test('falta a favor: close da bola com a barreira à vista; deslizar bate', async () => {
  const { page, errors } = await open('');
  assert.equal(await page.evaluate(() => window.__hl.world().mode), 'freekick');
  assert.equal(await page.evaluate(() => window.__hl.mode()), 'shot');
  assert.equal(await page.getByRole('button', { name: 'Cancelar' }).count(), 0);
  await page.getByText('Deslize com força média para a bola passar por cima da barreira').waitFor();
  // Todos os jogadores da barreira aparecem na tela.
  const onScreen = await page.evaluate(() => {
    const w = window.__hl.world();
    return w.agents.filter((a) => a.inWall).map((a) => window.__hl.screenOf(a.id))
      .every((p) => p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight);
  });
  assert.equal(onScreen, true);
  await page.mouse.move(422, 370);
  await page.mouse.down();
  await page.mouse.move(430, 320, { steps: 4 });
  await page.mouse.move(440, 270, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'shot', null, { timeout: 5000 });
  await page.waitForFunction(() => window.__hl.world().status !== 'live', null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('falta contra: escolher a barreira de 5 faz o batedor do jogo cobrar', async () => {
  const { page, errors } = await open('&defense=1');
  assert.equal(await page.evaluate(() => window.__hl.world().mode), 'freekickDefense');
  await page.getByText('Escolha quantos jogadores vão na barreira').waitFor();
  await page.getByRole('button', { name: 'Barreira com 5' }).click();
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'shot', null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__hl.world().wall.size), 5);
  await page.waitForFunction(() => window.__hl.world().status !== 'live', null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await page.close();
});
