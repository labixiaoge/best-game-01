// Sprout Defense: keyboard and mouse, turned into game verbs. The canvas is
// scaled to the window with letterboxing; this module maps client pixels back
// to the 1280x720 logical field and hit-tests the HUD, shop and tower panel.

import { FIELD } from './config.js';
import { LAYOUT, panelRects } from './render.js';
import { cellFromPoint } from './world.js';

function inside(r, x, y) {
  return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * Attach input to `canvas`. `toLogical` converts a client point to logical
 * coordinates (provided by main.js, which owns the canvas transform).
 * `handlers` receives the verbs: shopCard, startWave, hudButton, cell, panel,
 * titleStart, endRestart, key.
 */
export function attachInput(canvas, toLogical, handlers) {
  let mouse = { x: -1, y: -1 };

  function logicalFromEvent(event) {
    return toLogical(event.clientX, event.clientY);
  }

  canvas.addEventListener('mousemove', (event) => {
    mouse = logicalFromEvent(event);
    handlers.onHover(mouse);
  });
  canvas.addEventListener('mouseleave', () => {
    mouse = { x: -1, y: -1 };
    handlers.onHover(mouse);
  });
  canvas.addEventListener('click', (event) => {
    const p = logicalFromEvent(event);
    handlers.onClick(p);
  });
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    handlers.onRightClick(logicalFromEvent(event));
  });
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    handlers.onKey(event.key.toLowerCase());
  });

  return {
    mouse() {
      return mouse;
    },
  };
}

/**
 * Which UI element a logical point hits, given the current view:
 * a shop card, the start-wave button, a HUD button, the tower panel's buttons,
 * the title start button, the end restart button, or a garden cell.
 */
export function hitTest(view, world, p) {
  if (view.screen === 'title') {
    if (inside({ x: 490, y: 470, w: 300, h: 64 }, p.x, p.y)) return { type: 'titleStart' };
    return { type: 'none' };
  }
  if (view.screen === 'won' || view.screen === 'lost') {
    if (inside({ x: 490, y: 500, w: 300, h: 56 }, p.x, p.y)) return { type: 'endRestart' };
    return { type: 'none' };
  }
  for (const [key, r] of Object.entries(LAYOUT.hudButtons)) {
    if (inside(r, p.x, p.y)) return { type: 'hudButton', key };
  }
  for (const card of LAYOUT.shopCards) {
    if (inside(card, p.x, p.y)) return { type: 'shopCard', key: card.key };
  }
  if (inside(LAYOUT.startWave, p.x, p.y)) return { type: 'startWave' };
  const panel = panelRects(world, view.selected);
  if (panel) {
    if (inside(panel.upgrade, p.x, p.y)) return { type: 'panel', action: 'upgrade' };
    if (inside(panel.sell, p.x, p.y)) return { type: 'panel', action: 'sell' };
    if (inside(panel.box, p.x, p.y)) return { type: 'panel', action: 'box' };
  }
  const cell = cellFromPoint(p.x, p.y);
  if (cell) return { type: 'cell', ...cell };
  return { type: 'none' };
}

export { FIELD };
