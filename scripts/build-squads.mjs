// Junta os elencos pesquisados (um JSON por clube, cada um com a sua fonte)
// em data/squads-2026.json. Uso: node scripts/build-squads.mjs <pasta> [asOf]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [dir, asOf = '2026-10-21'] = process.argv.slice(2);
if (!dir) { console.error('uso: node scripts/build-squads.mjs <pasta> [asOf]'); process.exit(1); }
const squads = {};
for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json')).sort()) {
  const s = JSON.parse(await readFile(join(dir, f), 'utf8'));
  squads[s.club] = {
    source: s.source, retrievedAt: s.retrievedAt,
    players: s.players.map(({ name, pos, number, birthDate, nationality }) => ({ name: name.trim(), pos, number: number ?? null, birthDate: birthDate ?? null, nationality: nationality ?? null })),
  };
}
await writeFile('data/squads-2026.json', JSON.stringify({ asOf, note: 'Elencos reais; atributos são estimativa do jogo.', squads }, null, 1) + '\n');
console.log(`${Object.keys(squads).length} elencos, ${Object.values(squads).reduce((n, s) => n + s.players.length, 0)} jogadores`);
