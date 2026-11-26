// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the valley. ?shot=start|play|runway|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CRASHED, EVENT_LANDED, EVENT_RING, MISSION_LANDING, MISSION_RING_RUN, MISSION_TIMED } from './missions.js';
import { ACTION_CONFIRM, ACTION_MISSION_1, ACTION_MISSION_2, ACTION_MISSION_3, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { autopilot, ringTarget, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
// No seed in the URL means the home valley, seed 1: every visit flies the same course,
// and a ?seed=N address always rebuilds that valley exactly.
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let warnedLow = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each ring.
  function announce(message) {
    status.textContent = message;
  }

  function startGame(mission) {
    audio.unlock();
    world.reset(mission);
    accumulator = 0;
    screen = SCREEN_PLAY;
    warnedLow = false;
    announce(`Flying ${world.state.mission === MISSION_LANDING ? 'the landing sortie' : world.state.mission === MISSION_TIMED ? 'the timed course' : 'the ring run'}.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.overScore > best) {
      best = world.state.overScore;
      saveBest(best);
    }
    announce(`${world.state.overReason}. Score ${world.state.overScore}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MISSION_1 && screen !== SCREEN_PLAY) startGame(MISSION_RING_RUN);
    else if (actions & ACTION_MISSION_2 && screen !== SCREEN_PLAY) startGame(MISSION_LANDING);
    else if (actions & ACTION_MISSION_3 && screen !== SCREEN_PLAY) startGame(MISSION_TIMED);
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame(world.state.mission);
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the demo pilot flies the ring run behind the title.
      world.step(STEP, autopilot(world.state, ringTarget(world)), true);
      if (world.state.over) world.reset(MISSION_RING_RUN);
      return;
    }
    const events = world.step(STEP, input.stick(), false);
    const plane = world.state.plane;
    audio.engine(plane.throttle, plane.speed, screen === SCREEN_PLAY && !world.state.over);
    if (events & EVENT_RING) {
      audio.ring();
      announce(`Ring ${world.state.ringsPassed}. Score ${world.state.score}.`);
    } else if (events & EVENT_LANDED) {
      audio.touchdown();
      audio.fanfare();
    } else if (events & EVENT_CRASHED) {
      audio.crash();
    }
    if (!world.state.over && plane.y - world.groundAt(plane.z) < 12 && plane.verticalSpeed < 0 && !warnedLow) {
      audio.warning();
      warnedLow = true;
    }
    if (plane.y - world.groundAt(plane.z) > 20) warnedLow = false;
    if (world.state.over) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the valley fly by unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Copperwing Ridge. Press Space or click to fly. Keys 1, 2 and 3 pick a sortie.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
