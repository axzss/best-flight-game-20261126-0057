// The three sorties, and what counts as doing them well. A mission is a goal, a set of
// gates in the valley and a way to score: rings reward a steady hand, the strip rewards a
// gentle one, and the clock rewards a fast one. The world owns the mission state; the
// renderer only reads it.

import { COURSE, RING, RUNWAY } from './config.js';
import { createPlane, stepPlane, judgeTouchdown, courseTimeLeft } from './physics.js';
import { createValley } from './terrain.js';

export const MISSION_RING_RUN = 0;
export const MISSION_LANDING = 1;
export const MISSION_TIMED = 2;

export const MISSION_NAMES = ['RING RUN', 'GRASS STRIP LANDING', 'TIMED COURSE'];
export const MISSION_BLURBS = [
  'Fly all 10 rings. Smooth turns win — a hard bank bleeds the speed you need.',
  'Put her down on the grass strip at 4,200 m. Slow, level and gentle, or she breaks.',
  '8 rings against a 75-second clock. Every ring buys 9 more seconds. Fly fast.',
];

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_TIMEOUT = 8;
export const EVENT_OUT_OF_FUEL = 16;

/**
 * A fresh world for a seed: the valley, a plane, and the mission the player picked.
 * The world is reset, never rebuilt, so a reset world is the same world again.
 */
export function createWorld(seed) {
  const valley = createValley(seed);
  const state = {
    seed,
    valley,
    plane: createPlane(),
    mission: MISSION_RING_RUN,
    rings: [],
    nextRing: 0,
    score: 0,
    ringsPassed: 0,
    message: '',
    messageTime: 0,
    over: false,
    overReason: '',
    overScore: 0,
    // A short-lived flash and popup when a ring is flown through.
    ringFlash: 0,
    popup: '',
    popupTime: 0,
    best: 0,
  };

  function armMission(mission) {
    state.mission = mission;
    state.plane = createPlane();
    state.score = 0;
    state.ringsPassed = 0;
    state.nextRing = 0;
    state.over = false;
    state.overReason = '';
    state.message = '';
    state.ringFlash = 0;
    state.popup = '';
    if (mission === MISSION_RING_RUN) {
      state.rings = valley.ringsFor(RING.runCount, 420, RING.spacing);
    } else if (mission === MISSION_TIMED) {
      state.rings = valley.ringsFor(RING.courseCount, 420, RING.spacing);
    } else {
      state.rings = [];
    }
  }

  function reset(mission) {
    armMission(mission === undefined ? MISSION_RING_RUN : mission);
  }

  function finish(reason) {
    state.over = true;
    state.overReason = reason;
    state.overScore = state.score;
    if (state.score > state.best) state.best = state.score;
  }

  /** How far, in metres, the next gate is ahead of the plane. */
  function distanceToNext() {
    if (state.mission === MISSION_LANDING) return RUNWAY.startZ - state.plane.z;
    if (state.nextRing >= state.rings.length) return 0;
    return state.rings[state.nextRing].z - state.plane.z;
  }

  function step(dt, stick, attract) {
    const plane = state.plane;
    if (state.over) return EVENT_NONE;
    let events = EVENT_NONE;

    stepPlane(plane, stick, valley.groundHeight, dt);

    if (state.ringFlash > 0) state.ringFlash -= dt;
    if (state.popupTime > 0) state.popupTime -= dt;
    if (state.messageTime > 0) state.messageTime -= dt;

    // Rings: crossing a gate's plane inside its circle counts, with a centre bonus.
    // A gate flown past is a missed gate: skip it so the next one takes over.
    let ring = state.rings[state.nextRing];
    if (ring && plane.z > ring.z + 5) {
      state.nextRing += 1;
      state.popup = 'RING MISSED';
      state.popupTime = 1.4;
      ring = state.rings[state.nextRing];
    }
    if (ring && plane.z >= ring.z && plane.z - ring.z < plane.speed * dt + 2) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const off = Math.sqrt(dx * dx + dy * dy);
      if (off <= RING.radius) {
        ring.passed = true;
        state.nextRing += 1;
        state.ringsPassed += 1;
        const centre = Math.max(0, 1 - off / RING.radius);
        const gained = RING.points + Math.round(RING.centreBonus * centre);
        state.score += gained;
        state.ringFlash = 0.5;
        state.popup = centre > 0.8 ? `RING ${state.ringsPassed} — DEAD CENTRE +${gained}` : `RING ${state.ringsPassed} +${gained}`;
        state.popupTime = 1.6;
        events |= EVENT_RING;
        if (state.mission === MISSION_RING_RUN && state.nextRing >= state.rings.length) {
          state.score += Math.round(plane.fuel) * 2;
          finish('COURSE COMPLETE');
        }
      } else if (state.mission === MISSION_TIMED) {
        // A missed gate on the clock costs the ring and the seconds it would have bought.
        state.popup = `RING MISSED`;
        state.popupTime = 1.4;
      }
    }

    // The Timed Course clock runs out on its own.
    if (state.mission === MISSION_TIMED) {
      if (state.nextRing >= state.rings.length) {
        state.score += Math.round(courseTimeLeft(plane.time, state.ringsPassed)) * 10;
        finish('COURSE COMPLETE');
      } else if (courseTimeLeft(plane.time, state.ringsPassed) <= 0) {
        finish('OUT OF TIME');
        events |= EVENT_TIMEOUT;
      }
    }

    // The grass strip: touching down low over the strip is a landing attempt. The check
    // only fires once the plane is over the strip itself — a low approach short of the
    // threshold is still flying, not a landing.
    if (state.mission === MISSION_LANDING && !plane.crashed) {
      const ground = valley.groundHeight(plane.z);
      if (plane.z >= RUNWAY.startZ && plane.y <= ground + 3.5) {
        if (judgeTouchdown(plane)) {
          state.score += RUNWAY.landingPoints + Math.round(plane.fuel) * 2;
          finish('LANDED — WELCOME TO COPPERWING FIELD');
          events |= EVENT_LANDED;
        } else {
          events |= EVENT_CRASHED;
        }
      }
    }

    if (plane.crashed) {
      finish(plane.fuel <= 0 ? 'OUT OF FUEL — SHE CAME DOWN IN THE FIELDS' : 'CRASHED');
      events |= EVENT_CRASHED;
    }
    if (!state.over && plane.fuel <= 0 && plane.y <= valley.groundHeight(plane.z) + 30) {
      state.message = 'FUEL EMPTY — GLIDING';
      state.messageTime = 1;
    }
    if (plane.fuel <= 0 && !plane.crashed) events |= EVENT_OUT_OF_FUEL;
    if (!attract && !state.over && plane.z > 5600) finish('COURSE COMPLETE');
    return events;
  }

  armMission(MISSION_RING_RUN);
  return {
    state,
    reset,
    armMission,
    step,
    distanceToNext,
    /** Seconds left on the clock, or null when the mission has no clock. */
    timeLeft() {
      if (state.mission !== MISSION_TIMED) return null;
      return courseTimeLeft(state.plane.time, state.ringsPassed);
    },
    /** The next gate to fly through, or null on the landing mission. */
    nextRing() {
      return state.rings[state.nextRing] ?? null;
    },
    groundAt(z) {
      return valley.groundHeight(z);
    },
  };
}
