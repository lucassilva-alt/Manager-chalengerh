// Estádio: arquibancadas em degraus (dois anéis nas laterais), cobertura,
// refletores, placas de publicidade (marcas fictícias) e torcida instanciada.
import * as THREE from 'three';
import { FIELD } from '../../engine/highlight/field.js';

const GAP_SIDE = 9;          // m da linha lateral até a arquibancada
const GAP_END = 10;          // m da linha de fundo até a arquibancada
const ROW_DEPTH = 0.85, ROW_RISE = 0.45, SEAT_SPACING = 0.6;
const BRANDS = [
  ['TORRÃO CAFÉ', '#5a3420', '#f2d7a0'], ['VELA AZUL', '#123c7a', '#ffffff'], ['RIO NORTE TELECOM', '#0f7a5c', '#e9fff6'],
  ['BRASA GRILL', '#b5301f', '#ffe1a8'], ['ÁGUA CLARA', '#e8f6ff', '#1269a8'], ['PIQUE ESPORTES', '#1b1b1f', '#f2b33d'],
  ['SERRA SEGUROS', '#2c2f6b', '#9fd3ff'], ['FAROL BANCO', '#f2b33d', '#1b1b1f'],
];

const concrete = new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.9 });
const darkSteel = new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.5, metalness: 0.6 });

// Perfil em degraus extrudado ao longo da arquibancada.
function tierGeometry(length, rows, baseHeight, start) {
  const s = new THREE.Shape();
  s.moveTo(start, 0);
  let x = start, y = baseHeight;
  s.lineTo(x, y);
  for (let i = 0; i < rows; i++) {
    x += ROW_DEPTH; s.lineTo(x, y);
    y += ROW_RISE; s.lineTo(x, y);
  }
  s.lineTo(x + 0.4, y);
  s.lineTo(x + 0.4, 0);
  s.lineTo(start, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  geo.translate(0, 0, -length / 2);
  return { geo, top: y, back: x };
}

// Uma arquibancada ao longo de um lado: dois anéis, cobertura e lugares para a torcida.
function stand({ length, rings, seatColor }) {
  const g = new THREE.Group();
  const seats = [];
  const seatMat = new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.7 });
  let start = 0, base = 0.6, top = 0;
  for (let r = 0; r < rings; r++) {
    const rows = r === 0 ? 14 : 12;
    const { geo, top: t, back } = tierGeometry(length, rows, base, start);
    const mesh = new THREE.Mesh(geo, r === 0 ? seatMat : concrete);
    mesh.receiveShadow = true;
    g.add(mesh);
    for (let i = 0; i < rows; i++) seats.push({ x: start + ROW_DEPTH * (i + 0.5), y: base + ROW_RISE * (i + 1), length });
    // Faixa do anel (camarotes) entre os níveis.
    if (r < rings - 1) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, length), new THREE.MeshStandardMaterial({ color: '#20242a', roughness: 0.4, metalness: 0.3, emissive: '#16324f', emissiveIntensity: 0.35 }));
      band.position.set(back + 0.6, t + 1.1, 0);
      g.add(band);
    }
    start = back - 2; base = t + 2.6; top = t;
  }
  // Cobertura em balanço com pilares atrás.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(start + 10, 0.4, length + 2), new THREE.MeshStandardMaterial({ color: '#d7dbe0', roughness: 0.6, metalness: 0.2 }));
  roof.position.set((start + 10) / 2 - 2, top + 8, 0);
  roof.rotation.z = -0.06;
  roof.castShadow = true;
  roof.name = 'roof';
  g.add(roof);
  for (let z = -length / 2 + 6; z <= length / 2 - 6; z += 18) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, top + 8, 10), darkSteel);
    col.position.set(start + 6, (top + 8) / 2, z);
    g.add(col);
  }
  return { group: g, seats };
}

function adTexture([text, bg, fg]) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 64);
  g.fillStyle = fg;
  g.font = '800 40px "Barlow Condensed", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function adBoards() {
  const g = new THREE.Group();
  const textures = BRANDS.map(adTexture);
  const geo = new THREE.BoxGeometry(6, 0.9, 0.12);
  let n = 0;
  const place = (x, z, rotY) => {
    const tex = textures[n % textures.length];
    const face = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.5 });
    const board = new THREE.Mesh(geo, [darkSteel, darkSteel, darkSteel, darkSteel, face, darkSteel]);
    board.position.set(x, 0.45, z);
    board.rotation.y = rotY;
    board.name = 'adBoard';
    g.add(board);
    n++;
  };
  const sideZ = FIELD.halfWidth + 4, endX = FIELD.halfLength + 4.5;
  for (let x = -FIELD.halfLength + 3; x <= FIELD.halfLength - 3; x += 6.2) {
    place(x, -sideZ, 0);
    place(x, sideZ, Math.PI);
  }
  for (const s of [-1, 1]) {
    for (let z = -FIELD.halfWidth + 3; z <= FIELD.halfWidth - 3; z += 6.2) {
      if (Math.abs(z) < 6) continue; // espaço atrás do gol
      place(s * endX, z, -s * Math.PI / 2);
    }
  }
  return { group: g, count: n };
}

