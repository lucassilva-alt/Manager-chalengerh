// Uniforme pintado no boneco por região do corpo, medida em metros na pose de
// repouso do modelo (frente para +z, braços abertos entre 1,30 e 1,55 m).
import * as THREE from 'three';

const REGION = {
  boots: 0.09, socks: 0.47, knee: 0.60, shorts: 0.95, shirt: 1.55,
  collar: 1.49, collarHalfWidth: 0.11, armsFrom: 1.30, hands: 0.75, hairTop: 1.72, hairBack: 1.62,
  number: { halfWidth: 0.13, bottom: 1.12, top: 1.40, back: -0.05 },
};

const numberMaps = new Map();
function numberMap(n) {
  if (!numberMaps.has(n)) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.font = '900 104px "Barlow Condensed", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(String(n), 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = true;
    numberMaps.set(n, tex);
  }
  return numberMaps.get(n);
}

const FRAGMENT_KIT = /* glsl */ `
  vec3 p = vRest;
  float ax = abs(p.x);
  vec3 kit;
  if (p.y < ${REGION.boots}) kit = uBoots;
  else if (p.y < ${REGION.socks}) kit = uSocks;
  else if (p.y < ${REGION.knee}) kit = uSkin;
  else if (p.y < ${REGION.shorts}) kit = uShorts;
  else if (p.y < ${REGION.shirt}) {
    if (p.y > ${REGION.armsFrom} && ax > uSleeve) kit = ax > ${REGION.hands} ? uHands : uSkin;
    else {
      kit = p.y > ${REGION.collar} && ax < ${REGION.collarHalfWidth} ? uAccent : uShirt;
      if (p.z < ${REGION.number.back} && ax < ${REGION.number.halfWidth}
          && p.y > ${REGION.number.bottom} && p.y < ${REGION.number.top}) {
        vec2 uv = vec2(1.0 - (p.x + ${REGION.number.halfWidth}) / ${REGION.number.halfWidth * 2},
                       (p.y - ${REGION.number.bottom}) / ${REGION.number.top - REGION.number.bottom});
        kit = mix(kit, uNumberColor, texture2D(uNumberMap, uv).a);
      }
    }
  }
  else kit = (p.y > ${REGION.hairTop} || (p.y > ${REGION.hairBack} && p.z < -0.03)) ? uHair : uSkin;
  diffuseColor.rgb = kit;
`;

export function createKitMaterial({ shirt, shorts, socks, accent, skin, hair, boots = '#1b1b1f', number = 0, keeper = false, gloves = '#f2f2f2', numberColor = '#ffffff' }) {
  const color = (c) => new THREE.Color(c);
  const uniforms = {
    uShirt: { value: color(shirt) }, uShorts: { value: color(shorts) }, uSocks: { value: color(socks) },
    uAccent: { value: color(accent ?? shorts) }, uSkin: { value: color(skin) }, uHair: { value: color(hair) },
    uBoots: { value: color(boots) }, uHands: { value: color(keeper ? gloves : skin) },
    uSleeve: { value: keeper ? REGION.hands : 0.40 },
    uNumberColor: { value: color(numberColor) }, uNumberMap: { value: numberMap(number) },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRest;
uniform vec3 uShirt, uShorts, uSocks, uAccent, uSkin, uHair, uBoots, uHands, uNumberColor;
uniform float uSleeve;
uniform sampler2D uNumberMap;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_KIT}`);
  };
  mat.customProgramCacheKey = () => 'kit-v1';
  return mat;
}
