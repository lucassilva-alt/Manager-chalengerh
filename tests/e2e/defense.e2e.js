// L1: lance de defesa na tela.
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

async function open() {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?dev=highlight&defense=1&seed=2&quality=low`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  return { page, errors };
}

test('defesa: marcador vermelho no atacante, seta da jogada, dica e Começar', async () => {
  const { page, errors } = await open();
  assert.equal(await page.evaluate(() => window.__hl.world().mode), 'defense');
  const o = await page.evaluate(() => window.__hl.overlay());
  assert.equal(o.threat, true, 'marcador vermelho no atacante com a bola');
  assert.equal(o.circle, false, 'sem círculo de condução na defesa');
  await page.getByText('Toque no atacante com a bola').waitFor();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.waitForFunction(() => !window.__hl.world().awaitingInput);
  await page.waitForFunction(() => window.__hl.overlay().intent === true, null, { timeout: 8000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('defesa: tocar no atacante com a bola manda o defensor mais perto dar o bote', async () => {
  const { page, errors } = await open();
  const c = await page.evaluate(() => window.__hl.screenOf(window.__hl.world().carrierId));
  await page.mouse.click(c.x, c.y);
  await page.waitForFunction(() => Object.values(window.__hl.world().orders).some((o) => o.type === 'press'), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__hl.world().awaitingInput), false, 'o comando já solta o lance');
  assert.deepEqual(errors, []);
  await page.close();
});

test('partida: resultado do lance de defesa fala do ponto de vista de quem defende', async () => {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.goto(`${base}?seed=3&quality=low`);
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.evaluate(() => window.__flow.setSpeed(30));
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    await page.waitForFunction(() => ['highlight', 'halftime', 'ended'].includes(window.__flow.state), null, { timeout: 60000 });
    const st = await page.evaluate(() => [window.__flow.state, window.__flow.world?.mode]);
    if (st[0] === 'ended') break;
    if (st[0] === 'halftime') { await page.evaluate(() => window.__flow.startSecondHalf()); continue; }
    if (st[1] === 'defense') {
      await page.waitForFunction(() => window.__hl?.ready && window.__hl.world() === window.__flow.world, null, { timeout: 20000 });
      await page.evaluate(() => { window.__hl.world().status = 'lost'; });
      await page.locator('.hl-result').getByText('Defendido!').waitFor({ timeout: 10000 });
      found = true;
    } else {
      await page.evaluate(() => window.__flow.skipHighlight());
    }
  }
  assert.ok(found, 'apareceu um lance de defesa na partida');
  await page.close();
});
