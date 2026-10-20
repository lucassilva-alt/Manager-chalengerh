// V3: bonecos animados no lance — parado, corrida pela velocidade, chute e comemoração.
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
  await page.goto(`${base}?dev=highlight&seed=3`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  return { page, errors };
}
const anim = (page, id) => page.evaluate((id) => window.__hl.animOf(id), id);
const carrierId = (page) => page.evaluate(() => window.__hl.world().carrierId);

test('usa os bonecos animados; todos parados enquanto o lance espera', async () => {
  const { page, errors } = await open();
  assert.equal(await page.evaluate(() => window.__hl.usesModels()), true);
  assert.equal(await anim(page, await carrierId(page)), 'Idle_Loop');
  assert.deepEqual(errors, []);
  await page.close();
});

test('conduzir faz o jogador correr; ao parar volta ao parado', async () => {
  const { page } = await open();
  const id = await carrierId(page);
  await page.evaluate(() => window.__hl.input({ type: 'dribble', dir: { x: 1, y: 0 }, length: 6 }));
  await page.waitForFunction((id) => ['Jog_Fwd_Loop', 'Sprint_Loop'].includes(window.__hl.animOf(id)), id, { timeout: 10000 });
  await page.waitForFunction(() => window.__hl.world().awaitingInput, null, { timeout: 15000 });
  await page.waitForFunction((id) => window.__hl.animOf(id) === 'Idle_Loop', id, { timeout: 5000 });
  await page.close();
});

test('chutar dobra a perna do batedor', async () => {
  const { page } = await open();
  const id = await carrierId(page);
  await page.evaluate(() => {
    const w = window.__hl.world(); const c = w.agents.find((a) => a.id === w.carrierId);
    window.__hl.input({ type: 'shoot', dir: { x: 52.5 - c.pos.x, y: -c.pos.y }, power: 0.8, lift: 0.1 });
  });
  await page.waitForFunction((id) => window.__hl.kickOf(id) > 0.3, id, { timeout: 5000 });
  await page.close();
});

test('autor do gol comemora', async () => {
  const { page } = await open();
  const id = await carrierId(page);
  await page.evaluate(() => {
    const w = window.__hl.world(); const c = w.agents.find((a) => a.id === w.carrierId);
    w.lastKick = { type: 'shot', from: c.id, at: w.t, distance: 20 };
    w.status = 'goal';
  });
  await page.waitForFunction((id) => window.__hl.animOf(id) === 'Dance_Loop', id, { timeout: 5000 });
  await page.close();
});

test('goleiro mergulha inclinando o corpo para o lado do chute', async () => {
  const { page } = await open();
  const gk = await page.evaluate(() => window.__hl.world().agents.find((a) => a.role === 'GK' && a.side !== window.__hl.world().attackingSide).id);
  await page.evaluate(() => {
    const w = window.__hl.world(); const c = w.agents.find((a) => a.id === w.carrierId);
    window.__hl.input({ type: 'shoot', dir: { x: 52.5 - c.pos.x, y: 3.2 - c.pos.y }, power: 0.6, lift: 0.1 });
  });
  await page.waitForFunction((id) => window.__hl.diveOf(id) > 0.5, gk, { timeout: 8000 });
  await page.close();
});
