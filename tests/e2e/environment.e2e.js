// V4–V8: ambiente do lance — luz, céu, sombras, gramado, gols, estádio e bola.
// Confere a montagem; a qualidade visual é avaliada por prints.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.js';

let server, browser, info, errors = [];
before(async () => {
  server = await startServer();
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/?dev=highlight&seed=3&quality=high`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  info = await page.evaluate(() => window.__hl.environment());
});
after(async () => { await browser?.close(); server?.close(); });

test('V4: tone mapping filmico, sombras dos jogadores e céu', () => {
  assert.equal(info.toneMapping, 'ACESFilmic');
  assert.equal(info.shadows, true);
  assert.ok(info.shadowCasters >= 22, `sombras ${info.shadowCasters}`);
  assert.equal(info.sky, true);
});

test('V5: gramado com textura detalhada e mapa de relevo', () => {
  assert.ok(info.grass.size >= 2048, `textura ${info.grass.size}`);
  assert.equal(info.grass.normalMap, true);
});

test('V6: dois gols com traves redondas, rede e quatro bandeirinhas', () => {
  assert.equal(info.goals, 2);
  assert.equal(info.roundPosts, true);
  assert.equal(info.nets, 2);
  assert.equal(info.cornerFlags, 4);
});

test('V7: estádio com arquibancadas, cobertura, refletores, placas e torcida', () => {
  assert.ok(info.stands >= 4, `arquibancadas ${info.stands}`);
  assert.ok(info.roofs >= 2);
  assert.ok(info.floodlights >= 4);
  assert.ok(info.adBoards >= 8);
  assert.ok(info.crowd >= 3000, `torcedores ${info.crowd}`);
});

test('V8: bola com textura de gomos que gira com a velocidade', () => {
  assert.equal(info.ball.textured, true);
  assert.equal(info.ball.spins, true);
});

test('nenhum erro no console', () => {
  assert.deepEqual(errors, []);
});
