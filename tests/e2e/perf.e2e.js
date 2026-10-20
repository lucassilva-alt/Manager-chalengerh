// A27: orçamento de desempenho do lance. O FPS daqui é medido com WebGL por
// software (sem GPU) e só é registrado; as metas que valem em qualquer
// aparelho são as chamadas de desenho e o custo do motor por passo.
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

test('lance com 22 bonecos: chamadas de desenho e custo do motor dentro do orçamento', async () => {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.goto(`${base}?dev=highlight&seed=3`);
  await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 15000 });
  await page.evaluate(() => window.__hl.input({ type: 'dribble', dir: { x: 1, y: 0.2 }, length: 6 }));
  const f0 = await page.evaluate(() => window.__hl.frames());
  await page.waitForTimeout(4000);
  const f1 = await page.evaluate(() => window.__hl.frames());
  const fps = (f1 - f0) / 4;
  const { calls, triangles } = await page.evaluate(() => window.__hl.stats());

  // Custo do motor: 600 passos de um lance contínuo medidos no próprio navegador.
  const stepMs = await page.evaluate(async () => {
    const { createWorld, stepWorld } = await import('/src/engine/highlight/highlight.js');
    const w0 = window.__hl.world();
    const w = createWorld({
      agents: w0.agents.map((a) => ({ id: a.id, side: a.side, role: a.role, x: a.pos.x, y: a.pos.y, attrs: a.attrs })),
      carrierId: w0.carrierId, attackDir: 1, seed: 1, turnBased: false,
    });
    stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0 } });
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) stepWorld(w);
    return (performance.now() - t0) / 600;
  });

  console.log(JSON.stringify({ fpsSoftwareGL: Number(fps.toFixed(1)), drawCalls: calls, triangles, engineStepMs: Number(stepMs.toFixed(3)) }));
  assert.ok(calls <= 250, `chamadas de desenho ${calls}`);
  assert.ok(stepMs < 1, `motor ${stepMs} ms por passo`);
  await page.close();
});
