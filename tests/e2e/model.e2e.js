// V1: o navegador carrega o boneco com esqueleto e todas as animações do jogo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.js';
import { PLAYER_CLIPS } from '../../src/render/player-clips.js';

let server, browser, base;
before(async () => {
  server = await startServer();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
});
after(async () => { await browser?.close(); server?.close(); });

test('player.glb carrega no navegador com malha com esqueleto e as animações', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() => window.__app?.ready === true);
  const info = await page.evaluate(async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync('assets/models/player.glb');
    let skinned = 0, bones = 0;
    gltf.scene.traverse((o) => { if (o.isSkinnedMesh) { skinned++; bones = o.skeleton.bones.length; } });
    return { skinned, bones, clips: gltf.animations.map((a) => a.name).sort() };
  });
  assert.ok(info.skinned >= 1);
  assert.ok(info.bones >= 40);
  assert.deepEqual(info.clips, [...PLAYER_CLIPS].sort());
  assert.deepEqual(errors, []);
  await page.close();
});
