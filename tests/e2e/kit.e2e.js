// V2: uniforme pintado no boneco — camisa, calção, meião, chuteira, pele,
// número nas costas e goleiro com outra camisa e luvas. Confere pixels reais.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.js';

let server, browser, page;
before(async () => {
  server = await startServer();
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/?dev=kit`);
  await page.waitForFunction(() => window.__kit?.ready === true, null, { timeout: 20000 });
});
after(async () => { await browser?.close(); server?.close(); });

// Cor dominante do pixel: qual canal manda (tolerante à luz).
const dominant = ([r, g, b]) => (r > g * 1.3 && r > b * 1.3 ? 'r' : g > r * 1.2 && g > b * 1.2 ? 'g' : b > r * 1.3 && b > g * 1.1 ? 'b' : 'x');
const at = (id, p) => page.evaluate(({ id, p }) => window.__kit.colorAt(id, p), { id, p });

test('camisa vermelha, calção azul, meião verde no jogador de frente', async () => {
  assert.equal(dominant(await at('front', { x: 0, y: 1.25, z: 0.12 })), 'r', 'camisa');
  assert.equal(dominant(await at('front', { x: 0.08, y: 0.78, z: 0.1 })), 'b', 'calção');
  assert.equal(dominant(await at('front', { x: 0.11, y: 0.3, z: 0.06 })), 'g', 'meião');
});

test('chuteira escura e pele nas mãos', async () => {
  const boot = await at('front', { x: 0.11, y: 0.03, z: 0.15 });
  assert.ok(boot.every((c) => c < 90), `chuteira ${boot}`);
  // Pele varia por jogador; o tom é sempre vermelho > verde > azul.
  const hand = await at('front', { x: 0.85, y: 1.42, z: 0 });
  assert.ok(hand[0] > hand[1] && hand[1] > hand[2], `mão ${hand}`);
});

test('número branco nas costas', async () => {
  const back = await page.evaluate(() => window.__kit.numberPixels('back'));
  assert.ok(back.white > 20, `pixels brancos do número ${back.white}`);
  const front = await page.evaluate(() => window.__kit.numberPixels('front'));
  assert.ok(front.white < back.white / 4, 'número só nas costas');
});

test('goleiro usa camisa própria (amarela) e luvas', async () => {
  const shirt = await at('keeper', { x: 0, y: 1.25, z: 0.12 });
  assert.ok(shirt[0] > 150 && shirt[1] > 130 && shirt[2] < 110, `camisa do goleiro ${shirt}`);
  // Luva clara e neutra (branca sombreada).
  const glove = await at('keeper', { x: 0.85, y: 1.42, z: 0 });
  assert.ok(Math.min(...glove) > 120 && Math.max(...glove) - Math.min(...glove) < 25, `luva ${glove}`);
});
