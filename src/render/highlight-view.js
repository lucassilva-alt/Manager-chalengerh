// Vista 3D do lance: roda o motor em passo fixo, desenha campo, bonecos e bola,
// e transforma toque/mouse em comandos. Motor (x, y, z) → Three (x, z, y).
import * as THREE from 'three';
import { stepWorld } from '../engine/highlight/highlight.js';
import { DT } from '../engine/highlight/physics.js';
import { createRecorder, frameAt } from '../engine/highlight/replay.js';
import { FIELD } from '../engine/highlight/field.js';
import { classifyGesture, classifyDefenseGesture, swipeToShot } from '../input/gestures.js';
import { createEnvironment } from './env/index.js';
import { createFigure, animateFigure } from './figure.js';
import { createPlayer } from './player-model.js';
import { createAnimator } from './player-animator.js';
import { createQualityGovernor, QUALITY } from './quality.js';
import { disposeScene } from './dispose.js';
import { createOverlays } from './overlays.js';

const CAMERA_OFFSET = new THREE.Vector3(-22, 28, 14);
const LOOK_AHEAD = 6;      // m à frente da bola, para o lado do ataque
const CORNER_FOCUS = (side) => ({ x: 44, y: side * 14 });
const CAMERA_LERP = 3;     // suavização por segundo
const MAX_STEPS_PER_FRAME = 12; // até 0,2 s de recuperação por quadro em aparelho lento
const PICK_RADIUS = 1.6;   // m para acertar um jogador com o dedo
const GOAL_PICK = { fromX: FIELD.halfLength - 3, halfWidth: 9 };
const SHOT_CAMERA = { back: 2.6, height: 0.7 };
const DIVE_TILT = 1.25;    // rad: goleiro quase deitado no ar
const DIVE_LIFT = 0.45;    // m
// Replay: TV em câmera lenta no lance todo, depois atrás do gol nos últimos segundos.
const REPLAY = { tvSpeed: 0.5, goalSpeed: 0.35, goalSeconds: 3, tvZoom: 0.65 };
const GOAL_CAMERA = { back: 7, height: 2.2 };

