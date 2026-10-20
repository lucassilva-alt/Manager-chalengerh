// Abrir e fechar lances não pode acumular memória de vídeo nem deixar a tela lenta.
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

test('fechar o lance libera texturas, malhas e o contexto WebGL', async () => {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.goto(`${base}?seed=1&quality=low`);
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.evaluate(() => window.__flow.setSpeed(30));
  await page.waitForFunction(() => window.__flow.state === 'highlight', null, { timeout: 60000 });
  await page.waitForFunction(() => window.__hl?.ready && window.__hl.world() === window.__flow.world, null, { timeout: 30000 });
  const before = await page.evaluate(() => window.__hl.gpuMemory());
  assert.ok(before.textures > 0 && before.geometries > 0);
  await page.evaluate(() => window.__flow.skipHighlight());
  await page.waitForFunction(() => !document.querySelector('.stage'));
  const afterDispose = await page.evaluate(() => window.__hl.gpuMemory());
  assert.equal(afterDispose.geometries, 0);
  // Fica só a DFG_LUT do Three.js: 16×16 (~1 KB), única para a biblioteca inteira.
  assert.ok(afterDispose.textures <= 1, `texturas ${afterDispose.textures}`);
  assert.equal(afterDispose.contextLost, true);
  await page.close();
});
