// Gera assets/models/player.glb a partir da Universal Animation Library (Quaternius, CC0):
// mantém só as animações usadas pelo jogo, tira canais dos dedos e compacta.
// Uso: node scripts/build-player-model.mjs <AnimationLibrary_Godot_Standard.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';
import { PLAYER_CLIPS } from '../src/render/player-clips.js';

const [src] = process.argv.slice(2);
if (!src) { console.error('informe o .glb de origem'); process.exit(1); }

const FINGER = /f_(index|middle|pinky|ring)|thumb|palm/;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);

const root = doc.getRoot();
const disposeSampler = (s) => s.dispose();
// Dados de animação ficam compartilhados entre canais: só sai o que ficou sem dono.
const disposeOrphanAccessors = () => {
  for (const acc of root.listAccessors()) {
    if (acc.listParents().every((p) => p === root)) acc.dispose();
  }
};
for (const anim of root.listAnimations()) {
  if (!PLAYER_CLIPS.includes(anim.getName())) {
    anim.listSamplers().forEach(disposeSampler);
    anim.dispose();
    continue;
  }
  for (const ch of anim.listChannels()) {
    if (FINGER.test(ch.getTargetNode()?.getName() ?? '')) {
      disposeSampler(ch.getSampler());
      ch.dispose();
    }
  }
}
disposeOrphanAccessors();
// Sem quantize: o uniforme é pintado por região em metros (src/render/kit-material.js).
await doc.transform(resample(), prune(), dedup());
await io.write('assets/models/player.glb', doc);
console.log('ok', doc.getRoot().listAnimations().map((a) => a.getName()).join(', '));
