// A small seeded random number generator (mulberry32): the same seed gives the same valley,
// the same rings and the same trees, which is what makes the screenshot scenes repeatable.
// Nothing in the game ever rolls unseeded dice; every roll comes from a generator built here.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A roll in [min, max) from a seeded generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one entry of an array with a seeded generator. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
