// Vista 3D do lance: roda o motor em passo fixo e desenha campo, bonecos e bola.
// Motor (x, y, z) → Three (x, z, y): y do motor vira a profundidade da cena.
import * as THREE from 'three';
import { stepWorld } from '../engine/highlight/highlight.js';
import { DT } from '../engine/highlight/physics.js';
import { createPitch } from './pitch.js';
import { createFigure, animateFigure } from './figure.js';

const CAMERA_OFFSET = new THREE.Vector3(-22, 28, 14);
const LOOK_AHEAD = 6;      // m à frente da bola, para o lado do ataque
const CAMERA_LERP = 3;     // suavização por segundo
const MAX_STEPS_PER_FRAME = 5;

export function createHighlightView(container, { world, teams }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9cc7e8');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-30, 60, 20);
  scene.add(sun, createPitch());

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  const focus = new THREE.Vector3(world.ball.pos.x + LOOK_AHEAD, 0, world.ball.pos.y);
  camera.position.copy(focus).add(CAMERA_OFFSET);
  camera.lookAt(focus);

  const figures = new Map();
  for (const a of world.agents) {
    const kit = teams[a.side].colors;
    const fig = createFigure({ ...kit, keeper: a.role === 'GK', skinIndex: a.id.length + Number(a.id.split('-').at(-1)) });
    fig.position.set(a.pos.x, 0, a.pos.y);
    figures.set(a.id, fig);
    scene.add(fig);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  scene.add(ball);

  let pending = null, acc = 0, last = performance.now(), raf = 0, frames = 0;
  const listeners = new Set();

  function resize() {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function draw(dt) {
    for (const a of world.agents) {
      const fig = figures.get(a.id);
      if (!fig) continue;
      fig.position.set(a.pos.x, 0, a.pos.y);
      const kicking = world.lastKick?.from === a.id && world.t - world.lastKick.at < 0.25;
      animateFigure(fig, { vx: a.vel.x, vy: a.vel.y, dt, kicking });
    }
    ball.position.set(world.ball.pos.x, world.ball.pos.z + 0.22, world.ball.pos.y);
    focus.lerp(new THREE.Vector3(world.ball.pos.x + LOOK_AHEAD, 0, world.ball.pos.y), Math.min(1, dt * CAMERA_LERP));
    camera.position.copy(focus).add(CAMERA_OFFSET);
    camera.lookAt(focus);
    renderer.render(scene, camera);
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS_PER_FRAME && world.status === 'live') {
      stepWorld(world, pending);
      pending = null;
      acc -= DT;
      steps++;
    }
    if (world.status !== 'live') acc = 0;
    draw(dt);
    frames++;
    for (const fn of listeners) fn(world);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    input(cmd) { pending = cmd; },
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    cameraTarget: () => ({ x: focus.x, y: focus.z }),
    figureCount: () => figures.size,
    frames: () => frames,
    camera, renderer,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
