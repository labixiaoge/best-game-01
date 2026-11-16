// Sprout Defense: the whole simulation, with no DOM in it, so the same code runs
// in the browser and headless in Node. A world is plain state plus step(); the
// renderer reads it and the input layer calls its verbs (place, upgrade, sell,
// startWave). Sounds and screens are driven by the events each step returns.

import {
  BUGS, FIELD, GRID, PATH_CELLS, SCORE, START_GOLD, START_LIVES,
  TOTAL_WAVES, TOWERS, UPGRADE, WAVE_BONUS, WAVE_SCALE, WAVES,
} from './config.js';
import { makeRng, range } from './random.js';

/** Events a step can report, for sounds and screens. */
export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_LEAK = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_WON = 16;
export const EVENT_LOST = 32;
export const EVENT_PLACE = 64;

/** Buildable cells ranked for the autopilot: most path neighbours first. */
function rankCells() {
  const path = new Set(PATH_CELLS.map(([c, r]) => `${c},${r}`));
  const ranked = [];
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      if (path.has(`${c},${r}`)) continue;
      let neighbours = 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (path.has(`${c + dc},${r + dr}`)) neighbours += 1;
      }
      // Corners and cells hugging the path cover the most ground.
      ranked.push({ col: c, row: r, score: neighbours * 10 - (c + r) * 0.01 });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

export const RANKED_CELLS = rankCells();

/** Pixel waypoints for the bug path, from the grid cells plus off-screen ends. */
export function buildWaypoints() {
  const pts = PATH_CELLS.map(([c, r]) => ({
    x: GRID.x + c * GRID.cell + GRID.cell / 2,
    y: GRID.y + r * GRID.cell + GRID.cell / 2,
  }));
  const first = pts[0];
  const last = pts[pts.length - 1];
  return [{ x: -50, y: first.y }, ...pts, { x: FIELD.width + 50, y: last.y }];
}

const WAYPOINTS = buildWaypoints();
const PATH_SET = new Set(PATH_CELLS.map(([c, r]) => `${c},${r}`));

export function isPathCell(col, row) {
  return PATH_SET.has(`${col},${row}`);
}

/** Grid cell (or null) for a point in logical pixels. */
export function cellFromPoint(x, y) {
  const col = Math.floor((x - GRID.x) / GRID.cell);
  const row = Math.floor((y - GRID.y) / GRID.cell);
  if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return null;
  return { col, row };
}

export function cellCentre(col, row) {
  return { x: GRID.x + col * GRID.cell + GRID.cell / 2, y: GRID.y + row * GRID.cell + GRID.cell / 2 };
}

let nextId = 1;

export function createWorld(seed) {
  const world = {
    rng: makeRng(seed),
    seed,
    time: 0,
    waypoints: WAYPOINTS,
    gold: START_GOLD,
    lives: START_LIVES,
    wave: 0,
    score: 0,
    kills: 0,
    earned: 0,
    phase: 'build', // build | wave | won | lost
    towers: [],
    bugs: [],
    projectiles: [],
    particles: [],
    floats: [],
    spawnQueue: [],
    spawnTimer: 0,
    banner: null, // { text, sub, until }
    events: [],
    stats: { placed: 0, upgraded: 0, sold: 0, leaked: 0 },
  };
  return world;
}

export function resetWorld(world, seed) {
  const fresh = createWorld(seed);
  Object.assign(world, fresh);
}

function towerStats(tower) {
  const base = TOWERS[tower.kind];
  const level = tower.level;
  return {
    damage: Math.round(base.damage * Math.pow(UPGRADE.damageMul, level - 1)),
    range: base.range + UPGRADE.rangeAdd * (level - 1),
    rate: base.rate,
  };
}

export function upgradeCost(tower) {
  return Math.round(TOWERS[tower.kind].cost * UPGRADE.costShare);
}

export function sellValue(tower) {
  return Math.floor(tower.invested * UPGRADE.sellRefund);
}

export function towerAt(world, col, row) {
  return world.towers.find((t) => t.col === col && t.row === row) || null;
}

export function canPlace(world, kind, col, row) {
  if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return 'Outside the garden.';
  if (isPathCell(col, row)) return 'Bugs walk here — plant beside the path.';
  if (towerAt(world, col, row)) return 'Something already grows here.';
  if (world.gold < TOWERS[kind].cost) return `Not enough gold (needs ${TOWERS[kind].cost}).`;
  return null;
}

export function placeTower(world, kind, col, row) {
  const problem = canPlace(world, kind, col, row);
  if (problem) return problem;
  const { x, y } = cellCentre(col, row);
  world.gold -= TOWERS[kind].cost;
  world.towers.push({
    id: nextId += 1, kind, col, row, x, y, level: 1,
    cooldown: 0, invested: TOWERS[kind].cost, angle: -Math.PI / 2, flash: 0,
  });
  world.stats.placed += 1;
  burst(world, x, y, '#a8e063', 10, 90);
  world.events.push(EVENT_PLACE);
  return null;
}

