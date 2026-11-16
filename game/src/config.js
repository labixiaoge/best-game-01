// Sprout Defense: every tuning number, colour and level in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Top HUD bar and bottom shop bar, in logical pixels. */
export const HUD_H = 56;
export const SHOP_H = 84;

/** The buildable grid: 12 columns x 7 rows of 80px cells. */
export const GRID = { cols: 12, rows: 7, cell: 80, x: 160, y: 66 };

/**
 * The bug path, as grid cells walked in order. It enters from the left on row 1,
 * snakes down and back, and leaves on the right on row 5. Built from the cell
 * centres, with the two off-screen ends added by world.js.
 */
export const PATH_CELLS = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1],
  [8, 2], [8, 3],
  [7, 3], [6, 3], [5, 3], [4, 3], [3, 3],
  [3, 4], [3, 5],
  [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5],
];

export const START_GOLD = 160;
export const START_LIVES = 20;
export const TOTAL_WAVES = 12;
export const MAX_TOWER_LEVEL = 3;

/** A tower kind: cost, reach, damage, shots per second and what makes it special. */
export const TOWERS = {
  sunpetal: {
    key: 'sunpetal', name: 'Sunpetal', short: 'Sun', cost: 50,
    range: 135, damage: 9, rate: 2.0, projSpeed: 460, splash: 0, slow: 0,
    blurb: 'Fast, sunny shots. Cheap and cheerful.',
    petal: '#ffd94d', core: '#ff9f1c', stem: '#3e9b4f',
  },
  briar: {
    key: 'briar', name: 'Briar', short: 'Bri', cost: 100,
    range: 115, damage: 36, rate: 0.55, projSpeed: 340, splash: 58, slow: 0,
    blurb: 'Slow, heavy thorns that burst on impact.',
    petal: '#b388ff', core: '#7c4dff', stem: '#5e35b1',
  },
  frostmint: {
    key: 'frostmint', name: 'Frostmint', short: 'Fro', cost: 75,
    range: 155, damage: 5, rate: 1.2, projSpeed: 400, splash: 0, slow: 0.45, slowSecs: 2.0,
    blurb: 'Chilling leaves that slow the whole swarm.',
    petal: '#7de3ff', core: '#29b6f6', stem: '#2e8b8b',
  },
};
export const TOWER_ORDER = ['sunpetal', 'briar', 'frostmint'];

/** Upgrade cost is a share of the tower's base cost; each level multiplies damage. */
export const UPGRADE = { costShare: 0.8, damageMul: 1.6, rangeAdd: 12, sellRefund: 0.7 };

/** A bug kind: health, speed, gold bounty and lives lost when it leaks through. */
export const BUGS = {
  aphid: { key: 'aphid', name: 'Aphid', hp: 26, speed: 62, bounty: 4, lives: 1, radius: 13, body: '#7ec850', dark: '#4e9a2e', belly: '#a8e063' },
  beetle: { key: 'beetle', name: 'Beetle', hp: 72, speed: 42, bounty: 7, lives: 1, radius: 15, body: '#8d6e63', dark: '#5d4037', belly: '#bcaaa4' },
  snail: { key: 'snail', name: 'Snail', hp: 200, speed: 26, bounty: 12, lives: 2, radius: 17, body: '#ffb74d', dark: '#e65100', belly: '#ffe0b2' },
  wasp: { key: 'wasp', name: 'Wasp', hp: 36, speed: 96, bounty: 5, lives: 1, radius: 12, body: '#fdd835', dark: '#212121', belly: '#fff176' },
};
export const BUG_ORDER = ['aphid', 'beetle', 'snail', 'wasp'];

/** Health and speed grow a little every wave, so late waves need upgraded towers. */
export const WAVE_SCALE = { hpPerWave: 0.28, speedPerWave: 0.03 };

/**
 * The twelve waves. Each group spawns its bugs one at a time, `gap` seconds apart,
 * and the next group starts once the previous one has finished spawning.
 */
export const WAVES = [
  { groups: [{ kind: 'aphid', count: 8, gap: 0.9 }] },
  { groups: [{ kind: 'aphid', count: 12, gap: 0.8 }] },
  { groups: [{ kind: 'aphid', count: 10, gap: 0.7 }, { kind: 'beetle', count: 4, gap: 1.0 }] },
  { groups: [{ kind: 'beetle', count: 8, gap: 0.9 }, { kind: 'aphid', count: 8, gap: 0.6 }] },
  { groups: [{ kind: 'snail', count: 3, gap: 1.6 }, { kind: 'beetle', count: 6, gap: 0.9 }, { kind: 'aphid', count: 10, gap: 0.55 }] },
  { groups: [{ kind: 'wasp', count: 10, gap: 0.55 }, { kind: 'beetle', count: 6, gap: 0.9 }] },
  { groups: [{ kind: 'snail', count: 5, gap: 1.4 }, { kind: 'wasp', count: 8, gap: 0.5 }, { kind: 'aphid', count: 12, gap: 0.5 }] },
  { groups: [{ kind: 'beetle', count: 12, gap: 0.7 }, { kind: 'snail', count: 4, gap: 1.3 }, { kind: 'wasp', count: 10, gap: 0.45 }] },
  { groups: [{ kind: 'snail', count: 7, gap: 1.2 }, { kind: 'beetle', count: 10, gap: 0.65 }, { kind: 'wasp', count: 12, gap: 0.4 }] },
  { groups: [{ kind: 'wasp', count: 18, gap: 0.38 }, { kind: 'snail', count: 6, gap: 1.1 }, { kind: 'beetle', count: 8, gap: 0.6 }] },
  { groups: [{ kind: 'snail', count: 10, gap: 1.0 }, { kind: 'beetle', count: 14, gap: 0.55 }, { kind: 'wasp', count: 14, gap: 0.35 }, { kind: 'aphid', count: 16, gap: 0.4 }] },
  { groups: [{ kind: 'snail', count: 12, gap: 0.9 }, { kind: 'beetle', count: 16, gap: 0.5 }, { kind: 'wasp', count: 20, gap: 0.32 }, { kind: 'aphid', count: 20, gap: 0.35 }] },
];

/** Gold for clearing a wave: a flat part plus a part that grows with the wave. */
export const WAVE_BONUS = { flat: 20, perWave: 4 };

/** Score: kills and cleared waves while playing, lives and leftover gold at the end. */
export const SCORE = { perKill: 10, perWave: 150, perLife: 25, perGold: 1 };

export const PALETTE = {
  sky: '#1e3a2f',
  grassA: '#2e6b34',
  grassB: '#35823a',
  grassDark: '#27602c',
  path: '#c9a06a',
  pathEdge: '#a67c4e',
  pathStone: '#d8bd8f',
  plot: '#3c7a3e',
  plotEdge: '#2c5c2e',
  plotHover: '#4c9450',
  panel: '#20301f',
  panelEdge: '#3a5a38',
  hud: '#1b2b1a',
  text: '#f4f8e8',
  muted: '#b9c9a8',
  gold: '#ffd94d',
  heart: '#ff5a6e',
  danger: '#ff6b5e',
  frost: '#7de3ff',
  button: '#ffb020',
  buttonEdge: '#c77f0a',
  buttonText: '#3a2400',
  disabled: '#5a6b52',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sprout-defense.best';
