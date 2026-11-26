// The renderer: a chase view over the valley, painted on one Canvas 2D surface. The
// camera rides behind the plane and the world is projected band by band, far to near —
// sky, ridges, ground patchwork, valley walls, runway, rings, trees — then the plane
// itself, then the lit instruments and the HUD. Every pixel comes from the world state
// and the seed; nothing here reads the clock or a random roll.

import {
  BAND_LENGTH,
  CAMERA_BEHIND,
  COURSE,
  DRAW_DISTANCE,
  FIELD,
  FOCAL,
  FONT,
  FONT_MONO,
  PALETTE,
  RING,
  RUNWAY,
} from './config.js';
import { MISSION_LANDING, MISSION_NAMES, MISSION_BLURBS, MISSION_TIMED } from './missions.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const FIELD_COLOURS = [PALETTE.fieldA, PALETTE.fieldB, PALETTE.fieldC, PALETTE.fieldD];
const WALL_X = 140;

/** Clouds drift with the distance flown, so the same flight always shows the same sky. */
const CLOUDS = (() => {
  const random = createRandom(20261126);
  const clouds = [];
  for (let index = 0; index < 16; index += 1) {
    clouds.push({
      baseX: random() * 1500,
      y: 36 + random() * 190,
      scale: 0.7 + random() * 1.1,
      drift: 0.12 + random() * 0.25,
    });
  }
  return clouds;
})();

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  /** Project a world point to the screen, or null when it is behind the camera. */
  function project(cam, x, y, z) {
    const dz = z - cam.z;
    if (dz < 4) return null;
    const s = FOCAL / dz;
    return { x: FIELD.width / 2 + (x - cam.x) * s, y: FIELD.horizonY - (y - cam.y) * s, s };
  }

  function drawSky(plane) {
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.horizonY + 60);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.horizonY + 60);

    // The sun, low over the valley to the right.
    const glow = ctx.createRadialGradient(1060, 118, 8, 1060, 118, 130);
    glow.addColorStop(0, PALETTE.sunCore);
    glow.addColorStop(0.35, PALETTE.sun);
    glow.addColorStop(1, 'rgba(255, 243, 196, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(920, 0, 280, 260);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(1060, 118, 30, 0, Math.PI * 2);
    ctx.fill();

    // Clouds, placed by distance flown so the sky never repeats a frame by accident.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    for (const cloud of CLOUDS) {
      const x = (((cloud.baseX - plane.z * cloud.drift) % 1500) + 1500) % 1500 - 110;
      const y = cloud.y;
      const s = cloud.scale;
      ctx.beginPath();
      ctx.ellipse(x, y, 52 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 34 * s, y + 5 * s, 36 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 36 * s, y + 6 * s, 30 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A distant ridge in screen space, its silhouette sliding with the distance flown. */
  function drawRidge(plane, parallax, baseY, amplitude, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    ctx.lineTo(0, baseY);
    const offset = plane.z * parallax;
    for (let x = 0; x <= FIELD.width; x += 32) {
      const y =
        baseY -
        (Math.sin((x + offset) * 0.004) * 0.5 + 0.5) * amplitude -
        (Math.sin((x + offset) * 0.011 + 2) * 0.5 + 0.5) * amplitude * 0.45;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround(state, cam) {
    const valley = state.valley;
    const zStart = Math.max(cam.z + 20, Math.floor((cam.z + 20) / BAND_LENGTH) * BAND_LENGTH);
    const zEnd = cam.z + DRAW_DISTANCE;
    // Far bands first so near bands paint over them.
    for (let z = zEnd - BAND_LENGTH; z >= zStart; z -= BAND_LENGTH) {
      const z0 = z;
      const z1 = z + BAND_LENGTH;
      const g0 = valley.groundHeight(z0);
      const g1 = valley.groundHeight(z1);
      const a = project(cam, -WALL_X, g0, z0);
      const b = project(cam, WALL_X, g0, z0);
      const c = project(cam, WALL_X, g1, z1);
      const d = project(cam, -WALL_X, g1, z1);
      if (!a || !b || !c || !d) continue;
      const isRiver = valley.riverZ >= z0 && valley.riverZ < z1;
      ctx.fillStyle = isRiver ? PALETTE.river : FIELD_COLOURS[valley.fieldKindAt(z0)];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // A hairline along each band's far edge reads as a field boundary up close.
      ctx.strokeStyle = 'rgba(20, 30, 16, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
  }

  /** One valley wall: the band between the ground's edge and the wall's top, far to near. */
  function drawWall(state, cam, side) {
    const valley = state.valley;
    const x = side * WALL_X;
    const colour = side < 0 ? PALETTE.hillLeft : PALETTE.hillRight;
    const zStart = Math.max(cam.z + 20, Math.floor((cam.z + 20) / BAND_LENGTH) * BAND_LENGTH);
    const zEnd = cam.z + DRAW_DISTANCE;
    const top = [];
    const bottom = [];
    for (let z = zStart; z <= zEnd; z += BAND_LENGTH) {
      const g = valley.groundHeight(z);
      const w = valley.wallHeightAt(z, side);
      const tp = project(cam, x, g + w, z);
      const bp = project(cam, x, g, z);
      if (!tp || !bp) continue;
      top.push(tp);
      bottom.push(bp);
    }
    if (top.length < 2) return;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let index = 1; index < top.length; index += 1) ctx.lineTo(top[index].x, top[index].y);
    for (let index = bottom.length - 1; index >= 0; index -= 1) ctx.lineTo(bottom[index].x, bottom[index].y);
    ctx.closePath();
    ctx.fill();
    // A treeline along the wall's top edge.
    ctx.strokeStyle = 'rgba(20, 40, 20, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let index = 1; index < top.length; index += 1) ctx.lineTo(top[index].x, top[index].y);
    ctx.stroke();
  }

  function drawRunway(state, cam) {
    const valley = state.valley;
    const z0 = RUNWAY.startZ;
    const z1 = RUNWAY.startZ + RUNWAY.length;
    if (z1 < cam.z + 20 || z0 > cam.z + DRAW_DISTANCE) return;
    const half = RUNWAY.width / 2;
    const h = valley.runwayHeight;
    const seg = 25;
    for (let z = Math.max(z0, cam.z + 20); z < z1; z += seg) {
      const za = z;
      const zb = Math.min(z + seg, z1);
      const a = project(cam, -half, h, za);
      const b = project(cam, half, h, za);
      const c = project(cam, half, h, zb);
      const d = project(cam, -half, h, zb);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = PALETTE.runway;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // Centreline dashes, one per segment.
      if (Math.floor(z / seg) % 2 === 0) {
        const e = project(cam, -0.6, h + 0.05, za + 4);
        const f = project(cam, 0.6, h + 0.05, za + 4);
        const g = project(cam, 0.6, h + 0.05, zb - 4);
        const hh = project(cam, -0.6, h + 0.05, zb - 4);
        if (e && f && g && hh) {
          ctx.fillStyle = PALETTE.runwayLine;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(f.x, f.y);
          ctx.lineTo(g.x, g.y);
          ctx.lineTo(hh.x, hh.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Threshold bars at the strip's start.
    const t0 = project(cam, -half, h + 0.05, z0 + 2);
    const t1 = project(cam, half, h + 0.05, z0 + 2);
    const t2 = project(cam, half, h + 0.05, z0 + 12);
    const t3 = project(cam, -half, h + 0.05, z0 + 12);
    if (t0 && t1 && t2 && t3) {
      ctx.fillStyle = PALETTE.runwayLine;
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.closePath();
      ctx.fill();
    }
    // Windsock beside the threshold, pointing down the strip.
    const base = project(cam, half + 6, h, z0 + 40);
    const top = project(cam, half + 6, h + 7, z0 + 40);
    const tip = project(cam, half + 6, h + 6.2, z0 + 52);
    if (base && top && tip) {
      ctx.strokeStyle = '#e8e4d8';
      ctx.lineWidth = Math.max(1.5, top.s * 0.12);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = '#ff7a2e';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(top.x + (tip.x - top.x) * 0.4, top.y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTrees(state, cam) {
    const valley = state.valley;
    for (let index = state.valley.trees.length - 1; index >= 0; index -= 1) {
      const tree = state.valley.trees[index];
      if (tree.z < cam.z + 20 || tree.z > cam.z + DRAW_DISTANCE) continue;
      const ground = valley.groundHeight(tree.z);
      const base = project(cam, tree.x, ground, tree.z);
      if (!base) continue;
      if (base.x < -80 || base.x > FIELD.width + 80) continue;
      const height = tree.size * base.s * 1.9;
      const width = tree.size * base.s * 0.9;
      ctx.fillStyle = PALETTE.trunk;
      ctx.fillRect(base.x - width * 0.06, base.y - height * 0.25, width * 0.12, height * 0.25);
      ctx.fillStyle = tree.shade < 0.5 ? PALETTE.treeDark : PALETTE.treeLight;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - height);
      ctx.lineTo(base.x - width, base.y - height * 0.25);
      ctx.lineTo(base.x + width, base.y - height * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - height * 1.25);
      ctx.lineTo(base.x - width * 0.7, base.y - height * 0.6);
      ctx.lineTo(base.x + width * 0.7, base.y - height * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRings(state, cam, screen) {
    const plane = state.plane;
    for (let index = 0; index < state.rings.length; index += 1) {
      const ring = state.rings[index];
      if (ring.passed) continue;
      if (ring.z < cam.z + 6 || ring.z > cam.z + DRAW_DISTANCE) continue;
      const centre = project(cam, ring.x, ring.y, ring.z);
      if (!centre) continue;
      const radius = RING.radius * centre.s;
      if (radius < 2) continue;
      const isNext = index === state.nextRing;
      const colour = isNext ? PALETTE.ringNext : 'rgba(255, 176, 46, 0.55)';
      // Glow, then the ring itself, then a bright inner edge.
      ctx.strokeStyle = colour;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = Math.max(4, radius * 0.3);
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2.5, radius * 0.13);
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = Math.max(1, radius * 0.04);
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      // The label and the guide line only while actually flying: on the title and
      // end screens they would collide with the overlay text.
      if (isNext && screen === SCREEN_PLAY) {
        const dist = Math.max(0, Math.round(ring.z - plane.z));
        const size = clamp(radius * 0.34, 12, 22);
        ctx.fillStyle = PALETTE.white;
        ctx.font = `700 ${size}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${index + 1} · ${dist} m`, centre.x, centre.y + radius + size + 6);
        // A dashed guide from the nose to the next gate.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(FIELD.width / 2, 520);
        ctx.lineTo(centre.x, centre.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawPlaneShadow(state, cam) {
    const plane = state.plane;
    const ground = state.valley.groundHeight(plane.z + 6);
    const spot = project(cam, plane.x, ground + 0.4, plane.z + 6);
    if (!spot) return;
    const heightAbove = Math.max(1, plane.y - ground);
    ctx.fillStyle = `rgba(20, 30, 20, ${clamp(0.34 - heightAbove * 0.004, 0.05, 0.34)})`;
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y, 2.6 * spot.s, 0.55 * spot.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** The copper bush plane, seen from behind and above, banked with the turn. */
  function drawPlane(state) {
    const plane = state.plane;
    const px = FIELD.width / 2 + (plane.x - plane.x * 0.6) * 10;
    const py = 548 - plane.pitch * 42;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(plane.bank);
    // Prop disc at the nose, spinning with the flight's own clock.
    const propAngle = plane.time * 18;
    ctx.fillStyle = PALETTE.propDisc;
    ctx.beginPath();
    ctx.ellipse(0, -96, 56, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 244, 248, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(propAngle) * 52, -96 - Math.sin(propAngle) * 13);
    ctx.lineTo(Math.cos(propAngle) * 52, -96 + Math.sin(propAngle) * 13);
    ctx.moveTo(-Math.cos(propAngle + 1.5708) * 52, -96 - Math.sin(propAngle + 1.5708) * 13);
    ctx.lineTo(Math.cos(propAngle + 1.5708) * 52, -96 + Math.sin(propAngle + 1.5708) * 13);
    ctx.stroke();
    // Main wing, copper with cream tips.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-152, -34);
    ctx.lineTo(152, -34);
    ctx.lineTo(138, -8);
    ctx.lineTo(-138, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath();
    ctx.moveTo(-152, -34);
    ctx.lineTo(-128, -34);
    ctx.lineTo(-122, -8);
    ctx.lineTo(-138, -8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(152, -34);
    ctx.lineTo(128, -34);
    ctx.lineTo(122, -8);
    ctx.lineTo(138, -8);
    ctx.closePath();
    ctx.fill();
    // Fuselage: wide at the tail (near), tapering to the nose (far).
    const body = ctx.createLinearGradient(-24, 0, 24, 0);
    body.addColorStop(0, PALETTE.planeBodyDark);
    body.addColorStop(0.5, PALETTE.planeBody);
    body.addColorStop(1, PALETTE.planeBodyDark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-30, 52);
    ctx.quadraticCurveTo(-34, -20, -16, -92);
    ctx.quadraticCurveTo(0, -102, 16, -92);
    ctx.quadraticCurveTo(34, -20, 30, 52);
    ctx.quadraticCurveTo(0, 64, -30, 52);
    ctx.closePath();
    ctx.fill();
    // Cream cheatline down the fuselage.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.fillRect(-4, -88, 8, 132);
    // Tail fin.
    ctx.fillStyle = PALETTE.planeBodyDark;
    ctx.beginPath();
    ctx.moveTo(-14, 44);
    ctx.lineTo(0, -6);
    ctx.lineTo(14, 44);
    ctx.closePath();
    ctx.fill();
    // Tailplane.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-66, 44);
    ctx.lineTo(66, 44);
    ctx.lineTo(56, 58);
    ctx.lineTo(-56, 58);
    ctx.closePath();
    ctx.fill();
    // Spinner at the nose.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath();
    ctx.ellipse(0, -94, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Registration on the tail.
    ctx.fillStyle = '#fff8e8';
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('PK-CWR', 0, 40);
    // Nav lights: red port, green starboard, white tail.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-150, -21, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34d17b';
    ctx.beginPath();
    ctx.arc(150, -21, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 60, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function dial(cx, cy, radius, label, valueText) {
    ctx.fillStyle = PALETTE.dialFace;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy - radius - 6);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT_MONO}`;
    ctx.fillText(valueText, cx, cy + radius + 16);
  }

  function needle(cx, cy, radius, angle, colour) {
    ctx.strokeStyle = colour ?? PALETTE.dialNeedle;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(angle) * (radius - 6), cy - Math.cos(angle) * (radius - 6));
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function ticks(cx, cy, radius, count, startAngle, endAngle) {
    ctx.strokeStyle = PALETTE.dialTick;
    ctx.lineWidth = 1.5;
    for (let index = 0; index <= count; index += 1) {
      const angle = startAngle + ((endAngle - startAngle) * index) / count;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(angle) * (radius - 7), cy - Math.cos(angle) * (radius - 7));
      ctx.lineTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius);
      ctx.stroke();
    }
  }

  /** The lit instrument panel along the bottom of the screen. */
  function drawPanel(state) {
    const plane = state.plane;
    const ground = state.valley.groundHeight(plane.z);
    const altFt = Math.max(0, Math.round((plane.y - ground) * 10));
    const speedKt = Math.round(plane.speed * 1.6);
    const heading = Math.round(plane.heading) % 360;
    const py = 706;

    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 678, FIELD.width, 122);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, 678, FIELD.width, 2);

    // Artificial horizon: sky and ground split by the bank, sliding with the pitch.
    const hx = 150;
    const hr = 42;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, py + 34, hr, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(hx, py + 34);
    ctx.rotate(-plane.bank);
    ctx.translate(0, clamp(plane.pitch * 60, -30, 30));
    ctx.fillStyle = '#4f9ecf';
    ctx.fillRect(-hr - 2, -hr - 2, hr * 2 + 4, hr + 2);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-hr - 2, 0, hr * 2 + 4, hr + 2);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(-hr - 2, -1.5, hr * 2 + 4, 3);
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, py + 34, hr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.amber;
    ctx.beginPath();
    ctx.moveTo(hx - 18, py + 34);
    ctx.lineTo(hx + 18, py + 34);
    ctx.lineTo(hx, py + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, py - 12);

    // Altimeter dial.
    const ax = 300;
    dial(ax, py + 34, 40, 'ALTITUDE · FT', String(altFt));
    ticks(ax, py + 34, 40, 8, -2.2, 2.2);
    needle(ax, py + 34, 40, clamp((altFt % 1000) / 1000, 0, 1) * 4.4 - 2.2);

    // Airspeed dial.
    const sx = 430;
    dial(sx, py + 34, 40, 'AIRSPEED · KT', String(speedKt));
    ticks(sx, py + 34, 40, 8, -2.2, 2.2);
    const speedAngle = clamp(speedKt / 130, 0, 1) * 4.4 - 2.2;
    needle(sx, py + 34, 40, speedAngle, plane.speed < 24 ? PALETTE.red : PALETTE.dialNeedle);

    // Compass tape: the heading strip, current heading centred.
    const tx = 640;
    const tw = 260;
    ctx.fillStyle = PALETTE.dialFace;
    ctx.fillRect(tx - tw / 2, py - 6, tw, 52);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - tw / 2, py - 6, tw, 52);
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx - tw / 2, py - 6, tw, 52);
    ctx.clip();
    for (let offset = -80; offset <= 80; offset += 10) {
      const hdg = (heading + offset + 360) % 360;
      const x = tx + offset * 1.45;
      const major = hdg % 30 === 0;
      ctx.strokeStyle = major ? PALETTE.text : PALETTE.muted;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, py + 8);
      ctx.lineTo(x, py + (major ? 22 : 16));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 11px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(hdg).padStart(3, '0'), x, py + 38);
      }
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.amber;
    ctx.beginPath();
    ctx.moveTo(tx - 7, py - 6);
    ctx.lineTo(tx + 7, py - 6);
    ctx.lineTo(tx, py + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HEADING', tx, py - 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT_MONO}`;
    ctx.fillText(`${String(heading).padStart(3, '0')}°`, tx, py + 62);

    // Fuel gauge.
    const fx = 830;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('FUEL', fx, py - 12);
    ctx.fillStyle = PALETTE.dialFace;
    ctx.fillRect(fx - 14, py - 6, 28, 84);
    const fuelH = clamp(plane.fuel / 100, 0, 1) * 80;
    ctx.fillStyle = plane.fuel < 20 ? PALETTE.red : plane.fuel < 40 ? PALETTE.amber : PALETTE.green;
    ctx.fillRect(fx - 12, py + 76 - fuelH, 24, fuelH);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(fx - 14, py - 6, 28, 84);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT_MONO}`;
    ctx.fillText(`${Math.round(plane.fuel)}%`, fx, py + 90);

    // Throttle lever.
    const lx = 920;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('THROTTLE', lx, py - 12);
    ctx.fillStyle = PALETTE.dialFace;
    ctx.fillRect(lx - 14, py - 6, 28, 84);
    const thrH = plane.throttle * 80;
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(lx - 12, py + 76 - thrH, 24, thrH);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(lx - 14, py - 6, 28, 84);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT_MONO}`;
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, lx, py + 90);

    // Vertical speed.
    const vx = 1030;
    dial(vx, py + 34, 40, 'VERT SPEED', plane.verticalSpeed >= 0 ? `+${plane.verticalSpeed.toFixed(0)}` : plane.verticalSpeed.toFixed(0));
    ticks(vx, py + 34, 40, 6, -2.2, 2.2);
    needle(vx, py + 34, 40, clamp(plane.verticalSpeed / 16, -1, 1) * 2.2);
  }

  /** The top bar: mission, objective, score and clock, always lit. */
  function drawHud(state, screen) {
    const plane = state.plane;
    const ground = state.valley.groundHeight(plane.z);
    const altFt = Math.max(0, Math.round((plane.y - ground) * 10));
    const speedKt = Math.round(plane.speed * 1.6);
    const heading = Math.round(plane.heading) % 360;
    ctx.fillStyle = 'rgba(12, 18, 28, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, 56);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText('COPPERWING RIDGE', 18, 26);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(MISSION_NAMES[state.mission], 18, 45);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    const nextRing = state.rings[state.nextRing];
    const objective =
      state.mission === MISSION_LANDING
        ? `LAND ON THE GRASS STRIP · ${Math.max(0, Math.round(RUNWAY.startZ - plane.z))} m AHEAD`
        : nextRing
          ? `RING ${Math.min(state.nextRing + 1, state.rings.length)} OF ${state.rings.length} · ${Math.max(0, Math.round(nextRing.z - plane.z))} m AHEAD`
          : `ALL RINGS FLOWN · ${state.ringsPassed} OF ${state.rings.length}`;
    ctx.fillText(objective, FIELD.width / 2, 24);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    const sub =
      state.mission === MISSION_LANDING
        ? `SLOW · LEVEL · GENTLE — UNDER ${Math.round(RUNWAY.maxSpeed * 1.6)} KT, SINK UNDER 6`
        : state.mission === MISSION_TIMED
          ? 'EVERY RING BUYS 9 SECONDS'
          : 'SMOOTH TURNS KEEP YOUR SPEED';
    ctx.fillText(sub, FIELD.width / 2, 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 20px ${FONT_MONO}`;
    ctx.fillText(`ALT ${altFt} FT   SPD ${speedKt} KT   HDG ${String(heading).padStart(3, '0')}°`, FIELD.width - 18, 26);
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 14px ${FONT_MONO}`;
    const timeLeft =
      state.mission === MISSION_TIMED
        ? Math.max(0, Math.ceil(COURSE.startTime + state.ringsPassed * COURSE.ringBonus - plane.time))
        : null;
    ctx.fillText(
      timeLeft === null ? `SCORE ${state.score}` : `SCORE ${state.score}   TIME ${timeLeft}s`,
      FIELD.width - 18,
      46,
    );
    // Warnings that read at a glance. A low approach on final is a landing, not a
    // reason to shout: the ground warning stays quiet while lined up on the strip.
    // All three warnings only fire while actually flying, never over a menu screen.
    const onFinal =
      state.mission === MISSION_LANDING && plane.z > RUNWAY.startZ - 600 && Math.abs(plane.x) < 15;
    const low = plane.y - ground < 12 && plane.verticalSpeed < 0 && !state.over && !onFinal && screen === SCREEN_PLAY;
    const stalled = plane.speed < 24 && !state.over && screen === SCREEN_PLAY;
    if (low || stalled) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.red;
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText(stalled ? 'STALL — NOSE DOWN, THROTTLE UP' : 'PULL UP', FIELD.width / 2, 120);
    }
    if (plane.fuel < 20 && !state.over && screen === SCREEN_PLAY) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.amber;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText('LOW FUEL', FIELD.width / 2, 152);
    }
    // Ring popup, centre screen, fading with its own timer.
    if (state.popupTime > 0 && screen === SCREEN_PLAY) {
      ctx.globalAlpha = clamp(state.popupTime, 0, 1);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.green;
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText(state.popup, FIELD.width / 2, 210);
      ctx.globalAlpha = 1;
    }
    // A green flash across the frame when a ring is flown through.
    if (state.ringFlash > 0) {
      ctx.fillStyle = `rgba(87, 217, 119, ${state.ringFlash * 0.25})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(10, 16, 26, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.white;
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText('COPPERWING RIDGE', FIELD.width / 2, 150);
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('A BUSH-PLANE FLIGHT GAME · ONE VALLEY, THREE SORTIES', FIELD.width / 2, 188);
    const cardW = 330;
    const cardH = 150;
    const gap = 28;
    const startX = FIELD.width / 2 - (cardW * 3 + gap * 2) / 2;
    for (let index = 0; index < 3; index += 1) {
      const x = startX + index * (cardW + gap);
      const y = 250;
      ctx.fillStyle = state.mission === index ? 'rgba(255, 176, 46, 0.92)' : 'rgba(16, 22, 34, 0.88)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = state.mission === index ? PALETTE.white : PALETTE.panelEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cardW, cardH);
      const dark = state.mission === index;
      ctx.fillStyle = dark ? '#1c212b' : PALETTE.amber;
      ctx.font = `800 18px ${FONT}`;
      ctx.fillText(`[${index + 1}]  ${MISSION_NAMES[index]}`, x + cardW / 2, y + 34);
      ctx.fillStyle = dark ? '#1c212b' : PALETTE.text;
      ctx.font = `400 15px ${FONT}`;
      const words = MISSION_BLURBS[index].split(' ');
      let line = '';
      let lineY = y + 64;
      for (const word of words) {
        if ((line + word).length > 34) {
          ctx.fillText(line.trim(), x + cardW / 2, lineY);
          line = '';
          lineY += 20;
        }
        line += `${word} `;
      }
      ctx.fillText(line.trim(), x + cardW / 2, lineY);
    }
    ctx.fillStyle = PALETTE.white;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY  ·  1 / 2 / 3 PICKS A SORTIE', FIELD.width / 2, 470);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText('↑ ↓ pitch  ·  ← → bank  ·  SHIFT / CTRL throttle  ·  mouse steers too  ·  P pauses', FIELD.width / 2, 506);
    ctx.fillText('Fuel burns with the throttle. A hard bank bleeds speed. A slow wing stalls.', FIELD.width / 2, 532);
    if (best > 0) {
      ctx.fillStyle = PALETTE.amber;
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(`BEST SCORE ${best}`, FIELD.width / 2, 580);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 16, 26, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.white;
    ctx.font = `800 48px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 360);
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText('Press P or Space to keep flying', FIELD.width / 2, 402);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(10, 16, 26, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    const crashed = state.overReason.includes('CRASH') || state.overReason.includes('FUEL');
    ctx.fillStyle = crashed ? PALETTE.red : PALETTE.green;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(state.overReason, FIELD.width / 2, 300);
    ctx.fillStyle = PALETTE.white;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`SCORE ${state.overScore}`, FIELD.width / 2, 356);
    ctx.font = `400 20px ${FONT}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const detail =
      state.mission === MISSION_LANDING
        ? `Touchdown at ${Math.round(state.plane.speed * 1.6)} KT  ·  Fuel left ${Math.round(state.plane.fuel)}%  ·  Best ${Math.max(best, state.overScore)}`
        : `Rings flown ${state.ringsPassed} of ${state.rings.length}  ·  Fuel left ${Math.round(state.plane.fuel)}%  ·  Best ${Math.max(best, state.overScore)}`;
    ctx.fillText(detail, FIELD.width / 2, 396);
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY AGAIN  ·  1 / 2 / 3 PICKS A SORTIE', FIELD.width / 2, 452);
  }

  function draw(state, screen, best) {
    const plane = state.plane;
    const cam = { x: plane.x * 0.6, y: plane.y + 5.5, z: plane.z - CAMERA_BEHIND };
    drawSky(plane);
    drawRidge(plane, 0.03, FIELD.horizonY - 6, 46, PALETTE.mountainFar);
    drawRidge(plane, 0.07, FIELD.horizonY + 4, 30, PALETTE.mountainNear);
    drawGround(state, cam);
    drawWall(state, cam, -1);
    drawWall(state, cam, 1);
    drawRunway(state, cam);
    drawTrees(state, cam);
    drawRings(state, cam, screen);
    drawPlaneShadow(state, cam);
    drawPlane(state);
    drawPanel(state);
    drawHud(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  return { draw };
}