export function upgradeTower(world, tower) {
  if (tower.level >= 3) return 'Already fully grown.';
  const cost = upgradeCost(tower);
  if (world.gold < cost) return `Not enough gold (needs ${cost}).`;
  world.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
  world.stats.upgraded += 1;
  burst(world, tower.x, tower.y, '#ffd94d', 14, 110);
  return null;
}

export function sellTower(world, tower) {
  world.gold += sellValue(tower);
  world.towers = world.towers.filter((t) => t !== tower);
  world.stats.sold += 1;
  burst(world, tower.x, tower.y, '#b9c9a8', 8, 70);
}

/** Queue up a wave's bugs and switch to the wave phase. */
export function startWave(world) {
  if (world.phase !== 'build' || world.wave >= TOTAL_WAVES) return false;
  world.wave += 1;
  const def = WAVES[world.wave - 1];
  const hpMul = 1 + WAVE_SCALE.hpPerWave * (world.wave - 1);
  const speedMul = 1 + WAVE_SCALE.speedPerWave * (world.wave - 1);
  let at = 0.6;
  world.spawnQueue = [];
  for (const group of def.groups) {
    for (let i = 0; i < group.count; i += 1) {
      world.spawnQueue.push({ kind: group.kind, at, hpMul, speedMul });
      at += group.gap * (0.9 + world.rng() * 0.2);
    }
    at += 0.8;
  }
  world.spawnTimer = 0;
  world.phase = 'wave';
  world.banner = { text: `Wave ${world.wave}`, sub: world.wave === TOTAL_WAVES ? 'The final swarm!' : `${def.groups.reduce((n, g) => n + g.count, 0)} bugs incoming`, until: world.time + 2.2 };
  return true;
}

function spawnBug(world, spec) {
  const def = BUGS[spec.kind];
  const start = WAYPOINTS[0];
  world.bugs.push({
    id: nextId += 1,
    kind: spec.kind,
    x: start.x, y: start.y,
    hp: Math.round(def.hp * spec.hpMul),
    maxHp: Math.round(def.hp * spec.hpMul),
    speed: def.speed * spec.speedMul * (0.95 + world.rng() * 0.1),
    radius: def.radius,
    wp: 1, dist: 0,
    slowUntil: 0, slowFactor: 1,
    wobble: world.rng() * Math.PI * 2,
    hitFlash: 0,
  });
}

function burst(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = world.rng() * Math.PI * 2;
    const v = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
      life: range(world.rng, 0.3, 0.7), maxLife: 0.7, color,
      size: range(world.rng, 2, 5), gravity: 160,
    });
  }
}

function addFloat(world, x, y, text, color) {
  world.floats.push({ x, y, text, life: 0.9, maxLife: 0.9, color });
}

function damageBug(world, bug, damage) {
  bug.hp -= damage;
  bug.hitFlash = 0.12;
  if (bug.hp > 0) return;
  const def = BUGS[bug.kind];
  world.gold += def.bounty;
  world.earned += def.bounty;
  world.kills += 1;
  world.score += SCORE.perKill;
  burst(world, bug.x, bug.y, def.body, 12, 120);
  addFloat(world, bug.x, bug.y - 14, `+${def.bounty}`, '#ffd94d');
  world.events.push(EVENT_KILL);
}

function fireTower(world, tower) {
  const stats = towerStats(tower);
  const base = TOWERS[tower.kind];
  let target = null;
  for (const bug of world.bugs) {
    const dx = bug.x - tower.x;
    const dy = bug.y - tower.y;
    if (dx * dx + dy * dy > stats.range * stats.range) continue;
    if (!target || bug.dist > target.dist) target = bug;
  }
  if (!target) return;
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.cooldown = 1 / stats.rate;
  tower.flash = 0.08;
  world.projectiles.push({
    x: tower.x, y: tower.y - 6, target,
    speed: base.projSpeed, damage: stats.damage,
    splash: base.splash, slow: base.slow, slowSecs: base.slowSecs || 0,
    kind: tower.kind, dead: false,
  });
  world.events.push(EVENT_SHOOT);
}

function stepProjectiles(world, dt) {
  for (const p of world.projectiles) {
    const target = p.target;
    if (!target || target.hp <= 0 || !world.bugs.includes(target)) {
      p.dead = true;
      continue;
    }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    const move = p.speed * dt;
    if (d <= move + target.radius * 0.5) {
      damageBug(world, target, p.damage);
      if (p.splash > 0) {
        burst(world, target.x, target.y, '#e1bee7', 8, 100);
        for (const other of world.bugs) {
          if (other === target || other.hp <= 0) continue;
          const ox = other.x - target.x;
          const oy = other.y - target.y;
          if (ox * ox + oy * oy <= p.splash * p.splash) damageBug(world, other, Math.round(p.damage * 0.5));
        }
      }
      if (p.slow > 0) {
        target.slowUntil = world.time + p.slowSecs;
        target.slowFactor = 1 - p.slow;
      }
      p.dead = true;
    } else {
      p.x += (dx / d) * move;
      p.y += (dy / d) * move;
    }
  }
  world.projectiles = world.projectiles.filter((p) => !p.dead);
}

