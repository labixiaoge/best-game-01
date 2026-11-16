// The screenshot scenes behind ?shot=start|play|late|end. Each one plays the
// real rules forward from a fresh world for a fixed stretch, steered by the
// same autopilot a headless balance check uses, so the frame is what a real
// game looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_LOST, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import {
  autopilot, createWorld, placeTower, resetWorld, stepWorld,
} from './world.js';

/** A plausible best score to show on the title and end screens. */
const SHOT_BEST = 3180;

function runSteps(world, seconds, until) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    autopilot(world);
    stepWorld(world, STEP);
    if (until && until(world)) return true;
  }
  return !!until && until(world);
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Any other name is the title scene.
 */
export function stageShot(name, world) {
  if (name === 'play' || name === 'late') {
    const targetWave = name === 'play' ? 3 : 9;
    const minBugs = name === 'play' ? 5 : 9;
    resetWorld(world, world.seed);
    // Play forward until the target wave is well under way: bugs deep into the
    // tower zone, with shots already in the air.
    runSteps(world, 600, (w) => w.phase === 'wave' && w.wave === targetWave
      && w.bugs.length >= minBugs
      && w.bugs.some((b) => b.dist > 500)
      && w.projectiles.length > 0);
    // A few more frames, so projectiles are mid-flight and a float is showing.
    runSteps(world, 0.4, null);
    return { screen: SCREEN_PLAY, best: SHOT_BEST };
  }
  if (name === 'end') {
    resetWorld(world, world.seed);
    // Play the whole game out with the autopilot.
    runSteps(world, 900, (w) => w.phase === 'won' || w.phase === 'lost');
    if (world.phase !== 'won') {
      // The autopilot fell short: give the garden a head start and try again.
      resetWorld(world, world.seed);
      world.gold += 500;
      autopilot(world);
      runSteps(world, 900, (w) => w.phase === 'won' || w.phase === 'lost');
    }
    if (world.phase === 'won') return { screen: SCREEN_WON, best: Math.max(SHOT_BEST, world.score) };
    // Last resort: the end screen still shows a real, finished game.
    return { screen: SCREEN_LOST, best: SHOT_BEST };
  }
  // Title: a few seconds of attract mode behind the title panel.
  resetWorld(world, world.seed);
  runSteps(world, 6, null);
  return { screen: SCREEN_TITLE, best: SHOT_BEST };
}

export { createWorld, SCREEN_LOST, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON };
