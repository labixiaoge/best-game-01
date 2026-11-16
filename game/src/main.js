// Sprout Defense: the game loop and screen state. It owns the canvas transform
// (the 1280x720 field letterboxed into the window), the fixed-step simulation,
// the screens (title, play, won, lost) and the screenshot staging hook.

import { BEST_KEY, FIELD, GRID, STEP, TOWER_ORDER } from './config.js';
import { freshSeed } from './random.js';
import { attachInput, hitTest } from './input.js';
import {
  SCREEN_LOST, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON, draw,
} from './render.js';
import {
  EVENT_KILL, EVENT_LEAK, EVENT_LOST, EVENT_PLACE, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WON,
  autopilot, canPlace, createWorld, placeTower, resetWorld, sellTower,
  startWave, stepParticlesOnly, stepWorld, towerAt, upgradeTower,
} from './world.js';
import { isMuted, setMuted, sfx, unlockAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '') || freshSeed();

const world = createWorld(seed);
const view = {
  screen: SCREEN_TITLE,
  time: 0,
  placing: null,
  selected: null,
  hoverCell: null,
  hoverOk: false,
  best: readBest(),
  speed: 1,
  paused: false,
  muted: isMuted(),
  toast: null,
};

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  if (score <= view.best) return;
  view.best = score;
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private mode: the best score just lives for this visit.
  }
}

function toast(text) {
  view.toast = { text, until: view.time + 2.4 };
}

function say(text) {
  if (statusEl) statusEl.textContent = text;
}

/** Letterbox transform: scale the 1280x720 field into the window. */
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  scale = Math.min(w / FIELD.width, h / FIELD.height);
  offsetX = (w - FIELD.width * scale) / 2;
  offsetY = (h - FIELD.height * scale) / 2;
}

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - offsetX) / scale,
    y: (clientY - rect.top - offsetY) / scale,
  };
}

function drawFrame() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#101a10';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  draw(ctx, world, view);
}

function playEvents(events) {
  for (const e of events) {
    if (e === EVENT_SHOOT) sfx.shoot();
    else if (e === EVENT_KILL) sfx.pop();
    else if (e === EVENT_LEAK) sfx.leak();
    else if (e === EVENT_WAVE_CLEAR) sfx.coin();
    else if (e === EVENT_WON) sfx.win();
    else if (e === EVENT_LOST) sfx.lose();
    else if (e === EVENT_PLACE) sfx.place();
  }
}

function beginPlay() {
  resetWorld(world, freshSeed());
  view.screen = SCREEN_PLAY;
  view.placing = null;
  view.selected = null;
  view.paused = false;
  view.speed = 1;
  say('Sprout Defense started. Plant towers beside the path, then start wave 1.');
  toast('Plant a tower, then start wave 1 (SPACE)');
}

function endGame(won) {
  view.screen = won ? SCREEN_WON : SCREEN_LOST;
  view.placing = null;
  view.selected = null;
  saveBest(world.score);
  say(won
    ? `Victory! Final score ${world.score}.`
    : `Defeat on wave ${world.wave}. Final score ${world.score}.`);
}

function onClick(p) {
  unlockAudio();
  const hit = hitTest(view, world, p);
  if (hit.type === 'titleStart') {
    sfx.click();
    beginPlay();
    return;
  }
  if (hit.type === 'endRestart') {
    sfx.click();
    beginPlay();
    return;
  }
  if (view.screen !== SCREEN_PLAY || view.paused) {
    if (hit.type === 'hudButton' && hit.key === 'pause') view.paused = !view.paused;
    return;
  }
  if (hit.type === 'hudButton') {
    if (hit.key === 'speed') {
      view.speed = view.speed === 1 ? 2 : 1;
      sfx.click();
    } else if (hit.key === 'pause') {
      view.paused = !view.paused;
      sfx.click();
    } else if (hit.key === 'mute') {
      setMuted(!isMuted());
      view.muted = isMuted();
      sfx.click();
    }
    return;
  }
  if (hit.type === 'shopCard') {
    view.placing = view.placing === hit.key ? null : hit.key;
    view.selected = null;
    sfx.click();
    return;
  }
  if (hit.type === 'startWave') {
    if (startWave(world)) {
      sfx.wave();
      say(`Wave ${world.wave} started.`);
    }
    return;
  }
  if (hit.type === 'panel') {
    const tower = towerAt(world, view.selected.col, view.selected.row);
    if (!tower) {
      view.selected = null;
      return;
    }
    if (hit.action === 'upgrade') {
      const problem = upgradeTower(world, tower);
      if (problem) toast(problem);
      else sfx.upgrade();
    } else if (hit.action === 'sell') {
      sellTower(world, tower);
      sfx.sell();
      view.selected = null;
    }
    return;
  }
  if (hit.type === 'cell') {
    if (view.placing) {
      const problem = placeTower(world, view.placing, hit.col, hit.row);
      if (problem) {
        toast(problem);
      } else {
        view.placing = null;
      }
      return;
    }
    const tower = towerAt(world, hit.col, hit.row);
    view.selected = tower ? { col: hit.col, row: hit.row } : null;
    if (tower) sfx.click();
  }
}

