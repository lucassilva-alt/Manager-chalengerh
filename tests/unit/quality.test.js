import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQualityGovernor, QUALITY } from '../../src/render/quality.js';

const feed = (gov, ms, n) => { for (let i = 0; i < n; i++) gov.frame(ms); };

test('começa na qualidade alta', () => {
  assert.equal(createQualityGovernor().level, QUALITY.HIGH);
});

test('quadros lentos baixam um nível de cada vez, até o mínimo', () => {
  const gov = createQualityGovernor();
  feed(gov, 60, 40);
  assert.equal(gov.level, QUALITY.MEDIUM);
  feed(gov, 60, 40);
  assert.equal(gov.level, QUALITY.LOW);
  feed(gov, 60, 200);
  assert.equal(gov.level, QUALITY.LOW);
});

test('quadros rápidos mantêm a qualidade; um pico isolado não derruba', () => {
  const gov = createQualityGovernor();
  feed(gov, 14, 60);
  gov.frame(200);
  feed(gov, 14, 30);
  assert.equal(gov.level, QUALITY.HIGH);
});

test('volta a subir só depois de bastante tempo rápido (sem ficar pulando)', () => {
  const gov = createQualityGovernor();
  feed(gov, 60, 40);
  assert.equal(gov.level, QUALITY.MEDIUM);
  feed(gov, 14, 60);
  assert.equal(gov.level, QUALITY.MEDIUM, 'ainda não sobe');
  feed(gov, 14, 300);
  assert.equal(gov.level, QUALITY.HIGH);
});

test('nível fixado (ex.: ?quality=high) não muda', () => {
  const gov = createQualityGovernor({ fixed: QUALITY.HIGH });
  feed(gov, 80, 300);
  assert.equal(gov.level, QUALITY.HIGH);
});

test('avisa quando o nível muda', () => {
  const changes = [];
  const gov = createQualityGovernor({ onChange: (l) => changes.push(l) });
  feed(gov, 60, 40);
  assert.deepEqual(changes, [QUALITY.MEDIUM]);
});
