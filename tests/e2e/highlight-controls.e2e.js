// A20–A22: controles reais na tela (mouse e toque) e sobreposições do lance.
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

async function open(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, ...opts });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?dev=highlight&seed=3`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return { page, errors };
}
const hl = (page, fn, arg) => page.evaluate(fn, arg);

test('começa pausado, com círculo de controle, corridas e nomes', async () => {
  const { page, errors } = await open();
  const o = await hl(page, () => ({ awaiting: window.__hl.world().awaitingInput, ...window.__hl.overlay() }));
  assert.equal(o.awaiting, true);
  assert.equal(o.circle, true);
  assert.ok(o.runs >= 2, `corridas ${o.runs}`);
  assert.ok(await page.locator('.hl-name').count() >= 5);
  assert.deepEqual(errors, []);
  await page.close();
});

test('arrastar com o mouse a partir do jogador conduz a bola', async () => {
  const { page, errors } = await open();
  const c = await hl(page, () => window.__hl.screenOf(window.__hl.world().carrierId));
  const x0 = await hl(page, () => window.__hl.world().agents.find((a) => a.id === window.__hl.world().carrierId).pos.x);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y - 20, { steps: 6 });
  assert.equal(await hl(page, () => window.__hl.overlay().arrow), true, 'seta verde durante o arrasto');
  await page.mouse.up();
  await page.waitForFunction((x) => {
    const w = window.__hl.world();
    return w.agents.find((a) => a.id === w.carrierId).pos.x > x + 1;
  }, x0, { timeout: 10000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('tocar num companheiro (toque) faz o passe', async () => {
  const { page, errors } = await open({ hasTouch: true, isMobile: true });
  const mate = await hl(page, () => {
    const w = window.__hl.world();
    // Companheiro que aparece na tela (alguns ficam fora do enquadramento).
    return w.agents
      .filter((a) => a.side === w.attackingSide && a.id !== w.carrierId && a.role !== 'GK')
      .map((a) => ({ id: a.id, ...window.__hl.screenOf(a.id) }))
      .find((s) => s.x > 40 && s.x < innerWidth - 40 && s.y > 40 && s.y < innerHeight - 40);
  });
  assert.ok(mate, 'algum companheiro visível');
  await page.touchscreen.tap(mate.x, mate.y);
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'pass', null, { timeout: 5000 });
  assert.equal(await hl(page, () => window.__hl.world().lastKick.to), mate.id);
  assert.deepEqual(errors, []);
  await page.close();
});

test('tocar no gol abre o close da bola; Cancelar volta; deslizar chuta', async () => {
  const { page, errors } = await open();
  const g = await hl(page, () => window.__hl.screenOfPoint({ x: 52.5, y: 0 }));
  await page.mouse.click(g.x, g.y);
  await page.waitForFunction(() => window.__hl.mode() === 'shot', null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Cancelar' }).click();
  assert.equal(await hl(page, () => window.__hl.mode()), 'play');

  await page.mouse.click(g.x, g.y);
  await page.waitForFunction(() => window.__hl.mode() === 'shot', null, { timeout: 5000 });
  await page.mouse.move(422, 370);
  await page.mouse.down();
  await page.mouse.move(430, 280, { steps: 4 });
  await page.mouse.move(440, 190, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__hl.world().lastKick?.type === 'shot', null, { timeout: 5000 });
  await page.waitForFunction(() => window.__hl.world().status !== 'live', null, { timeout: 10000 });
  assert.deepEqual(errors, []);
  await page.close();
});
