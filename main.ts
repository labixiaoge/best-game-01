// Sprout Defense, a best-game-01 entry (Node 22, standard library only).
//
// What this program does, in three steps:
//   1. copy game/ (the playable game: index.html plus its ES modules) to the
//      output directory, and screenshots/ beside it when it exists;
//   2. build /output/dossier.json with the make.fun library vendored at
//      vendor/makefun-game.ts, so the judge reads exactly what the scorer
//      would build from the same files;
//   3. nothing else: no network, no install, no build step.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR set:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally first with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The scorer's caps, so a bad entry fails here instead of at the gate. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name) {
  const from = join(repoRoot, name);
  if (!existsSync(from)) return;
  cpSync(from, join(outputDir, name), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

const dossier = buildDossier(outputDir, CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Sprout Defense handed in: ${outputDir} (${dossier.length} byte dossier)`);
