// A18/A19: cena 3D do lance — WebGL ativo, simulação andando, câmera
// seguindo a bola, 22 bonecos na cena e nenhum erro no console.
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

for (const viewport of [{ width: 844, height: 390 }, { width: 1366, height: 768 }]) {
  test(`lance 3D roda em ${viewport.width}x${viewport.height}`, async () => {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?dev=highlight&seed=3`);
    await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 15000 });

    const info = await page.evaluate(() => ({
      webgl: !!document.querySelector('canvas')?.getContext('webgl2'),
      figures: window.__hl.figureCount(),
    }));
    assert.equal(info.webgl, true);
    assert.equal(info.figures, 22);

    const camBefore = await page.evaluate(() => window.__hl.cameraTarget().x);
    await page.evaluate(() => window.__hl.input({ type: 'dribble', dir: { x: 1, y: 0 }, length: 6 }));
    // Por vez: a condução anda e o lance volta a pausar quando ela termina.
    await page.waitForFunction(() => window.__hl.world().t > 0.5 && window.__hl.world().awaitingInput, null, { timeout: 15000 });
    await page.waitForTimeout(1500); // câmera suaviza até a nova posição
    const camAfter = await page.evaluate(() => window.__hl.cameraTarget().x);
    assert.ok(camAfter > camBefore + 1, `câmera ${camBefore} → ${camAfter}`);
    assert.deepEqual(errors, []);
    await page.close();
  });
}
