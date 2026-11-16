// A small seeded random generator (mulberry32), so a screenshot scene with a fixed
// seed always plays the same, and a real game can still roll fresh seeds.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh, unrepeatable seed from the clock and Math.random. */
export function freshSeed() {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

/** Pick one of `items` using `rng`. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** A number in [min, max) from `rng`. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}
