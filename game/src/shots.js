// The screenshot scenes behind ?shot=start|play|runway|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (bank toward the next gate, pitch toward its height, throttle to hold a target speed,
// flare for the strip), so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { RUNWAY, STEP, TITLE_SECONDS } from './config.js';
import { MISSION_LANDING, MISSION_RING_RUN } from './missions.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
/** How far before the strip the runway shot stops: close enough to read it. */
const RUNWAY_APPROACH = 120;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/**
 * The autopilot's stick for one step. `target` is { x, y, speed } to chase; the plane
 * banks toward the target's x, pitches toward its y, and works the throttle to hold the
 * target speed. It also pulls up hard whenever the ground gets close — except on a
 * landing approach, where the strip itself is the ground it is aiming for.
 */
export function autopilot(state, target, landing) {
  const plane = state.plane;
  const ground = state.valley.groundHeight(plane.z);
  const dx = target.x - plane.x;
  const dy = target.y - plane.y;
  const headingError = plane.heading - 90;
  let roll = clamp(dx * 0.1 - headingError * 0.06, -1, 1);
  let pitch = clamp(dy * 0.08, -1, 1);
  let throttle = 0;
  if (plane.speed < target.speed - 2) throttle = 1;
  else if (plane.speed > target.speed + 3) throttle = -1;
  // Never climb into a stall: hold the nose down and push the throttle when slow.
  if (plane.speed < 36) {
    pitch = Math.min(pitch, 0.15);
    throttle = 1;
  }
  // The ground is not negotiable: pull up — unless this is a landing approach lined
  // up on the strip, where the pull-up floor is the strip itself.
  const onFinal = landing && plane.z > RUNWAY.startZ - 600 && Math.abs(plane.x) < 12;
  const floor = onFinal ? 2.6 : 9;
  if (plane.y - ground < floor && plane.verticalSpeed < 1) {
    pitch = 1;
    roll = clamp(roll * 0.3, -0.4, 0.4);
  }
  return { pitch, roll, throttle };
}

/** Where the autopilot aims on the Ring Run: the next gate, or the valley ahead. */
export function ringTarget(world) {
  const ring = world.nextRing();
  if (ring) return { x: ring.x, y: ring.y, speed: 52 };
  return { x: 0, y: world.state.valley.groundHeight(world.state.plane.z) + 22, speed: 50 };
}

/**
 * Where the autopilot aims on the landing sortie: a steady descent onto the strip.
 * The approach follows the terrain ahead — the ground rises into the flattened strip,
 * so the target is always the ground a little ahead plus a clearance, never the strip
 * height alone, until the flare over the grass itself.
 */
function landingTarget(world) {
  const plane = world.state.plane;
  const valley = world.state.valley;
  const strip = valley.runwayHeight;
  const toThreshold = RUNWAY.startZ - plane.z;
  if (toThreshold > 1200) return { x: 0, y: valley.groundHeight(plane.z + 150) + 26, speed: 48 };
  if (toThreshold > 400) return { x: 0, y: valley.groundHeight(plane.z + 150) + 12, speed: 42 };
  if (toThreshold > 60) return { x: 0, y: Math.max(valley.groundHeight(plane.z + 100) + 5, strip + 3.5), speed: 36 };
  // Flare: level the wings, ease the sink, let her settle.
  return { x: 0, y: strip + 2.2, speed: 32 };
}

/**
 * Set `world` to the named scene (start, play, runway or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset(MISSION_RING_RUN);
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world.state, ringTarget(world)), true);
      if (world.state.over) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'runway') {
    world.reset(MISSION_LANDING);
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world.state, landingTarget(world), true), true);
      if (world.state.over || world.state.plane.z >= RUNWAY.startZ - RUNWAY_APPROACH) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    world.reset(MISSION_LANDING);
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world.state, landingTarget(world), true), true);
      if (world.state.over) break;
    }
    return { screen: SCREEN_OVER, best: world.state.overScore };
  }
  world.reset(MISSION_RING_RUN);
  for (let index = 0; index < TITLE_SECONDS / STEP; index += 1) {
    world.step(STEP, autopilot(world.state, ringTarget(world)), true);
    if (world.state.over) break;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
