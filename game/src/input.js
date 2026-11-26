// Keyboard and pointer input. Held keys give a stick deflection; one-shot presses (start,
// restart, pause, mission pick) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. The mouse steers too:
// moving the pointer off-centre banks and pitches toward it, and a click confirms.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MISSION_1 = 4;
export const ACTION_MISSION_2 = 8;
export const ACTION_MISSION_3 = 16;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const ROLL_LEFT = new Set(['ArrowLeft', 'KeyA']);
const ROLL_RIGHT = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  // Pointer position in fractions of the canvas, 0.5 is centre; null until moved.
  let pointer = null;
  let pointerActive = false;

  window.addEventListener('keydown', (event) => {
    if (PITCH_UP.has(event.code)) held.add('up');
    else if (PITCH_DOWN.has(event.code)) held.add('down');
    else if (ROLL_LEFT.has(event.code)) held.add('left');
    else if (ROLL_RIGHT.has(event.code)) held.add('right');
    else if (THROTTLE_UP.has(event.code)) held.add('thrUp');
    else if (THROTTLE_DOWN.has(event.code)) held.add('thrDown');
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_MISSION_1;
    } else if (event.code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_MISSION_2;
    } else if (event.code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_MISSION_3;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (PITCH_UP.has(event.code)) held.delete('up');
    else if (PITCH_DOWN.has(event.code)) held.delete('down');
    else if (ROLL_LEFT.has(event.code)) held.delete('left');
    else if (ROLL_RIGHT.has(event.code)) held.delete('right');
    else if (THROTTLE_UP.has(event.code)) held.delete('thrUp');
    else if (THROTTLE_DOWN.has(event.code)) held.delete('thrDown');
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    pointerActive = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    pointerActive = true;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    pointerActive = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerleave', () => {
    pointerActive = false;
  });

  /** Clamp a value into [-1, 1]. */
  function clampUnit(value) {
    return value < -1 ? -1 : value > 1 ? 1 : value;
  }

  return {
    /**
     * The stick this frame: pitch -1 (nose down) to 1 (nose up), roll -1 (left) to 1
     * (right), throttle -1 (lever back) to 1 (lever forward). Keys win over the mouse;
     * the mouse only steers while no pitch or roll key is held.
     */
    stick() {
      const pitchKey = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
      const rollKey = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const throttleKey = (held.has('thrUp') ? 1 : 0) - (held.has('thrDown') ? 1 : 0);
      let pitch = pitchKey;
      let roll = rollKey;
      if (pointerActive && pointer !== null) {
        if (pitchKey === 0) pitch = clampUnit((0.5 - pointer.y) * 2.4);
        if (rollKey === 0) roll = clampUnit((pointer.x - 0.5) * 2.4);
      }
      return { pitch, roll, throttle: throttleKey };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
