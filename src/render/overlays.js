// Sobreposições do lance: círculo de controle, anel do jogador com a bola,
// seta verde do arrasto, corridas tracejadas e nomes dos companheiros.
import * as THREE from 'three';

const GREEN = 0x5fd35f;
const Y = 0.03; // um pouco acima do gramado

export function createOverlays(scene, labelLayer, names) {
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  circle.rotation.x = -Math.PI / 2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.75, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.35), new THREE.MeshBasicMaterial({ color: GREEN, depthWrite: false }));
  shaft.rotation.x = -Math.PI / 2;
  const headGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -0.45), new THREE.Vector3(0, 0, 0.45), new THREE.Vector3(0.8, 0, 0),
  ]);
  const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: GREEN, side: THREE.DoubleSide, depthWrite: false }));
  arrow.add(shaft, head);
  const runMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.6, gapSize: 0.45, transparent: true, opacity: 0.9 });
  const pressMat = new THREE.LineDashedMaterial({ color: 0xe5484d, dashSize: 0.6, gapSize: 0.35 });
  const moveMat = new THREE.LineDashedMaterial({ color: 0xf2b33d, dashSize: 0.6, gapSize: 0.35 });
  const runs = new THREE.Group();
  // Defesa: anel vermelho no atacante com a bola e seta branca da jogada dele.
  const threat = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.0, 32),
    new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  threat.rotation.x = -Math.PI / 2;
  const intent = new THREE.Group();
  const intentShaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, transparent: true, opacity: 0.85 }));
  intentShaft.rotation.x = -Math.PI / 2;
  const intentHead = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false, transparent: true, opacity: 0.85 }));
  intent.add(intentShaft, intentHead);
  scene.add(circle, ring, arrow, runs, threat, intent);

  const labels = new Map();
  let state = { circle: false, arrow: false, runs: 0, threat: false, intent: false };

  function placeArrow(group, shaftMesh, headMesh, from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
    group.visible = len > 0.5;
    if (!group.visible) return;
    group.position.set(from.x, Y + 0.01, from.y);
    group.rotation.y = -Math.atan2(dy, dx);
    shaftMesh.scale.x = Math.max(0.1, len - 0.8);
    shaftMesh.position.x = shaftMesh.scale.x / 2;
    headMesh.position.x = shaftMesh.scale.x;
  }

  function line(from, to, mat) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(from.x, Y, from.y), new THREE.Vector3(to.x, Y, to.y)]), mat);
    l.computeLineDistances();
    runs.add(l);
  }

  function label(id) {
    if (!labels.has(id)) {
      const el = document.createElement('div');
      el.className = 'hl-name';
      el.textContent = names[id] ?? id;
      labelLayer.appendChild(el);
      labels.set(id, el);
    }
    return labels.get(id);
  }

  function setArrow(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
    arrow.visible = len > 0.3;
    if (!arrow.visible) return;
    arrow.position.set(from.x, Y + 0.01, from.y);
    arrow.rotation.y = -Math.atan2(dy, dx);
    shaft.scale.x = Math.max(0.1, len - 0.8);
    shaft.position.x = shaft.scale.x / 2;
    head.position.x = shaft.scale.x;
  }

  function updateDefense(world, { project }) {
    const carrier = world.agents.find((a) => a.id === world.carrierId);
    const attacking = carrier && carrier.side === world.attackingSide && world.status === 'live';
    circle.visible = false; ring.visible = false; arrow.visible = false;
    threat.visible = !!attacking;
    if (attacking) threat.position.set(carrier.pos.x, Y + 0.005, carrier.pos.y);
    intent.visible = false;
    if (attacking && carrier.target && !world.awaitingInput) placeArrow(intent, intentShaft, intentHead, carrier.pos, carrier.target);
    for (const l of runs.children) l.geometry.dispose();
    runs.clear();
    const seen = new Set();
    for (const a of world.agents) {
      if (a.side !== world.userSide || a.role === 'GK') continue;
      const order = world.orders[a.id];
      if (order?.type === 'press' && carrier) line(a.pos, carrier.pos, pressMat);
      else if (order?.type === 'move') line(a.pos, order.to, moveMat);
      else if (order?.type === 'mark') { const t = world.agents.find((x) => x.id === order.target); if (t) line(a.pos, t.pos, moveMat); }
      if (world.awaitingInput) {
        const p = project({ x: a.pos.x, y: a.pos.y, z: 2.2 });
        const el = label(a.id);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        el.hidden = false;
        seen.add(a.id);
      }
    }
    for (const [id, el] of labels) if (!seen.has(id)) el.hidden = true;
    state = { circle: false, arrow: false, runs: runs.children.length, threat: threat.visible, intent: intent.visible };
  }

  function update(world, opts) {
    if (world.mode === 'defense') return updateDefense(world, opts);
    threat.visible = false; intent.visible = false;
    const { drag, project, mode } = opts;
    const carrier = world.agents.find((a) => a.id === world.carrierId);
    const ours = carrier && carrier.side === world.attackingSide && world.status === 'live';
    const planning = ours && world.awaitingInput && mode === 'play';

    circle.visible = planning;
    if (planning) {
      circle.position.set(world.controlCenter.x, Y, world.controlCenter.y);
      circle.scale.setScalar(world.controlRadius);
    }
    ring.visible = !!ours;
    if (ours) ring.position.set(carrier.pos.x, Y + 0.005, carrier.pos.y);

    arrow.visible = false;
    if (planning && drag) setArrow(carrier.pos, drag);

    for (const line of runs.children) line.geometry.dispose();
    runs.clear();
    let runCount = 0;
    const seen = new Set();
    for (const a of world.agents) {
      if (!ours || a.side !== world.attackingSide || a.id === carrier.id || a.role === 'GK') continue;
      const goal = a.path[0] ?? a.target;
      if (planning && goal && Math.hypot(goal.x - a.pos.x, goal.y - a.pos.y) > 1) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.pos.x, Y, a.pos.y), new THREE.Vector3(goal.x, Y, goal.y)]),
          runMat,
        );
        line.computeLineDistances();
        runs.add(line);
        runCount++;
      }
      if (planning) {
        const p = project({ x: a.pos.x, y: a.pos.y, z: 2.2 });
        const el = label(a.id);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        el.hidden = false;
        seen.add(a.id);
      }
    }
    for (const [id, el] of labels) if (!seen.has(id)) el.hidden = true;
    state = { circle: circle.visible, arrow: arrow.visible, runs: runCount, threat: false, intent: false };
  }

  return { update, state: () => state };
}
