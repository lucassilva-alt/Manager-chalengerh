// Luz de fim de tarde: céu em gradiente, sol com sombras suaves que acompanham
// o lance, luz ambiente do céu/gramado e tone mapping filmico.
import * as THREE from 'three';

const SUN_DIR = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
const SHADOW_SPAN = 30;   // m cobertos pela sombra ao redor do foco do lance

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#2f6fb8') },
      horizon: { value: new THREE.Color('#cfe3f2') },
      glow: { value: new THREE.Color('#fff2d6') },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, glow, sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(horizon, top, pow(h, 0.55));
        float sun = pow(max(dot(vDir, sunDir), 0.0), 24.0);
        gl_FragColor = vec4(c + glow * sun * 0.6, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), mat);
  dome.name = 'sky';
  return dome;
}

export function createLighting(renderer, scene) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(skyDome());
  scene.fog = new THREE.Fog('#cfe3f2', 160, 380);
  scene.add(new THREE.HemisphereLight('#dbeeff', '#5d7a3a', 1.1));

  const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -SHADOW_SPAN, right: SHADOW_SPAN, top: SHADOW_SPAN, bottom: -SHADOW_SPAN, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  return {
    setShadows(on) { sun.castShadow = on; },
    // Sombra nítida só onde o lance acontece.
    follow(focus) {
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(SUN_DIR, 90);
    },
  };
}
