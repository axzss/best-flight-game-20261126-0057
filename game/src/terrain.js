// The valley the plane flies over: a ground-height profile, field colours, trees, a river
// crossing and the grass strip, all grown from the seed so the same seed builds the same
// valley. The profile is a sum of slow sines with seeded phases, flattened near the runway
// so the strip sits on level ground.

import { BAND_LENGTH, DRAW_DISTANCE, RUNWAY } from './config.js';
import { createRandom, range } from './random.js';

/** How far past the runway the valley keeps going, so the course never ends at a wall. */
const VALLEY_END = 5600;

function sineSum(phases, z) {
  let height = 0;
  height += Math.sin(z * 0.0011 + phases[0]) * 7;
  height += Math.sin(z * 0.0029 + phases[1]) * 4.5;
  height += Math.sin(z * 0.0073 + phases[2]) * 2;
  height += Math.sin(z * 0.0004 + phases[3]) * 9;
  return height;
}

/**
 * Build the valley for a seed. Returns the ground height at any z, the field colour of any
 * ground band, the trees (billboards with a fixed world spot) and the rings' world spots
 * for a mission, plus the runway strip itself.
 */
export function createValley(seed) {
  const random = createRandom(seed);
  const phases = [random() * 6.283, random() * 6.283, random() * 6.283, random() * 6.283];
  const base = 14 + random() * 6;

  // One field colour per ground band, chosen once, so the patchwork never flickers.
  const bandCount = Math.ceil((VALLEY_END + DRAW_DISTANCE) / BAND_LENGTH) + 2;
  const fieldKinds = [];
  for (let index = 0; index < bandCount; index += 1) {
    fieldKinds.push(Math.floor(random() * 4));
  }

  // Trees stand beside the course, never on it: |x| between 24 and 90.
  const trees = [];
  for (let z = 120; z < VALLEY_END; z += 34) {
    const count = 1 + Math.floor(random() * 2);
    for (let n = 0; n < count; n += 1) {
      const side = random() < 0.5 ? -1 : 1;
      trees.push({
        x: side * range(random, 24, 90),
        z: z + range(random, -12, 12),
        size: range(random, 4.5, 8.5),
        shade: random(),
      });
    }
  }

  // The river cuts across the valley once, a band of blue the pilot crosses low.
  const riverZ = 1900 + Math.floor(random() * 600);

  // Hills on both valley walls: a height per 200-unit stretch, seeded, so the walls roll.
  const wallCount = Math.ceil(VALLEY_END / 200) + 2;
  const wallLeft = [];
  const wallRight = [];
  for (let index = 0; index < wallCount; index += 1) {
    wallLeft.push(26 + random() * 30);
    wallRight.push(26 + random() * 30);
  }

  function rawHeight(z) {
    return base + sineSum(phases, z);
  }

  /** Ground height at distance z, flattened to a level strip under the runway. */
  function groundHeight(z) {
    const h = rawHeight(z);
    const flat = rawHeight(RUNWAY.startZ + RUNWAY.length / 2);
    const edge = 260;
    const before = RUNWAY.startZ - edge;
    const after = RUNWAY.startZ + RUNWAY.length + edge;
    if (z < before || z > after) return h;
    if (z >= RUNWAY.startZ && z <= RUNWAY.startZ + RUNWAY.length) return flat;
    if (z < RUNWAY.startZ) {
      const t = (z - before) / edge;
      return h + (flat - h) * t * t * (3 - 2 * t);
    }
    const t = (z - (RUNWAY.startZ + RUNWAY.length)) / edge;
    return flat + (h - flat) * t * t * (3 - 2 * t);
  }

  return {
    groundHeight,
    runwayHeight: rawHeight(RUNWAY.startZ + RUNWAY.length / 2),
    riverZ,
    fieldKindAt(z) {
      const index = Math.floor(z / BAND_LENGTH);
      if (index < 0) return 0;
      return fieldKinds[index % fieldKinds.length];
    },
    wallHeightAt(z, side) {
      const index = Math.floor(z / 200);
      const list = side < 0 ? wallLeft : wallRight;
      const a = list[Math.min(index, list.length - 1)];
      const b = list[Math.min(index + 1, list.length - 1)];
      const t = (z - index * 200) / 200;
      return a + (b - a) * t;
    },
    trees,
    /** Rings for a mission: a ladder of gates weaving across the valley. */
    ringsFor(count, startZ, spacing) {
      const rings = [];
      let x = 0;
      let y = 0;
      for (let n = 0; n < count; n += 1) {
        const z = startZ + n * spacing;
        x = Math.max(-16, Math.min(16, x + range(random, -13, 13)));
        const ground = groundHeight(z);
        y = Math.max(ground + 12, Math.min(ground + 42, ground + 22 + range(random, -11, 11)));
        rings.push({ x, y, z, passed: false });
      }
      return rings;
    },
  };
}