function stepBugs(world, dt) {
  for (const bug of world.bugs) {
    const slowed = world.time < bug.slowUntil;
    const speed = bug.speed * (slowed ? bug.slowFactor : 1);
    let remaining = speed * dt;
    while (remaining > 0 && bug.wp < WAYPOINTS.length) {
      const wp = WAYPOINTS[bug.wp];
      const dx = wp.x - bug.x;
      const dy = wp.y - bug.y;
      const d = Math.hypot(dx, dy);
      if (d <= remaining) {
        bug.x = wp.x;
        bug.y = wp.y;
        bug.dist += d;
        bug.wp += 1;
        remaining -= d;
      } else {
        bug.x += (dx / d) * remaining;
        bug.y += (dy / d) * remaining;
        bug.dist += remaining;
        remaining = 0;
      }
    }
    bug.wobble += dt * 6;
    if (bug.hitFlash > 0) bug.hitFlash -= dt;
  }
  // Leaks: bugs that walked off the end.
  for (const bug of world.bugs) {
    if (bug.wp < WAYPOINTS.length) continue;
    const def = BUGS[bug.kind];
    world.lives -= def.lives;
    world.stats.leaked += 1;
    burst(world, FIELD.width - 30, bug.y, '#ff6b5e', 10, 110);
    world.events.push(EVENT_LEAK);
  }
  world.bugs = world.bugs.filter((b) => b.wp < WAYPOINTS.length && b.hp > 0);
}

function stepParticles(world, dt) {
  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const f of world.floats) {
    f.life -= dt;
    f.y -= 34 * dt;
  }
  world.floats = world.floats.filter((f) => f.life > 0);
}

export function stepParticlesOnly(world, dt) {
  world.time += dt;
  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const f of world.floats) {
    f.life -= dt;
    f.y -= 34 * dt;
  }
  world.floats = world.floats.filter((f) => f.life > 0);
}

/** Advance the world one fixed step; returns the events that happened. */
export function stepWorld(world, dt) {
  world.events = [];
  world.time += dt;
  if (world.phase === 'won' || world.phase === 'lost') {
    stepParticles(world, dt);
    return world.events;
  }
  if (world.phase === 'wave') {
    world.spawnTimer += dt;
    while (world.spawnQueue.length > 0 && world.spawnQueue[0].at <= world.spawnTimer) {
      spawnBug(world, world.spawnQueue.shift());
    }
  }
  for (const tower of world.towers) {
    tower.cooldown -= dt;
    if (tower.flash > 0) tower.flash -= dt;
    if (tower.cooldown <= 0 && world.bugs.length > 0) fireTower(world, tower);
  }
  stepProjectiles(world, dt);
  stepBugs(world, dt);
  stepParticles(world, dt);

  if (world.lives <= 0) {
    world.lives = 0;
    world.phase = 'lost';
    world.events.push(EVENT_LOST);
    return world.events;
  }
  if (world.phase === 'wave' && world.spawnQueue.length === 0 && world.bugs.length === 0) {
    const bonus = WAVE_BONUS.flat + WAVE_BONUS.perWave * world.wave;
    world.gold += bonus;
    world.earned += bonus;
    world.score += SCORE.perWave;
    world.phase = 'build';
    world.banner = { text: `Wave ${world.wave} cleared!`, sub: `+${bonus} gold bonus`, until: world.time + 2.0 };
    world.events.push(EVENT_WAVE_CLEAR);
    if (world.wave >= TOTAL_WAVES) {
      world.score += world.lives * SCORE.perLife + world.gold * SCORE.perGold;
      world.phase = 'won';
      world.events.push(EVENT_WON);
    }
  }
  return world.events;
}

/**
 * The autopilot a screenshot scene (and a headless balance check) uses: spend gold
 * on the best free plot, upgrade what it has when the garden is full, and start
 * the next wave whenever the garden is quiet.
 */
export function autopilot(world) {
  if (world.phase !== 'build') return;
  // Spend down to a small reserve, best plots first.
  for (const cell of RANKED_CELLS) {
    if (world.gold < TOWERS.sunpetal.cost) break;
    if (towerAt(world, cell.col, cell.row)) continue;
    const kind = world.gold >= TOWERS.briar.cost && world.towers.length % 3 === 2
      ? 'briar'
      : world.gold >= TOWERS.frostmint.cost && world.towers.length % 3 === 1
        ? 'frostmint'
        : 'sunpetal';
    if (!canPlace(world, kind, cell.col, cell.row)) {
      placeTower(world, kind, cell.col, cell.row);
      if (world.gold < 60) break;
    }
  }
  // With a full garden, grow what is there.
  for (const tower of world.towers) {
    if (tower.level < 3 && world.gold >= upgradeCost(tower) + 60) upgradeTower(world, tower);
  }
  startWave(world);
}
