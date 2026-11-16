// Sprout Defense: everything drawn on the canvas — the garden, the path, the
// plants, the bugs, the particles, the HUD, the shop and the screens. The
// renderer only reads state; it never changes it.

import {
  BUGS, FIELD, FONT, GRID, HUD_H, PALETTE, SHOP_H, TOWERS, TOWER_ORDER,
  TOTAL_WAVES, UPGRADE,
} from './config.js';
import { cellCentre, isPathCell, sellValue, towerAt, upgradeCost } from './world.js';
import { makeRng } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WON = 'won';
export const SCREEN_LOST = 'lost';

/** Where the HUD buttons and shop cards sit, in logical pixels. */
export const LAYOUT = {
  hudButtons: {
    speed: { x: 1052, y: 8, w: 58, h: 40 },
    pause: { x: 1118, y: 8, w: 58, h: 40 },
    mute: { x: 1184, y: 8, w: 58, h: 40 },
  },
  shopCards: TOWER_ORDER.map((key, i) => ({ key, x: 24 + i * 312, y: FIELD.height - SHOP_H + 6, w: 300, h: 72 })),
  startWave: { x: 1000, y: FIELD.height - SHOP_H + 6, w: 256, h: 72 },
  panel: { w: 250, h: 118 },
};

/** Fixed garden decorations, seeded so the garden looks the same every visit. */
const decor = (() => {
  const rng = makeRng(20261116);
  const flowers = [];
  const tufts = [];
  const pebbles = [];
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      if (isPathCell(c, r)) continue;
      const cx = GRID.x + c * GRID.cell;
      const cy = GRID.y + r * GRID.cell;
      if (rng() < 0.5) {
        flowers.push({ x: cx + 8 + rng() * 64, y: cy + 8 + rng() * 64, color: ['#ff8fb3', '#ffffff', '#ffd94d'][Math.floor(rng() * 3)], r: 2.5 + rng() * 2 });
      } else if (rng() < 0.6) {
        tufts.push({ x: cx + 10 + rng() * 60, y: cy + 10 + rng() * 60, h: 6 + rng() * 6 });
      }
    }
  }
  for (let i = 0; i < 40; i += 1) {
    pebbles.push({ t: rng(), side: rng() < 0.5 ? -1 : 1, off: (rng() - 0.5) * 22, r: 2 + rng() * 3 });
  }
  return { flowers, tufts, pebbles };
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function drawFlower(ctx, x, y, color, r) {
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff9f1c';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackground(ctx, world) {
  ctx.fillStyle = PALETTE.sky;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Grass checker over the garden grid.
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      const x = GRID.x + c * GRID.cell;
      const y = GRID.y + r * GRID.cell;
      ctx.fillStyle = (c + r) % 2 === 0 ? PALETTE.grassA : PALETTE.grassB;
      ctx.fillRect(x, y, GRID.cell, GRID.cell);
      if (!isPathCell(c, r)) {
        ctx.fillStyle = PALETTE.plot;
        roundRect(ctx, x + 4, y + 4, GRID.cell - 8, GRID.cell - 8, 10);
        ctx.fill();
        ctx.strokeStyle = PALETTE.plotEdge;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
  // The dirt path, drawn as a thick rounded line through the waypoints.
  ctx.strokeStyle = PALETTE.pathEdge;
  ctx.lineWidth = 66;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(world.waypoints[0].x, world.waypoints[0].y);
  for (const wp of world.waypoints) ctx.lineTo(wp.x, wp.y);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.path;
  ctx.lineWidth = 56;
  ctx.beginPath();
  ctx.moveTo(world.waypoints[0].x, world.waypoints[0].y);
  for (const wp of world.waypoints) ctx.lineTo(wp.x, wp.y);
  ctx.stroke();
  // Pebbles along the path edges.
  ctx.fillStyle = PALETTE.pathStone;
  for (const p of decor.pebbles) {
    const wp = world.waypoints[Math.min(world.waypoints.length - 1, Math.floor(p.t * world.waypoints.length))];
    ctx.beginPath();
    ctx.arc(wp.x + p.side * 30, wp.y + p.off, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Flowers and grass tufts on the plots.
  for (const f of decor.flowers) drawFlower(ctx, f.x, f.y, f.color, f.r);
  ctx.strokeStyle = PALETTE.grassDark;
  ctx.lineWidth = 2;
  for (const t of decor.tufts) {
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x - 3, t.y - t.h);
    ctx.moveTo(t.x + 3, t.y);
    ctx.lineTo(t.x + 5, t.y - t.h * 0.8);
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + 1, t.y - t.h * 1.1);
    ctx.stroke();
  }
}

function drawRangeRing(ctx, x, y, range, valid) {
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  ctx.fillStyle = valid ? 'rgba(255,255,255,0.07)' : 'rgba(255,90,90,0.08)';
  ctx.fill();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = valid ? 'rgba(255,255,255,0.55)' : 'rgba(255,90,90,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTowerBody(ctx, kind, x, y, level, angle, flash, t) {
  const base = TOWERS[kind];
  const bob = Math.sin(t * 2 + x) * 1.5;
  ctx.save();
  ctx.translate(x, y + bob * 0.4);
  // Pot.
  ctx.fillStyle = '#b5651d';
  ctx.beginPath();
  ctx.moveTo(-16, 8);
  ctx.lineTo(16, 8);
  ctx.lineTo(12, 20);
  ctx.lineTo(-12, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8d4e15';
  ctx.fillRect(-17, 5, 34, 5);
  // Stem.
  ctx.strokeStyle = base.stem;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, -6);
  ctx.stroke();
  // Leaves.
  ctx.fillStyle = base.stem;
  ctx.beginPath();
  ctx.ellipse(-9, 2, 8, 4, -0.5, 0, Math.PI * 2);
  ctx.ellipse(9, 2, 8, 4, 0.5, 0, Math.PI * 2);
  ctx.fill();
  const scale = 1 + (flash > 0 ? 0.12 : 0);
  ctx.translate(0, -14);
  ctx.scale(scale, scale);
  if (kind === 'sunpetal') {
    ctx.fillStyle = base.petal;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + Math.sin(t * 0.8) * 0.05;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = base.core;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2400';
    ctx.beginPath();
    ctx.arc(-4, -2, 1.6, 0, Math.PI * 2);
    ctx.arc(4, -2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2400';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 2, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (kind === 'briar') {
    ctx.fillStyle = base.petal;
    for (const [dx, dy, r] of [[-11, 2, 9], [11, 2, 9], [0, -9, 10], [-6, -7, 8], [7, -7, 8]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = base.core;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e1bee7';
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + t * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.lineTo(Math.cos(a + 0.5) * 20, Math.sin(a + 0.5) * 20);
      ctx.lineTo(Math.cos(a - 0.5) * 20, Math.sin(a - 0.5) * 20);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Frostmint: mint leaves and a frost crystal that turns toward the aim.
    ctx.fillStyle = base.petal;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 11, Math.sin(a) * 11, 7, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(5, -2);
    ctx.lineTo(0, 4);
    ctx.lineTo(-5, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = base.core;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Level pips.
  ctx.fillStyle = '#ffd94d';
  for (let i = 0; i < level; i += 1) {
    ctx.beginPath();
    ctx.arc(x - (level - 1) * 6 + i * 12, y + 26, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBug(ctx, bug, t) {
  const def = BUGS[bug.kind];
  const bob = Math.sin(bug.wobble) * 2;
  const slowed = bug.slowUntil > 0;
  ctx.save();
  ctx.translate(bug.x, bug.y + bob * 0.5);
  if (slowed) {
    ctx.beginPath();
    ctx.arc(0, 0, def.radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(125,227,255,0.25)';
    ctx.fill();
  }
  const flash = bug.hitFlash > 0;
  ctx.fillStyle = flash ? '#ffffff' : def.body;
  if (bug.kind === 'aphid') {
    ctx.beginPath();
    ctx.ellipse(0, 0, def.radius, def.radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : def.dark;
    ctx.beginPath();
    ctx.arc(def.radius * 0.7, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 1.6;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-4 + i * 5, 8);
      ctx.lineTo(-7 + i * 6, 14 + Math.sin(bug.wobble + i) * 2);
      ctx.moveTo(-4 + i * 5, -8);
      ctx.lineTo(-7 + i * 6, -14 - Math.sin(bug.wobble + i) * 2);
      ctx.stroke();
    }
  } else if (bug.kind === 'beetle') {
    ctx.beginPath();
    ctx.ellipse(0, 0, def.radius, def.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : def.dark;
    ctx.beginPath();
    ctx.ellipse(0, -2, def.radius * 0.55, def.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(def.radius * 0.8, -4);
    ctx.lineTo(def.radius * 1.25, -10);
    ctx.stroke();
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-4 + i * 6, 10);
      ctx.lineTo(-8 + i * 7, 16);
      ctx.stroke();
    }
  } else if (bug.kind === 'snail') {
    ctx.fillStyle = flash ? '#ffffff' : def.body;
    ctx.beginPath();
    ctx.ellipse(0, 4, def.radius, def.radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(def.radius * 0.8, -2);
    ctx.lineTo(def.radius * 0.9, -14);
    ctx.moveTo(def.radius * 0.4, -2);
    ctx.lineTo(def.radius * 0.4, -13);
    ctx.stroke();
    ctx.fillStyle = def.dark;
    ctx.beginPath();
    ctx.arc(def.radius * 0.9, -15, 2.5, 0, Math.PI * 2);
    ctx.arc(def.radius * 0.4, -14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath();
    ctx.arc(-2, -4, def.radius * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, -4, def.radius * 0.5, 0, Math.PI * 1.5);
    ctx.arc(-2, -4, def.radius * 0.28, 0, Math.PI * 1.5);
    ctx.stroke();
  } else {
    // Wasp.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const flap = Math.sin(bug.wobble * 2.4) * 0.5;
    ctx.beginPath();
    ctx.ellipse(-4, -10 - flap * 4, 8, 4, -0.6, 0, Math.PI * 2);
    ctx.ellipse(4, -10 + flap * 4, 8, 4, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : def.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, def.radius, def.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.dark;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 3, def.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(5, 0, 3, def.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Health bar when hurt.
  if (bug.hp < bug.maxHp) {
    const w = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bug.x - w / 2, bug.y - def.radius - 12, w, 5);
    ctx.fillStyle = bug.hp / bug.maxHp > 0.5 ? '#7ec850' : bug.hp / bug.maxHp > 0.25 ? '#ffb020' : '#ff5a6e';
    ctx.fillRect(bug.x - w / 2, bug.y - def.radius - 12, w * (bug.hp / bug.maxHp), 5);
  }
}

function drawProjectiles(ctx, world) {
  for (const p of world.projectiles) {
    if (p.kind === 'sunpetal') {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'briar') {
      ctx.fillStyle = '#ce93d8';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.x * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#b3ecff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y);
      ctx.lineTo(p.x + 6, p.y);
      ctx.moveTo(p.x, p.y - 6);
      ctx.lineTo(p.x, p.y + 6);
      ctx.stroke();
    }
  }
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of world.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    text(ctx, f.text, f.x, f.y, 15, f.color, 'center', '800');
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world, view) {
  ctx.fillStyle = PALETTE.hud;
  ctx.fillRect(0, 0, FIELD.width, HUD_H);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, HUD_H - 2, FIELD.width, 2);
  // Lives.
  ctx.fillStyle = PALETTE.heart;
  ctx.beginPath();
  ctx.arc(30, 26, 7, 0, Math.PI * 2);
  ctx.arc(42, 26, 7, 0, Math.PI * 2);
  ctx.moveTo(23, 30);
  ctx.lineTo(36, 42);
  ctx.lineTo(49, 30);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${world.lives}`, 58, 29, 22, world.lives <= 5 ? PALETTE.danger : PALETTE.text, 'left', '800');
  // Gold.
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(116, 28, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c77f0a';
  text(ctx, 'G', 116, 29, 14, '#c77f0a', 'center', '800');
  text(ctx, `${world.gold}`, 134, 29, 22, PALETTE.gold, 'left', '800');
  // Wave + score, centred.
  const waveLabel = world.phase === 'won' ? 'Garden saved!' : world.phase === 'lost' ? 'Overrun!' : `Wave ${Math.max(1, world.wave)} / ${TOTAL_WAVES}`;
  text(ctx, waveLabel, FIELD.width / 2 - 130, 29, 22, PALETTE.text, 'center', '800');
  text(ctx, `Score ${world.score}`, FIELD.width / 2 + 130, 29, 20, PALETTE.muted, 'center', '600');
  // Bugs remaining during a wave.
  if (world.phase === 'wave') {
    text(ctx, `${world.bugs.length + world.spawnQueue.length} bugs left`, FIELD.width / 2 + 290, 29, 16, PALETTE.muted, 'center', '600');
  }
  // HUD buttons.
  for (const [key, r] of Object.entries(LAYOUT.hudButtons)) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const label = key === 'speed' ? `${view.speed}x` : key === 'pause' ? (view.paused ? '▶' : '❚❚') : view.muted ? '🔇' : '🔊';
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, key === 'speed' ? 17 : 15, PALETTE.text, 'center', '700');
  }
}

function drawShop(ctx, world, view) {
  ctx.fillStyle = PALETTE.hud;
  ctx.fillRect(0, FIELD.height - SHOP_H, FIELD.width, SHOP_H);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, FIELD.height - SHOP_H, FIELD.width, 2);
  for (const card of LAYOUT.shopCards) {
    const def = TOWERS[card.key];
    const afford = world.gold >= def.cost;
    const selected = view.placing === card.key;
    ctx.fillStyle = selected ? '#3d5a2e' : afford ? PALETTE.panel : '#263026';
    roundRect(ctx, card.x, card.y, card.w, card.h, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? PALETTE.gold : PALETTE.panelEdge;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();
    drawTowerBody(ctx, card.key, card.x + 34, card.y + 42, 1, -Math.PI / 2, 0, view.time);
    text(ctx, `${def.name}`, card.x + 66, card.y + 18, 18, afford ? PALETTE.text : PALETTE.muted, 'left', '800');
    text(ctx, `${def.blurb}`, card.x + 66, card.y + 40, 12.5, PALETTE.muted, 'left', '400');
    text(ctx, `DMG ${def.damage} · RNG ${def.range}${def.splash ? ' · splash' : ''}${def.slow ? ' · slow' : ''}`, card.x + 66, card.y + 58, 12.5, PALETTE.muted, 'left', '400');
    // Cost + hotkey.
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(card.x + card.w - 52, card.y + 20, 9, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `${def.cost}`, card.x + card.w - 38, card.y + 21, 17, PALETTE.gold, 'left', '800');
    text(ctx, `[${TOWER_ORDER.indexOf(card.key) + 1}]`, card.x + card.w - 20, card.y + 56, 13, PALETTE.muted, 'right', '600');
  }
  // Start wave button.
  const r = LAYOUT.startWave;
  const waveReady = world.phase === 'build' && world.wave < TOTAL_WAVES;
  ctx.fillStyle = waveReady ? PALETTE.button : PALETTE.disabled;
  roundRect(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.strokeStyle = waveReady ? PALETTE.buttonEdge : '#44503f';
  ctx.lineWidth = 2;
  ctx.stroke();
  const label = world.phase === 'wave' ? 'Wave running…' : world.wave >= TOTAL_WAVES ? 'Final wave done' : world.wave === 0 ? 'Start Wave 1' : `Start Wave ${world.wave + 1}`;
  text(ctx, label, r.x + r.w / 2, r.y + 28, 20, waveReady ? PALETTE.buttonText : PALETTE.muted, 'center', '800');
  text(ctx, waveReady ? 'SPACE · click to begin' : 'Hold the line!', r.x + r.w / 2, r.y + 54, 13, waveReady ? '#6b4a00' : PALETTE.muted, 'center', '600');
}

/** The floating panel for a selected tower: upgrade and sell. */
export function panelRects(world, selected) {
  if (!selected) return null;
  const tower = towerAt(world, selected.col, selected.row);
  if (!tower) return null;
  const w = LAYOUT.panel.w;
  const h = LAYOUT.panel.h;
  let x = tower.x - w / 2;
  let y = tower.y - h - 46;
  x = Math.max(8, Math.min(FIELD.width - w - 8, x));
  y = Math.max(HUD_H + 8, Math.min(FIELD.height - SHOP_H - h - 8, y));
  return {
    box: { x, y, w, h },
    upgrade: { x: x + 10, y: y + h - 42, w: w - 20, h: 32 },
    sell: { x: x + 10, y: y + h - 78, w: w - 20, h: 30 },
    tower,
  };
}

function drawPanel(ctx, world, view) {
  const panel = panelRects(world, view.selected);
  if (!panel) return;
  const { tower } = panel;
  const def = TOWERS[tower.kind];
  const { box, upgrade, sell } = panel;
  ctx.fillStyle = 'rgba(16,26,15,0.94)';
  roundRect(ctx, box.x, box.y, box.w, box.h, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, `${def.name} · Lv ${tower.level}`, box.x + 12, box.y + 16, 16, PALETTE.text, 'left', '800');
  const dmg = Math.round(def.damage * Math.pow(UPGRADE.damageMul, tower.level - 1));
  text(ctx, `Damage ${dmg} · Range ${def.range + UPGRADE.rangeAdd * (tower.level - 1)}`, box.x + 12, box.y + 38, 13, PALETTE.muted, 'left', '400');
  // Sell row.
  ctx.fillStyle = '#3a4a35';
  roundRect(ctx, sell.x, sell.y, sell.w, sell.h, 7);
  ctx.fill();
  text(ctx, `Sell for ${sellValue(tower)} gold`, sell.x + sell.w / 2, sell.y + 15, 14, PALETTE.text, 'center', '700');
  // Upgrade row.
  const maxed = tower.level >= 3;
  const cost = upgradeCost(tower);
  const afford = world.gold >= cost;
  ctx.fillStyle = maxed ? PALETTE.disabled : afford ? PALETTE.button : '#4a4a35';
  roundRect(ctx, upgrade.x, upgrade.y, upgrade.w, upgrade.h, 7);
  ctx.fill();
  text(ctx, maxed ? 'Fully grown!' : `Upgrade · ${cost} gold`, upgrade.x + upgrade.w / 2, upgrade.y + 16, 14, maxed || afford ? (afford ? PALETTE.buttonText : PALETTE.muted) : PALETTE.muted, 'center', '700');
}

function drawBanner(ctx, world) {
  const b = world.banner;
  if (!b || world.time > b.until) return;
  const age = b.until - world.time;
  const alpha = Math.min(1, age / 0.6, (2.2 - age) / 0.2 + 0.2);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = 'rgba(16,26,15,0.55)';
  ctx.fillRect(0, 250, FIELD.width, 110);
  text(ctx, b.text, FIELD.width / 2, 292, 52, '#ffffff', 'center', '800');
  text(ctx, b.sub, FIELD.width / 2, 332, 20, PALETTE.gold, 'center', '600');
  ctx.globalAlpha = 1;
}

function drawToast(ctx, view) {
  if (!view.toast || view.time > view.toast.until) return;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = 'rgba(16,26,15,0.92)';
  const w = Math.min(560, view.toast.text.length * 9 + 40);
  roundRect(ctx, (FIELD.width - w) / 2, FIELD.height - SHOP_H - 44, w, 32, 8);
  ctx.fill();
  text(ctx, view.toast.text, FIELD.width / 2, FIELD.height - SHOP_H - 27, 15, PALETTE.text, 'center', '600');
  ctx.globalAlpha = 1;
}

function drawTitle(ctx, world, view) {
  ctx.fillStyle = 'rgba(12,24,12,0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = 'rgba(16,30,16,0.88)';
  roundRect(ctx, 240, 120, 800, 470, 20);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawFlower(ctx, 300, 168, '#ff8fb3', 9);
  drawFlower(ctx, 980, 168, '#ffd94d', 9);
  drawFlower(ctx, 300, 540, '#ffffff', 8);
  drawFlower(ctx, 980, 540, '#ff8fb3', 8);
  text(ctx, 'SPROUT DEFENSE', FIELD.width / 2, 195, 64, '#c8f7a0', 'center', '800');
  text(ctx, 'A garden tower defense', FIELD.width / 2, 245, 24, PALETTE.gold, 'center', '600');
  const lines = [
    'Bugs are marching on your garden. Plant Sunpetals, Briars and',
    'Frostmints beside the path, stop all 12 waves, and keep 20 lives.',
    '',
    'Click a plant card (or press 1 / 2 / 3), then click a plot to plant.',
    'Click a planted tower to upgrade or sell it. SPACE starts a wave.',
  ];
  lines.forEach((line, i) => {
    if (line) text(ctx, line, FIELD.width / 2, 300 + i * 30, 18, PALETTE.text, 'center', '500');
  });
  // Start button.
  ctx.fillStyle = PALETTE.button;
  roundRect(ctx, 490, 470, 300, 64, 14);
  ctx.fill();
  ctx.strokeStyle = PALETTE.buttonEdge;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  text(ctx, '▶  Start the garden', FIELD.width / 2, 503, 24, PALETTE.buttonText, 'center', '800');
  if (view.best > 0) text(ctx, `Best score: ${view.best}`, FIELD.width / 2, 562, 17, PALETTE.muted, 'center', '600');
}

function drawEnd(ctx, world, view, won) {
  ctx.fillStyle = won ? 'rgba(20,50,20,0.55)' : 'rgba(50,16,16,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = 'rgba(16,30,16,1)';
  roundRect(ctx, 290, 130, 700, 450, 20);
  ctx.fill();
  ctx.strokeStyle = won ? '#7ec850' : '#ff6b5e';
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, won ? '🌻 Garden Saved!' : '🥀 The Garden Fell', FIELD.width / 2, 195, 48, won ? '#c8f7a0' : '#ffb3ab', 'center', '800');
  text(ctx, won ? 'Every wave beaten — the sprouts can grow in peace.' : `The bugs broke through on wave ${Math.max(1, world.wave)}.`, FIELD.width / 2, 245, 19, PALETTE.muted, 'center', '500');
  const rows = [
    ['Score', `${world.score}`],
    ['Waves cleared', `${won ? TOTAL_WAVES : world.wave - (world.phase === 'lost' ? 1 : 0)} / ${TOTAL_WAVES}`],
    ['Bugs squashed', `${world.kills}`],
    ['Gold earned', `${world.earned}`],
    ['Lives left', `${world.lives}`],
    ['Best score', `${Math.max(view.best, world.score)}`],
  ];
  rows.forEach(([label, value], i) => {
    const y = 295 + i * 34;
    text(ctx, label, 380, y, 18, PALETTE.muted, 'left', '500');
    text(ctx, value, 900, y, 18, PALETTE.text, 'right', '800');
  });
  ctx.fillStyle = PALETTE.button;
  roundRect(ctx, 490, 500, 300, 56, 12);
  ctx.fill();
  text(ctx, '↻  Play again  (R)', FIELD.width / 2, 529, 22, PALETTE.buttonText, 'center', '800');
}

/** Draw the whole frame for the current view. */
export function draw(ctx, world, view) {
  const t = view.time;
  drawBackground(ctx, world);
  // Range ring + ghost while placing.
  if (view.placing && view.hoverCell) {
    const { x, y } = cellCentre(view.hoverCell.col, view.hoverCell.row);
    const def = TOWERS[view.placing];
    const ok = view.hoverOk;
    drawRangeRing(ctx, x, y, def.range, ok);
    ctx.globalAlpha = ok ? 0.75 : 0.45;
    drawTowerBody(ctx, view.placing, x, y, 1, -Math.PI / 2, 0, t);
    ctx.globalAlpha = 1;
  }
  // Range ring for a selected tower.
  if (view.selected) {
    const tower = towerAt(world, view.selected.col, view.selected.row);
    if (tower) {
      const def = TOWERS[tower.kind];
      drawRangeRing(ctx, tower.x, tower.y, def.range + UPGRADE.rangeAdd * (tower.level - 1), true);
    }
  }
  for (const tower of world.towers) {
    drawTowerBody(ctx, tower.kind, tower.x, tower.y, tower.level, tower.angle, tower.flash, t);
  }
  for (const bug of world.bugs) drawBug(ctx, bug, t);
  drawProjectiles(ctx, world);
  drawParticles(ctx, world);
  drawHud(ctx, world, view);
  drawShop(ctx, world, view);
  drawPanel(ctx, world, view);
  if (view.screen !== SCREEN_WON && view.screen !== SCREEN_LOST) drawBanner(ctx, world);
  drawToast(ctx, view);
  if (view.screen === SCREEN_TITLE) drawTitle(ctx, world, view);
  if (view.screen === SCREEN_WON) drawEnd(ctx, world, view, true);
  if (view.screen === SCREEN_LOST) drawEnd(ctx, world, view, false);
  if (view.paused && view.screen === SCREEN_PLAY) {
    ctx.fillStyle = 'rgba(12,24,12,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(ctx, '❚❚  Paused', FIELD.width / 2, 340, 52, PALETTE.text, 'center', '800');
    text(ctx, 'Press P or click ▶ to keep playing', FIELD.width / 2, 392, 19, PALETTE.muted, 'center', '500');
  }
}
