// The flight model: one plane, one fixed step. Throttle sets thrust, the stick sets pitch
// and roll, and the air answers back — a hard bank scrubs speed, a slow wing stalls and
// drops, fuel burns faster the harder you push. Nothing here reads the clock or an
// unseeded roll; the same inputs on the same step always give the same plane.

import { COURSE, FUEL, PLANE, RUNWAY } from './config.js';

/**
 * A fresh plane at the start of the valley, on the climb-out from the strip's far end,
 * throttle already set for cruise so the first seconds are flying, not fumbling.
 */
export function createPlane() {
  return {
    x: 0,
    y: 34,
    z: 0,
    heading: 90,
    speed: 46,
    throttle: 0.62,
    pitch: 0,
    bank: 0,
    verticalSpeed: 0,
    fuel: FUEL.start,
    damage: 0,
    crashed: false,
    landed: false,
    time: 0,
  };
}

/** Clamp a value into [min, max]. */
function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/**
 * Advance the plane one fixed step. `stick` is { pitch: -1..1, roll: -1..1, throttle: -1..1 }
 * from the keys or the mouse; `groundAt` gives the valley floor at a distance z.
 * Returns nothing; the caller reads plane.crashed / plane.landed afterwards.
 */
export function stepPlane(plane, stick, groundAt, dt) {
  if (plane.crashed || plane.landed) return;
  plane.time += dt;

  // Throttle lever: held keys move it, and it stays where you leave it.
  plane.throttle = clamp(plane.throttle + stick.throttle * PLANE.throttleRate * dt, 0, 1);

  // The stick: pitch for climb and descent, roll for a banked turn.
  const targetPitch = stick.pitch * PLANE.pitchRate;
  const targetBank = stick.roll * PLANE.maxBank;
  plane.pitch += clamp(targetPitch - plane.pitch, -2.2 * dt, 2.2 * dt);
  plane.bank += clamp(targetBank - plane.bank, -2.6 * dt, 2.6 * dt);

  // Turning scrubs speed: a banked turn costs lift, and lift costs speed.
  const bankDrag = Math.abs(plane.bank) / PLANE.maxBank;
  const thrust = plane.throttle * PLANE.maxSpeed;
  const drag = PLANE.drag + bankDrag * PLANE.turnDrag;
  plane.speed += (thrust - plane.speed * (1 + drag * 0.02)) * dt * 0.9;
  plane.speed = clamp(plane.speed, 0, PLANE.maxSpeed * 1.15);

  // Heading follows the bank: a level turn at this bank swings the nose around.
  const turnRate = plane.bank * 0.42 * clamp(plane.speed / 46, 0.2, 1.4);
  plane.heading = (plane.heading + turnRate * 57.2958 * dt + 360) % 360;

  // Lift: pitch times speed, minus the sink of a wing that has stopped flying.
  const stalled = plane.speed < PLANE.stallSpeed;
  const lift = stalled
    ? -PLANE.stallSink
    : plane.pitch * PLANE.climbPower * clamp(plane.speed / 46, 0.35, 1.3);
  const sink = stalled ? 0 : (1 - plane.throttle) * 2.2;
  plane.verticalSpeed = lift - sink;
  plane.y += plane.verticalSpeed * dt;

  // The nose goes where the bank points it: forward motion is mostly along z (east at
  // heading 090), drifted sideways as the heading swings.
  const forward = plane.speed * dt;
  const headingRad = (plane.heading * Math.PI) / 180;
  plane.z += forward * Math.sin(headingRad);
  plane.x += forward * -Math.cos(headingRad);
  plane.x = clamp(plane.x, -60, 60);

  // Fuel burns with the throttle; an empty tank leaves you gliding.
  plane.fuel -= (FUEL.idleBurn + plane.throttle * FUEL.throttleBurn) * dt;
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.throttle = 0;
  }

  // The ceiling is thin air: above it the engine gasps and the climb stops.
  if (plane.y > 120) {
    plane.y = 120;
    plane.verticalSpeed = Math.min(plane.verticalSpeed, 0);
  }

  // The ground is the ground: touch it outside a gentle runway touchdown and you crash.
  const ground = groundAt(plane.z);
  if (plane.y <= ground + 1.1) {
    plane.y = ground + 1.1;
    plane.crashed = true;
  }
}

/**
 * Judge a touchdown on the grass strip: slow, gentle and on the strip is a landing;
 * anything else is a crash. Called only while the plane is over the runway.
 */
export function judgeTouchdown(plane) {
  const onStrip = plane.z >= RUNWAY.startZ && plane.z <= RUNWAY.startZ + RUNWAY.length;
  const centred = Math.abs(plane.x) <= RUNWAY.width / 2 + 3;
  const gentle = plane.verticalSpeed > -RUNWAY.maxSink;
  const slow = plane.speed <= RUNWAY.maxSpeed;
  const level = Math.abs(plane.bank) < 0.25;
  if (onStrip && centred && gentle && slow && level) {
    plane.landed = true;
    return true;
  }
  plane.crashed = true;
  return false;
}

/** Seconds left on the Timed Course clock. */
export function courseTimeLeft(elapsed, ringsPassed) {
  return COURSE.startTime + ringsPassed * COURSE.ringBonus - elapsed;
}
