[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/labixiaoge/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/labixiaoge/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Sprout Defense

A garden tower defense for the make.fun **best-game-01** bounty ("Make the best
game", $1,000). Bugs are marching on your garden: plant Sunpetals, Briars and
Frostmints beside the path, stop all 12 waves, and keep your 20 lives.

## Play it

Serve `game/` with Node 22 and open it in a desktop browser:

```sh
node serve.ts
# → http://localhost:8080
```

No build step, no libraries, no network requests at runtime — the game is
plain static files (`game/index.html` plus ES modules under `game/src/`), and
its sounds are synthesised with the Web Audio API.

## How to play

- **Click a plant card** (or press `1` / `2` / `3`), then click a garden plot
  to plant it. Hovering a plot shows the plant's range.
- **Click a planted tower** to upgrade it (up to level 3) or sell it back.
- **SPACE** (or the Start Wave button) sends the next wave. `P` pauses,
  `F` toggles 2x speed, `M` mutes, `R` restarts from an end screen.
- **Sunpetal** (50g): fast, sunny shots. **Briar** (100g): slow, heavy thorns
  that burst on impact. **Frostmint** (75g): chilling leaves that slow bugs.
- Bugs pay gold when squashed; clearing a wave pays a bonus. A bug that walks
  off the path costs lives — snails cost 2. Lose all 20 lives and the garden
  falls; clear wave 12 and the garden is saved.

## Files

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `config.js` (tuning, waves, palette), `random.js` (seeded RNG),
  `world.js` (the simulation, DOM-free), `render.js` (all canvas drawing),
  `input.js` (keyboard and mouse), `audio.js` (synthesised sounds),
  `shots.js` (deterministic screenshot scenes), `main.js` (loop and screens)
- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with `vendor/makefun-game.ts`
- `shots.json` — the four screenshot scenes (`?shot=start|play|late|end`)
- `screenshots/` — 1-start, 2-play, 3-late, 4-end (real renders of the game)

## License

MIT — see `LICENSE`.
