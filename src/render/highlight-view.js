// Vista 3D do lance: roda o motor em passo fixo, desenha campo, bonecos e bola,
// e transforma toque/mouse em comandos. Motor (x, y, z) → Three (x, z, y).
import * as THREE from 'three';
import { stepWorld } from '../engine/highlight/highlight.js';
import { DT } from '../engine/highlight/physics.js';
import { FIELD } from '../engine/highlight/field.js';
import { classifyGesture, swipeToShot } from '../input/gestures.js';
import { createPitch } from './pitch.js';
import { createFigure, animateFigure } from './figure.js';
import { createOverlays } from './overlays.js';

const CAMERA_OFFSET = new THREE.Vector3(-22, 28, 14);
const LOOK_AHEAD = 6;      // m à frente da bola, para o lado do ataque
const CAMERA_LERP = 3;     // suavização por segundo
const MAX_STEPS_PER_FRAME = 5;
const PICK_RADIUS = 1.6;   // m para acertar um jogador com o dedo
const GOAL_PICK = { fromX: FIELD.halfLength - 3, halfWidth: 9 };
const SHOT_CAMERA = { back: 2.6, height: 0.7 };

export function createHighlightView(container, { world, teams, onShotUi }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'hl-labels';
  container.appendChild(labelLayer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9cc7e8');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-30, 60, 20);
  scene.add(sun, createPitch());

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const focus = new THREE.Vector3(world.ball.pos.x + LOOK_AHEAD, 0, world.ball.pos.y);
  camera.position.copy(focus).add(CAMERA_OFFSET);
  camera.lookAt(focus);

  const names = {};
  for (const side of ['home', 'away']) for (const p of teams[side].lineup) names[p.id] = p.name;
  const figures = new Map();
  for (const a of world.agents) {
    const kit = teams[a.side].colors;
    const fig = createFigure({ ...kit, keeper: a.role === 'GK', skinIndex: Number(a.id.split('-').at(-1)) || 0 });
    fig.position.set(a.pos.x, 0, a.pos.y);
    figures.set(a.id, fig);
    scene.add(fig);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  scene.add(ball);
  const overlays = createOverlays(scene, labelLayer, names);

  let pending = null, acc = 0, last = performance.now(), raf = 0, frames = 0;
  let mode = 'play', drag = null, gesture = null;
  const listeners = new Set();

  // ---- projeções ----
  const rect = () => renderer.domElement.getBoundingClientRect();
  function project({ x, y, z = 0 }) {
    const v = new THREE.Vector3(x, z, y).project(camera), r = rect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }
  const raycaster = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function groundAt(clientX, clientY) {
    const r = rect();
    raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(ground, hit) ? { x: hit.x, y: hit.z } : null;
  }
  function agentAt(p) {
    let best = null, bestD = PICK_RADIUS;
    for (const a of world.agents) {
      const d = Math.hypot(a.pos.x - p.x, a.pos.y - p.y);
      if (d < bestD) { best = a.id; bestD = d; }
    }
    return best;
  }
  const goalAt = (p) => p.x > GOAL_PICK.fromX && Math.abs(p.y) < GOAL_PICK.halfWidth;

  // ---- entrada ----
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    const p = groundAt(e.clientX, e.clientY);
    gesture = { t0: performance.now(), start: p, screen: [{ x: e.clientX, y: e.clientY, t: 0 }] };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!gesture) return;
    gesture.screen.push({ x: e.clientX, y: e.clientY, t: performance.now() - gesture.t0 });
    if (mode === 'play') drag = groundAt(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!gesture) return;
    const g = gesture;
    gesture = null; drag = null;
    g.screen.push({ x: e.clientX, y: e.clientY, t: performance.now() - g.t0 });
    if (mode === 'shot') return shootFromSwipe(g.screen);
    const end = groundAt(e.clientX, e.clientY);
    if (!g.start || !end || !world.awaitingInput) return;
    const carrier = world.agents.find((a) => a.id === world.carrierId);
    if (!carrier || carrier.side !== world.attackingSide) return;
    const cmd = classifyGesture({
      start: g.start, end, duration: performance.now() - g.t0,
      startHit: agentAt(g.start), endHit: agentAt(end), goalHit: goalAt(end),
      carrierId: carrier.id, carrierPos: carrier.pos,
      teammates: world.agents.filter((a) => a.side === carrier.side).map((a) => a.id),
    });
    if (cmd?.type === 'aimShot') setMode('shot');
    else if (cmd) pending = cmd;
  });
  canvas.addEventListener('pointercancel', () => { gesture = null; drag = null; });

  function setMode(next) {
    mode = next;
    // Câmera muda na hora: um toque logo depois já usa o enquadramento novo.
    placeCamera(0);
    camera.updateMatrixWorld();
    onShotUi?.(next === 'shot');
  }
  function shootFromSwipe(points) {
    const s = swipeToShot(points, { width: rect().width, height: rect().height });
    if (!s) return;
    const carrier = world.agents.find((a) => a.id === world.carrierId);
    const aimY = s.aim * (FIELD.goalHalfWidth + 0.5);
    pending = {
      type: 'shoot', dir: { x: FIELD.halfLength - carrier.pos.x, y: aimY - carrier.pos.y },
      power: s.power, lift: s.lift, curl: s.curl,
    };
    setMode('play');
  }

  // ---- quadro ----
  function resize() {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function placeCamera(dt) {
    if (mode === 'shot') {
      // Close da bola, de frente para o gol.
      const b = world.ball.pos, goal = new THREE.Vector3(FIELD.halfLength, 1, 0);
      const dir = new THREE.Vector3(goal.x - b.x, 0, goal.z - b.y).normalize();
      camera.position.set(b.x - dir.x * SHOT_CAMERA.back, SHOT_CAMERA.height, b.y - dir.z * SHOT_CAMERA.back);
      camera.lookAt(goal);
      return;
    }
    focus.lerp(new THREE.Vector3(world.ball.pos.x + LOOK_AHEAD, 0, world.ball.pos.y), Math.min(1, dt * CAMERA_LERP));
    camera.position.copy(focus).add(CAMERA_OFFSET);
    camera.lookAt(focus);
  }

  function draw(dt) {
    for (const a of world.agents) {
      const fig = figures.get(a.id);
      fig.position.set(a.pos.x, 0, a.pos.y);
      fig.visible = !(mode === 'shot' && a.id === world.carrierId); // no close só bola e gol
      const kicking = world.lastKick?.from === a.id && world.t - world.lastKick.at < 0.25;
      animateFigure(fig, { vx: a.vel.x, vy: a.vel.y, dt: world.awaitingInput ? 0 : dt, kicking });
    }
    ball.position.set(world.ball.pos.x, world.ball.pos.z + 0.22, world.ball.pos.y);
    placeCamera(dt);
    overlays.update(world, { drag, project, mode });
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
    if (world.status !== 'live' || world.awaitingInput) acc = 0;
    draw(dt);
    frames++;
    for (const fn of listeners) fn(world);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    input(cmd) { pending = cmd; },
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    cancelShot: () => setMode('play'),
    mode: () => mode,
    overlay: () => overlays.state(),
    screenOf: (id) => { const a = world.agents.find((x) => x.id === id); return project({ x: a.pos.x, y: a.pos.y, z: 0.9 }); },
    screenOfPoint: (p) => project(p),
    cameraTarget: () => ({ x: focus.x, y: focus.z }),
    figureCount: () => figures.size,
    frames: () => frames,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      canvas.remove();
      labelLayer.remove();
    },
  };
}