function floodlight(x, z) {
  const g = new THREE.Group();
  const height = 42;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, height, 10), darkSteel);
  mast.position.y = height / 2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.8), new THREE.MeshStandardMaterial({ color: '#f6f7ff', emissive: '#fffbe8', emissiveIntensity: 1.6 }));
  head.position.y = height + 1;
  head.lookAt(new THREE.Vector3(-x, 0, -z).normalize().multiplyScalar(10).add(new THREE.Vector3(0, height, 0)));
  g.add(mast, head);
  g.position.set(x, 0, z);
  g.name = 'floodlight';
  return g;
}

// Silhueta de torcedor (cabeça + ombros + tronco) em branco; a cor vem da instância.
function fanTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a';                       // cabeça (fica mais escura que a camisa)
  g.beginPath(); g.arc(32, 26, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(8, 128); g.lineTo(6, 70); g.quadraticCurveTo(8, 46, 32, 44); g.quadraticCurveTo(56, 46, 58, 70); g.lineTo(56, 128);
  g.fill();
  return new THREE.CanvasTexture(c);
}

// Torcida: recortes instanciados (2 triângulos cada) com cores dos times, pulando.
function crowd(places, teams) {
  const geo = new THREE.PlaneGeometry(0.55, 1.1);
  geo.translate(0, 0.55, 0);
  const mat = new THREE.MeshLambertMaterial({ map: fanTexture(), alphaTest: 0.5 });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float id = float(gl_InstanceID);
        transformed.y += max(0.0, sin(uTime * (3.0 + mod(id, 5.0)) + id * 1.7)) * 0.12;`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, places.length);
  const m = new THREE.Matrix4(), color = new THREE.Color();
  const palette = [teams.home.colors.shirt, teams.home.colors.shirt, teams.home.colors.shorts, teams.away.colors.shirt, '#e8e8e8', '#2b2b2b', '#c9a227'];
  places.forEach((p, i) => {
    m.makeRotationY(p.rotY);
    m.setPosition(p.x, p.y, p.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.set(palette[(i * 2654435761) % palette.length]));
  });
  mesh.name = 'crowd';
  return { mesh, uniforms };
}

export function createStadium(teams) {
  const group = new THREE.Group();
  const places = [];
  const sides = [
    { length: FIELD.halfLength * 2 + 16, rings: 2, at: (s) => ({ pos: [0, 0, s * (FIELD.halfWidth + GAP_SIDE)], rotY: s > 0 ? -Math.PI / 2 : Math.PI / 2 }) },
    { length: FIELD.halfWidth * 2 + 10, rings: 1, at: (s) => ({ pos: [s * (FIELD.halfLength + GAP_END), 0, 0], rotY: s > 0 ? 0 : Math.PI }) },
  ];
  let standCount = 0, roofs = 0;
  for (const side of sides) {
    for (const s of [-1, 1]) {
      const { group: st, seats } = stand({ length: side.length, rings: side.rings, seatColor: teams.home.colors.shirt });
      const { pos, rotY } = side.at(s);
      st.position.set(...pos);
      st.rotation.y = rotY;
      group.add(st);
      standCount += side.rings;
      roofs++;
      st.updateMatrixWorld(true);
      // Lugares ocupados (85%) → posição no mundo, olhando para o campo.
      for (const row of seats) {
        for (let z = -row.length / 2 + 0.6; z < row.length / 2 - 0.6; z += SEAT_SPACING) {
          const h = Math.sin(row.x * 91.7 + z * 13.3) * 43758.5;
          if (h - Math.floor(h) > 0.85) continue;
          const v = new THREE.Vector3(row.x, row.y, z).applyMatrix4(st.matrixWorld);
          places.push({ x: v.x, y: v.y, z: v.z, rotY: rotY - Math.PI / 2 });
        }
      }
    }
  }
  const ads = adBoards();
  group.add(ads.group);
  const lightsAt = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [sx, sz] of lightsAt) group.add(floodlight(sx * (FIELD.halfLength + 22), sz * (FIELD.halfWidth + 26)));
  const fans = crowd(places, teams);
  group.add(fans.mesh);
  // Piso entre o gramado e as arquibancadas.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.halfLength * 2 + 60, FIELD.halfWidth * 2 + 60), new THREE.MeshStandardMaterial({ color: '#4a5a3a', roughness: 1 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  group.add(apron);

  return {
    group,
    info: { stands: standCount, roofs, floodlights: lightsAt.length, adBoards: ads.count, crowd: places.length },
    setCrowd(on) { fans.mesh.visible = on; },
    update(t) { fans.uniforms.uTime.value = t; },
  };
}
