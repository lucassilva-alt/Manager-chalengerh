// Importa escudos de JoseArroyave/football-logos (licença MIT do repositório;
// os escudos são marcas dos clubes). Uso:
//   node scripts/import-crests.mjs <pasta logos/brazil> [pasta destino]
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { sanitizeSvg, slugify } from './lib/sanitize-svg.mjs';

const [src, out = 'assets/crests/br'] = process.argv.slice(2);
if (!src) { console.error('uso: node scripts/import-crests.mjs <pasta> [destino]'); process.exit(1); }
await mkdir(out, { recursive: true });

const crests = {};
let dropped = 0;
for (const name of (await readdir(src)).filter((f) => f.toLowerCase().endsWith('.svg')).sort()) {
  const raw = await readFile(join(src, name), 'utf8');
  const clean = sanitizeSvg(raw);
  if (!/<svg[\s>]/i.test(clean) || !/<\/svg>\s*$/i.test(clean)) { dropped++; continue; }
  const slug = slugify(name);
  if (crests[slug]) throw new Error(`slug repetido: ${slug} (${name} e ${crests[slug].original})`);
  await writeFile(join(out, `${slug}.svg`), clean + '\n');
  crests[slug] = { file: `${slug}.svg`, original: name };
}
const index = {
  source: 'https://github.com/JoseArroyave/football-logos (logos/brazil)',
  license: 'MIT (repositório). Escudos são marcas registradas dos respectivos clubes.',
  crests,
};
await writeFile(join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`${Object.keys(crests).length} escudos importados, ${dropped} descartados`);
