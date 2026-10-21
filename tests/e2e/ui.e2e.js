// V9: interface estilo transmissão — fontes, placar com cores dos times,
// retratos no campo, nota colorida e HUD do lance.
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

async function matchPage() {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?seed=1&quality=low`);
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.getByRole('button', { name: 'Pausar' }).click();
  return { page, errors };
}

test('fontes Barlow carregadas e usadas no placar', async () => {
  const { page, errors } = await matchPage();
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() => [document.fonts.check('700 20px "Barlow Condensed"'), document.fonts.check('500 16px "Barlow"')]);
  assert.deepEqual(ok, [true, true]);
  const family = await page.locator('.sb-score').evaluate((el) => getComputedStyle(el).fontFamily);
  assert.match(family, /Barlow Condensed/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('placar mostra siglas com as cores dos times', async () => {
  const { page } = await matchPage();
  const tags = await page.locator('.sb-tag').evaluateAll((els) => els.map((e) => [e.textContent.trim(), getComputedStyle(e).backgroundColor]));
  assert.deepEqual(tags.map((t) => t[0]), ['AZU', 'VER']);
  assert.equal(tags[0][1], 'rgb(45, 95, 211)');
  assert.equal(tags[1][1], 'rgb(211, 58, 45)');
  await page.close();
});

test('campo mostra 11 retratos e notas coloridas pela faixa', async () => {
  const { page } = await matchPage();
  assert.equal(await page.locator('.chip-portrait svg').count(), 11);
  const classes = await page.locator('.chip-rating').evaluateAll((els) => els.map((e) => e.className));
  assert.ok(classes.every((c) => /rating-(good|mid|bad)/.test(c)), classes.join(' '));
  await page.close();
});

test('no lance: dica só quando é a vez do jogador; placar pequeno no canto', async () => {
  const { page } = await matchPage();
  await page.evaluate(() => { window.__flow.setSpeed(30); window.__flow.play(); });
  // Procura um lance de ataque (os de defesa são pulados aqui).
  for (let i = 0; i < 30; i++) {
    await page.waitForFunction(() => ['highlight', 'halftime'].includes(window.__flow.state), null, { timeout: 60000 });
    const st = await page.evaluate(() => [window.__flow.state, window.__flow.world?.mode]);
    if (st[0] === 'halftime') { await page.evaluate(() => window.__flow.startSecondHalf()); continue; }
    if (st[1] === 'attack') break;
    await page.evaluate(() => window.__flow.skipHighlight());
  }
  await page.waitForFunction(() => window.__hl?.ready === true && window.__hl.world() === window.__flow.world, null, { timeout: 20000 });
  await page.locator('.hl-scorebug').waitFor();
  assert.equal(await page.locator('.hl-hint').count(), 1);
  await page.evaluate(() => {
    const w = window.__hl.world(); const c = w.agents.find((a) => a.id === w.carrierId);
    window.__hl.input({ type: 'dribble', dir: { x: 1, y: 0 }, length: 6 });
  });
  await page.waitForFunction(() => !window.__hl.world().awaitingInput, null, { timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll('.hl-hint').length === 0, null, { timeout: 5000 });
  await page.close();
});
