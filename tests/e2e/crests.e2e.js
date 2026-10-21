// E1: escudos reais carregam como imagem; escudo ausente cai no desenhado.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { startServer } from './server.js';

let server, browser, base;
before(async () => {
  server = await startServer();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

test('galeria: todos os escudos importados aparecem, sem imagem quebrada', async () => {
  const { crests } = JSON.parse(await readFile('assets/crests/br/index.json', 'utf8'));
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?dev=crests`);
  await page.locator('img.crest').first().waitFor();
  await page.waitForFunction((n) => {
    const imgs = [...document.querySelectorAll('img.crest')];
    return imgs.length === n && imgs.every((i) => i.complete);
  }, Object.keys(crests).length, { timeout: 30000 });
  const broken = await page.evaluate(() => [...document.querySelectorAll('img.crest')].filter((i) => !i.naturalWidth).map((i) => i.alt));
  assert.deepEqual(broken, []);
  const palmeiras = page.getByRole('img', { name: 'palmeiras', exact: true });
  assert.equal(await palmeiras.evaluate((i) => i.tagName), 'IMG');
  // Escudo que não existe: volta ao escudo desenhado (svg), sem erro na tela.
  await page.locator('svg.crest[aria-label="Sem escudo"]').waitFor();
  assert.deepEqual(errors.filter((e) => !/nao-existe/.test(e) && !/404/.test(e)), []);
  await page.close();
});