function onKey(key) {
  unlockAudio();
  if (view.screen === SCREEN_TITLE && (key === 'enter' || key === ' ')) {
    beginPlay();
    return;
  }
  if ((view.screen === SCREEN_WON || view.screen === SCREEN_LOST) && (key === 'r' || key === 'enter')) {
    beginPlay();
    return;
  }
  if (view.screen !== SCREEN_PLAY) return;
  if (key >= '1' && key <= '3') {
    const kind = TOWER_ORDER[Number(key) - 1];
    view.placing = view.placing === kind ? null : kind;
    view.selected = null;
    sfx.click();
  } else if (key === 'escape') {
    view.placing = null;
    view.selected = null;
  } else if (key === ' ') {
    if (startWave(world)) sfx.wave();
  } else if (key === 'p') {
    view.paused = !view.paused;
  } else if (key === 'f') {
    view.speed = view.speed === 1 ? 2 : 1;
  } else if (key === 'm') {
    setMuted(!isMuted());
    view.muted = isMuted();
  }
}

function onHover(mouse) {
  const cell = mouse.x >= 0
    ? { col: Math.floor((mouse.x - GRID.x) / GRID.cell), row: Math.floor((mouse.y - GRID.y) / GRID.cell) }
    : null;
  const valid = cell && cell.col >= 0 && cell.col < GRID.cols && cell.row >= 0 && cell.row < GRID.rows;
  view.hoverCell = valid ? cell : null;
  view.hoverOk = !!valid && view.placing ? !canPlace(world, view.placing, cell.col, cell.row) : false;
}

attachInput(canvas, toLogical, {
  onHover,
  onClick,
  onRightClick() {
    view.placing = null;
    view.selected = null;
  },
  onKey,
});

// A debug handle for play-testing (read the live world and view from a console
// or an automated test); it changes nothing about the game.
window.__sprout = { world, view };

window.addEventListener('resize', resize);
resize();

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  view.time += dt;
  if (view.screen === SCREEN_TITLE) {
    // Attract mode: the garden plays itself behind the title panel.
    acc += dt;
    while (acc >= STEP) {
      autopilot(world);
      const events = stepWorld(world, STEP);
      acc -= STEP;
      if (world.phase === 'lost' || world.phase === 'won') resetWorld(world, freshSeed());
    }
  } else if (view.screen === SCREEN_PLAY && !view.paused) {
    acc += dt * view.speed;
    let guard = 0;
    while (acc >= STEP && guard < 240) {
      const events = stepWorld(world, STEP);
      playEvents(events);
      acc -= STEP;
      guard += 1;
      if (world.phase === 'won') {
        endGame(true);
        break;
      }
      if (world.phase === 'lost') {
        endGame(false);
        break;
      }
    }
  } else if (view.screen === SCREEN_PLAY && view.paused) {
    // Paused: the garden freezes; draw only.
  } else {
    // Won/lost screens keep their particles drifting.
    acc += dt;
    while (acc >= STEP) {
      stepParticlesOnly(world, STEP);
      acc -= STEP;
    }
  }
  drawFrame();
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot staging: build the named scene from the real rules, draw one
  // frame and stop, so a screenshot is exactly this frame.
  const staged = stageShot(shotName, world);
  view.screen = staged.screen;
  view.best = staged.best;
  view.placing = null;
  view.selected = null;
  drawFrame();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
