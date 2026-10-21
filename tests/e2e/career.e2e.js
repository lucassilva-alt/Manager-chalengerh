// Carreira: escolher clube real, central do clube, jogar a rodada, entrevista,
// classificação atualizada e continuar depois de recarregar a página.
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

test('nova carreira com o Palmeiras: rodada 1 → jogo → entrevista → rodada 2, e continua após recarregar', async () => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?seed=1&quality=low`);

  await page.getByRole('button', { name: 'Nova carreira' }).click();
  await page.getByRole('tab', { name: 'Série A' }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Série A' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.club-card').count(), 20);
  // Escudo real como imagem no cartão.
  assert.equal(await page.locator('.club-card img.crest').count(), 20);
  await page.getByRole('tab', { name: 'Série B' }).click();
  assert.equal(await page.locator('.club-card').count(), 20);
  await page.getByRole('tab', { name: 'Série A' }).click();
  await page.getByRole('button', { name: /Palmeiras/ }).click();
  await page.getByRole('button', { name: 'Começar carreira' }).click();

  // Central do clube
  await page.locator('.hub').waitFor();
  await page.getByText('Rodada 1 de 38').waitFor();
  await page.getByRole('heading', { name: 'Palmeiras' }).waitFor();
  await page.getByRole('button', { name: 'Ir para o jogo' }).click();

  // Pré-jogo com os dois escudos reais → partida simulada até o fim
  assert.equal(await page.locator('.pre-match img.crest').count(), 2);
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.evaluate(() => window.__flow.simulateRest());
  await page.locator('.result-screen').waitFor({ timeout: 20000 });
  const score = await page.evaluate(() => window.__flow.match.score);
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Entrevista
  await page.locator('.interview').waitFor();
  await page.locator('.interview button').first().click();

  // De volta à central: rodada 2 e Palmeiras com 1 jogo na tabela
  await page.getByText('Rodada 2 de 38').waitFor();
  await page.getByRole('tab', { name: 'Classificação' }).click();
  const row = page.locator('.league-table tr', { hasText: 'Palmeiras' });
  const cells = await row.locator('td').allInnerTexts();
  assert.ok(cells.includes('1'), `linha do Palmeiras: ${cells.join(' ')}`);
  const pal = await page.evaluate(() => JSON.parse(localStorage.getItem('mc.career.v1')).tables.A.palmeiras);
  assert.equal(pal.played, 1);
  assert.equal(pal.gf + pal.ga, score.home + score.away);

  // Recarregar: continua de onde parou
  await page.reload();
  await page.getByRole('button', { name: 'Continuar carreira' }).click();
  await page.getByText('Rodada 2 de 38').waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});
