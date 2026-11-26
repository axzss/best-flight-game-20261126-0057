// Copperwing Ridge — every tuning number and colour in one place.
// The playfield is a fixed 1280x800 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size. World units are roughly metres: the plane
// cruises near 55 units a second and the valley course runs about four kilometres.

export const FIELD = { width: 1280, height: 800, horizonY: 330 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How far ahead, in world units, the ground bands are drawn. */
export const DRAW_DISTANCE = 1400;
/** Ground is drawn in bands this long, near to far. */
export const BAND_LENGTH = 25;
/** Camera focal length for the chase projection. */
export const FOCAL = 430;
/** How far behind the plane the chase camera sits. */
export const CAMERA_BEHIND = 26;

export const PLANE = {
  /** Top speed at full throttle, units per second. */
  maxSpeed: 78,
  /** Speed below which the wing stops flying and the nose drops. */
  stallSpeed: 24,
  /** How fast the throttle lever moves, per second. */
  throttleRate: 0.55,
  /** How fast the plane answers the stick, radians per second at full deflection. */
  pitchRate: 0.55,
  rollRate: 1.5,
  /** Bank angle the plane settles at in a full turn. */
  maxBank: 0.85,
  /** How much speed a hard turn scrubs off, per second at full bank. */
  turnDrag: 9,
  /** Base drag, per second. */
  drag: 1.6,
  /** Climb you get at full throttle and best pitch, units per second. */
  climbPower: 16,
  /** Sink rate when stalled, units per second. */
  stallSink: 14,
  /** Lowest safe altitude above the ground before the ground warning sounds. */
  groundWarning: 12,
};

export const FUEL = {
  start: 100,
  /** Units burned per second at idle. */
  idleBurn: 0.22,
  /** Extra units burned per second at full throttle. */
  throttleBurn: 0.85,
};

export const RING = {
  radius: 9,
  /** Rings in the Ring Run mission. */
  runCount: 10,
  /** Rings in the Timed Course mission. */
  courseCount: 8,
  /** Distance between consecutive rings, in world units. */
  spacing: 340,
  /** Points for flying through a ring, plus a centre bonus. */
  points: 100,
  centreBonus: 50,
};

export const RUNWAY = {
  /** Where the grass strip starts, in world units along the course. */
  startZ: 4200,
  length: 620,
  width: 15,
  /** Touchdown is a landing when the sink rate is under this, units per second. */
  maxSink: 6,
  /** Touchdown is a landing when the speed is under this. */
  maxSpeed: 46,
  landingPoints: 500,
};

export const COURSE = {
  /** Seconds on the clock when the Timed Course starts. */
  startTime: 75,
  /** Seconds added for each ring flown through. */
  ringBonus: 9,
};

/** Seconds of flight the title screen's attract mode has already flown. */
export const TITLE_SECONDS = 14;

export const PALETTE = {
  skyTop: '#2f6db3',
  skyMid: '#7fb2e0',
  skyHorizon: '#f6d9a0',
  sun: '#fff3c4',
  sunCore: '#fffbe8',
  mountainFar: '#7d8fb0',
  mountainNear: '#5d7050',
  hillLeft: '#4a7a3f',
  hillRight: '#557a45',
  fieldA: '#8fae4e',
  fieldB: '#a8b95c',
  fieldC: '#7fae6a',
  fieldD: '#c2b25e',
  river: '#4f9ecf',
  runway: '#5a5148',
  runwayEdge: '#e8e4d8',
  runwayLine: '#f4f1e6',
  treeDark: '#2f5d33',
  treeLight: '#4c8a3f',
  trunk: '#6b4a2f',
  ring: '#ffb02e',
  ringPassed: '#57d977',
  ringNext: '#ffb02e',
  planeBody: '#c96a2e',
  planeBodyDark: '#9c4d1e',
  planeWing: '#e08a3e',
  planeCream: '#f2e3c2',
  propDisc: 'rgba(220, 230, 240, 0.28)',
  panel: '#1c212b',
  panelEdge: '#39414f',
  panelGlass: '#0d1420',
  dialFace: '#10151d',
  dialTick: '#c8d2de',
  dialNeedle: '#ff5a3c',
  text: '#f2f5f8',
  muted: '#9aa7b5',
  amber: '#ffb02e',
  green: '#57d977',
  red: '#ff5a3c',
  white: '#ffffff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = '"SF Mono", "Cascadia Mono", Consolas, monospace';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'copperwing-ridge.best';
