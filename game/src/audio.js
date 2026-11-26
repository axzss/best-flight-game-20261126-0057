// All sound is synthesised with WebAudio: an engine hum that follows the throttle, a
// chime for a ring, a thud for a touchdown, a crunch for a crash and a low warning tone
// when the ground gets close. No audio files, nothing to load, nothing to fetch.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let master = null;
  let enabled = false;

  /** Build the audio graph on the first user gesture; browsers block sound before one. */
  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      enabled = true;
      return true;
    } catch {
      return false;
    }
  }

  /** A short tone: frequency, seconds, shape and loudness. */
  function tone(freq, seconds, type, loudness, when) {
    if (!enabled || context === null || master === null) return;
    const start = context.currentTime + (when ?? 0);
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(loudness, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  return {
    /** Call from a user gesture (start, click) so the browser allows sound. */
    unlock() {
      ensure();
    },
    /** The engine hum follows throttle and speed; call every frame while flying. */
    engine(throttle, speed, running) {
      if (!enabled || context === null || engineOsc === null || engineGain === null) return;
      const target = running ? 0.05 + throttle * 0.075 : 0;
      engineOsc.frequency.setTargetAtTime(52 + throttle * 46 + speed * 0.35, context.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
    },
    ring() {
      tone(880, 0.22, 'sine', 0.32);
      tone(1318, 0.3, 'sine', 0.22, 0.07);
    },
    touchdown() {
      tone(180, 0.25, 'triangle', 0.4);
      tone(90, 0.4, 'sine', 0.35, 0.02);
    },
    crash() {
      tone(70, 0.7, 'sawtooth', 0.4);
      tone(48, 0.9, 'square', 0.25, 0.08);
    },
    warning() {
      tone(620, 0.12, 'square', 0.12);
    },
    click() {
      tone(1200, 0.05, 'sine', 0.15);
    },
    fanfare() {
      tone(523, 0.18, 'sine', 0.28);
      tone(659, 0.18, 'sine', 0.28, 0.14);
      tone(784, 0.34, 'sine', 0.3, 0.28);
    },
  };
}
