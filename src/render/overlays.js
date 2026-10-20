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
  const runs = new THREE.Group();
  scene.add(circle, ring, arrow, runs);

  const labels = new Map();
  let state = { circle: false, arrow: false, runs: 0 };

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

  function update(world, { drag, project, mode }) {
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
    state = { circle: circle.visible, arrow: arrow.visible, runs: runCount };
  }

  return { update, state: () => state };
}
