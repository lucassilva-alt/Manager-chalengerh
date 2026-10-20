# Créditos dos modelos

| Arquivo | Origem | Autor | Licença |
|---|---|---|---|
| `player.glb` | Universal Animation Library [Standard] — https://opengameart.org/content/universal-animation-library | Quaternius | CC0 1.0 (domínio público) |

`player.glb` é gerado por `scripts/build-player-model.mjs`: mantém só as animações usadas
(`src/render/player-clips.js`) e retira os canais dos dedos (posições em metros, sem quantização).
Uniforme, cores e números são aplicados pelo jogo; o modelo original é um manequim neutro.