export function createHighlightView(container, { world, teams, onShotUi, asset = null, quality = null }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'hl-labels';
  container.appendChild(labelLayer);

  const scene = new THREE.Scene();
  const env = createEnvironment(renderer, scene, teams);
  // Qualidade automática: alto = sombras + resolução cheia; médio = sem sombras;
  // baixo = resolução reduzida e sem torcida.
  const PRESETS = {
    [QUALITY.HIGH]: { ratio: Math.min(2, window.devicePixelRatio || 1), shadows: true, crowd: true },
    [QUALITY.MEDIUM]: { ratio: 1, shadows: false, crowd: true },
    [QUALITY.LOW]: { ratio: 0.75, shadows: false, crowd: false },
  };
  const applyQuality = (level) => {
    const q = PRESETS[level];
    renderer.setPixelRatio(q.ratio);
    env.setQuality(q);
    resize?.();
  };
  const governor = createQualityGovernor({ fixed: quality, onChange: applyQuality });

  // Alcance cobre o céu (raio 380 m) mesmo com a câmera atrás do gol.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 800);
  const start = world.corner ? CORNER_FOCUS(world.corner.side) : { x: world.ball.pos.x + LOOK_AHEAD, y: world.ball.pos.y };
  const focus = new THREE.Vector3(start.x, 0, start.y);
  camera.position.copy(focus).add(CAMERA_OFFSET);
  camera.lookAt(focus);

  const names = {}, numbers = {};
  for (const side of ['home', 'away']) for (const p of teams[side].lineup) { names[p.id] = p.name; numbers[p.id] = p.number; }
  // Bonecos animados quando o modelo carregou; senão, os bonecos simples por código.
  const figures = new Map();
  for (const a of world.agents) {
    const kit = teams[a.side].colors;
    const keeper = a.role === 'GK';
    let fig;
    if (asset) {
      const player = createPlayer(asset, { kit, number: numbers[a.id] ?? 0, keeper, id: a.id });
      fig = { obj: player.root, animator: createAnimator(player) };
    } else {
      fig = { obj: createFigure({ ...kit, keeper, skinIndex: Number(a.id.split('-').at(-1)) || 0 }), animator: null };
    }
    fig.obj.position.set(a.pos.x, 0, a.pos.y);
    figures.set(a.id, fig);
    scene.add(fig.obj);
  }
  const overlays = createOverlays(scene, labelLayer, names);

  let pending = null, acc = 0, last = performance.now(), raf = 0, frames = 0;
  let mode = 'play', drag = null, gesture = null, netShaken = false, shotTaken = false;
  const listeners = new Set();
  const tape = createRecorder();
  tape.record(world);
  let replay = null; // { angle, t, end, frames }

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
    if (mode === 'shot') return shotTaken ? null : shootFromSwipe(g.screen);
    const end = groundAt(e.clientX, e.clientY);
    if (!g.start || !end || world.status !== 'live') return;
    if (world.mode === 'corner') {
      // Escanteio: o toque escolhe o alvo do cruzamento.
      if (world.corner?.phase === 'aim') pending = { type: 'cross', to: end };
      return;
    }
    if (world.mode === 'defense') {
      // Na defesa os comandos valem a qualquer momento do lance.
      const carrier = world.agents.find((a) => a.id === world.carrierId);
      if (!carrier || carrier.side !== world.attackingSide) return;
      const cmd = classifyDefenseGesture({
        start: g.start, end, duration: performance.now() - g.t0,
        startHit: agentAt(g.start), endHit: agentAt(end),
        carrierId: carrier.id, carrierPos: carrier.pos,
        defenders: world.agents.filter((a) => a.side === world.userSide && a.role !== 'GK'),
        opponents: world.agents.filter((a) => a.side === world.attackingSide).map((a) => a.id),
      });
      if (cmd) pending = cmd;
      return;
    }
    if (!world.awaitingInput) return;
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

  let shotAnchor = null;
  const setPiece = world.mode === 'penalty' || world.mode === 'freekick';
  function setMode(next) {
    mode = next;
    // Close do chute com âncora fixa: a câmera não corre atrás da bola.
    shotAnchor = next === 'shot' ? { x: world.ball.pos.x, y: world.ball.pos.y } : null;
    // Câmera muda na hora: um toque logo depois já usa o enquadramento novo.
    placeCamera(0);
    camera.updateMatrixWorld();
    onShotUi?.(next === 'shot');
  }
  function shootFromSwipe(points) {
    const s = swipeToShot(points, { width: rect().width, height: rect().height }, { freekick: world.mode === 'freekick' });
    if (!s) return;
    const carrier = world.agents.find((a) => a.id === world.carrierId);
    const aimY = s.aim * (FIELD.goalHalfWidth + 0.5);
    pending = {
      type: 'shoot', dir: { x: FIELD.halfLength - carrier.pos.x, y: aimY - carrier.pos.y },
      power: s.power, lift: s.lift, curl: s.curl,
    };
    if (!setPiece) setMode('play'); // na bola parada a câmera fica atrás da bola
    else shotTaken = true;
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
  applyQuality(governor.level);

  function placeCamera(dt, w = world) {
    if (mode === 'replay') return placeReplayCamera(dt, w);
    if (mode === 'shot') {
      // Close da bola, de frente para o gol.
      const b = shotAnchor ?? world.ball.pos, goal = new THREE.Vector3(FIELD.halfLength, 1, 0);
      const dir = new THREE.Vector3(goal.x - b.x, 0, goal.z - b.y).normalize();
      camera.position.set(b.x - dir.x * SHOT_CAMERA.back, SHOT_CAMERA.height, b.y - dir.z * SHOT_CAMERA.back);
      camera.lookAt(goal);
      return;
    }
    // Escanteio: enquadra a área antes do cruzamento.
    const look = world.corner?.phase === 'aim' ? CORNER_FOCUS(world.corner.side) : { x: world.ball.pos.x + LOOK_AHEAD, y: world.ball.pos.y };
    focus.lerp(new THREE.Vector3(look.x, 0, look.y), Math.min(1, dt * CAMERA_LERP));
    camera.position.copy(focus).add(CAMERA_OFFSET);
    camera.lookAt(focus);
  }

  function placeReplayCamera(dt, w) {
    const b = w.ball.pos;
    if (replay.angle === 'goal') {
      // Atrás do gol, olhando a bola vir.
      const goalX = FIELD.halfLength * w.attackDir;
      camera.position.set(goalX + w.attackDir * GOAL_CAMERA.back, GOAL_CAMERA.height, b.y * 0.3);
      camera.lookAt(b.x, Math.max(0.5, b.z), b.y);
      return;
    }
    focus.lerp(new THREE.Vector3(b.x, 0, b.y), Math.min(1, dt * CAMERA_LERP * 2));
    camera.position.copy(focus).addScaledVector(CAMERA_OFFSET, REPLAY.tvZoom);
    camera.lookAt(focus);
  }

  // Mundo do replay no instante t: posições gravadas + desfecho só no fim.
  function replayWorld(t) {
    const f = frameAt(replay.frames, t);
    const byId = new Map(f.agents.map((a) => [a.id, a]));
    const done = t >= replay.end - 1e-6;
    const kicked = world.lastKick && t >= world.lastKick.at;
    return {
      ...world, t, awaitingInput: false,
      status: done ? world.status : 'live',
      dive: kicked ? world.dive : null,
      lastKick: kicked ? world.lastKick : null,
      ball: { pos: f.ball, vel: f.ballVel, spin: 0 },
      agents: world.agents.map((a) => ({ ...a, pos: byId.get(a.id)?.pos ?? a.pos, vel: byId.get(a.id)?.vel ?? { x: 0, y: 0 } })),
    };
  }

  function startReplay() {
    const recorded = tape.frames();
    if (world.status === 'live' || recorded.length < 2) return false;
    const end = recorded.at(-1).t;
    replay = { angle: 'tv', t: recorded[0].t, end, frames: recorded };
    netShaken = false;
    mode = 'replay';
    return true;
  }
  function stopReplay() {
    replay = null;
    mode = 'play';
    placeCamera(0);
  }
  function advanceReplay(dt) {
    const speed = replay.angle === 'tv' ? REPLAY.tvSpeed : REPLAY.goalSpeed;
    replay.t += dt * speed;
    if (replay.t >= replay.end) {
      if (replay.angle === 'goal') return stopReplay();
      replay.angle = 'goal';
      replay.t = Math.max(replay.frames[0].t, replay.end - REPLAY.goalSeconds);
      netShaken = false;
    }
    draw(dt * speed, replayWorld(replay.t));
  }

  function draw(dt, w = world) {
    for (const a of w.agents) {
      const { obj, animator } = figures.get(a.id);
      obj.position.set(a.pos.x, 0, a.pos.y);
      obj.visible = !(mode === 'shot' && a.id === w.carrierId); // no close só bola e gol
      if (animator) {
        // Correndo: olha para onde vai; parado: olha para a bola.
        const speed = Math.hypot(a.vel.x, a.vel.y);
        const look = speed > 0.3 && !w.awaitingInput ? a.vel : { x: w.ball.pos.x - a.pos.x, y: w.ball.pos.y - a.pos.y };
        obj.rotation.y = Math.atan2(look.x, look.y);
        animator.update(a, w, dt);
        // Mergulho: deita o corpo para o lado do pulo e tira do chão.
        const d = animator.dive;
        if (d > 0 && w.dive?.dir) {
          const sideOfModelX = -Math.sin(obj.rotation.y) * w.dive.dir; // + = pulo para a direita do goleiro
          obj.rotation.z = -Math.sign(sideOfModelX) * DIVE_TILT * d;
          obj.position.y = DIVE_LIFT * Math.sin(d * Math.PI / 2);
        } else {
          obj.rotation.z = 0;
        }
      } else {
        const kicking = w.lastKick?.from === a.id && w.t - w.lastKick.at < 0.25;
        animateFigure(obj, { vx: a.vel.x, vy: a.vel.y, dt: w.awaitingInput ? 0 : dt, kicking });
      }
    }
    if (w.status === 'goal' && !netShaken) { env.netHit(w.attackDir); netShaken = true; }
    placeCamera(dt, w);
    env.update(w.awaitingInput ? dt * 0.2 : dt, focus, w.ball);
    overlays.update(w, { drag, project, mode });
    renderer.render(scene, camera);
  }

  function frame(now) {
    governor.frame(now - last);
    const dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS_PER_FRAME && world.status === 'live') {
      stepWorld(world, pending);
      pending = null;
      acc -= DT;
      steps++;
    }
    if (steps) tape.record(world);
    if (world.status !== 'live' || world.awaitingInput) acc = 0;
    if (replay) advanceReplay(dt); else draw(dt);
    frames++;
    for (const fn of listeners) fn(world);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  if (setPiece) setMode('shot'); // pênalti e falta começam no close da bola

  return {
    world: () => world,
    input(cmd) { pending = cmd; },
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    cancelShot: () => setMode('play'),
    replay: startReplay,
    skipReplay: () => { if (replay) stopReplay(); },
    replaying: () => !!replay,
    replayAngle: () => replay?.angle ?? null,
    replayTime: () => replay?.t ?? null,
    mode: () => mode,
    overlay: () => overlays.state(),
    screenOf: (id) => { const a = world.agents.find((x) => x.id === id); return project({ x: a.pos.x, y: a.pos.y, z: 0.9 }); },
    screenOfPoint: (p) => project(p),
    cameraTarget: () => ({ x: focus.x, y: focus.z }),
    figureCount: () => figures.size,
    usesModels: () => !!asset,
    quality: () => governor.level,
    gpuMemory: () => ({ ...renderer.info.memory, contextLost: renderer.getContext().isContextLost() }),
    debugScene: () => scene,
    animOf: (id) => figures.get(id)?.animator?.clip ?? null,
    kickOf: (id) => figures.get(id)?.animator?.kick ?? 0,
    diveOf: (id) => figures.get(id)?.animator?.dive ?? 0,
    animWeight: (id) => figures.get(id)?.animator?.weight ?? 0,
    frames: () => frames,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    environment: () => {
      let shadowCasters = 0;
      scene.traverse((o) => { if (o.castShadow) shadowCasters++; });
      return {
        toneMapping: renderer.toneMapping === THREE.ACESFilmicToneMapping ? 'ACESFilmic' : String(renderer.toneMapping),
        shadows: renderer.shadowMap.enabled, shadowCasters, ...env.info(),
      };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposeScene(scene);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // devolve o contexto WebGL já, sem esperar a coleta de lixo
      canvas.remove();
      labelLayer.remove();
    },
  };
}
