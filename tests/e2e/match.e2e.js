// A23–A26: partida inteira pela interface — pré-jogo, partida em texto com
// controles, lance jogável, resultado do lance, intervalo, simular e fim.
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

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
  test(`partida completa em ${viewport.width}x${viewport.height}`, async () => {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?seed=1`);

    // Pré-jogo
    await page.getByText('Demo Azul').first().waitFor();
    await page.getByRole('button', { name: 'Jogar' }).click();

    // Partida em texto com controles — todos visíveis sem rolar a página
    await page.getByRole('button', { name: 'Pausar' }).waitFor();
    for (const name of ['Pausar', 'Aumentar ritmo de trabalho', 'Foco mais ofensivo', 'Acelerar']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      assert.ok(box.y + box.height <= viewport.height && box.x + box.width <= viewport.width, `${name} fora da tela: ${JSON.stringify(box)}`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem horizontal');
    await page.getByRole('button', { name: 'Aumentar ritmo de trabalho' }).click();
    assert.equal(await page.evaluate(() => window.__flow.match.tactics.home.workRate), 6);
    await page.getByRole('button', { name: 'Foco mais ofensivo' }).click();
    assert.equal(await page.evaluate(() => window.__flow.match.tactics.home.focus), 'attack');
    await page.getByRole('button', { name: 'Acelerar' }).click();
    assert.ok(await page.evaluate(() => window.__flow.speed) > 1);
    await page.evaluate(() => window.__flow.setSpeed(30));

    // Lance jogável: chuta direto e vê o resultado do lance
    await page.waitForFunction(() => window.__flow.state === 'highlight', null, { timeout: 60000 });
    await page.waitForFunction(() => window.__hl?.ready === true, null, { timeout: 15000 });
    await page.evaluate(() => {
      const w = window.__hl.world();
      const c = w.agents.find((a) => a.id === w.carrierId);
      window.__hl.input({ type: 'shoot', dir: { x: 52.5 - c.pos.x, y: 2 - c.pos.y }, power: 0.85, lift: 0.15, curl: 0 });
    });
    await page.locator('.hl-result').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForFunction(() => ['running', 'halftime', 'highlight', 'ended'].includes(window.__flow.state));

    // Os próximos lances são simulados pelo botão do lance; intervalo pelo botão
    for (let guard = 0; guard < 40; guard++) {
      const state = await page.evaluate(() => window.__flow.state);
      if (state === 'ended') break;
      if (state === 'highlight') await page.getByRole('button', { name: 'Simular lance' }).click();
      else if (state === 'halftime') await page.getByRole('button', { name: 'Começar 2º tempo' }).click();
      else if (state === 'highlightResult') await page.getByRole('button', { name: 'Continuar' }).click();
      else await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'Simular até o fim' }).click({ timeout: 2000 }).catch(() => {});

    // Resultado final
    await page.locator('.result-screen').waitFor({ timeout: 20000 });
    const shown = await page.locator('.result-score').innerText();
    const { home, away } = await page.evaluate(() => window.__flow.match.score);
    assert.match(shown.replace(/\s+/g, ' '), new RegExp(`${home}\\s*[x×-]\\s*${away}`));
    assert.deepEqual(errors, []);
    await page.close();
  });
}
