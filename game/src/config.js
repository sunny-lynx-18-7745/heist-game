// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// The Meridian Vault: one grand gallery, crossed from the service door (bottom left) to the
// Star of Meridian (top centre) and out through the getaway door (bottom right).

export const FIELD = { width: 1280, height: 776 };
/** The room itself, drawn below the HUD bar. */
export const ROOM = { width: 1280, height: 720 };
export const HUD_HEIGHT = 56;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Seconds on the clock when a heist starts; reaching zero with the loot ungrabbed ends the run. */
export const TIME_LIMIT = 180;

export const THIEF = {
  radius: 13,
  walkSpeed: 205,
  sneakSpeed: 115,
  grabSeconds: 1.6,
  /** How close the thief must be to grab the Star or a side artefact. */
  grabRadius: 46,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  chaseSpeed: 165,
  investigateSpeed: 120,
  /** Vision cone: how far a guard sees and how wide the cone is (radians). */
  viewRange: 235,
  viewHalfAngle: 0.62,
  /** Detection fills (per second) when the thief is in the cone and in sight. */
  detectRate: 1.15,
  detectRateClose: 2.4,
  closeRange: 90,
  /** Detection drains when the thief is unseen. */
  forgetRate: 0.55,
  /** At this detection a guard turns suspicious and walks to the last seen spot. */
  suspiciousAt: 0.45,
  /** At this detection the guard raises the alarm and chases. */
  alarmAt: 1,
};

export const CAMERA = {
  /** Wall cameras sweep a cone from a fixed pivot. */
  viewRange: 250,
  viewHalfAngle: 0.5,
  sweepHalfAngle: 0.85,
  sweepSpeed: 0.55,
  detectRate: 0.9,
  /** Seconds a camera stays dead after an EMP. */
  empSeconds: 9,
};

/** The laser grid in front of the Star: crossing a beam while it is live raises the alarm. */
export const LASER = {
  beamGap: 34,
  /** The grid flickers off for this long every cycle, a window to slip through. */
  offSeconds: 1.1,
  cycleSeconds: 4.2,
};

export const ALARM = {
  /** Alarm decay per second while nobody sees the thief. */
  decay: 4.5,
  /** Alarm gain per second while any guard or camera sees the thief. */
  seenGain: 26,
  /** Alarm gain per second while a guard is chasing. */
  chaseGain: 14,
  /** At 100 the alarm trips: guards converge and the run is nearly over. */
  max: 100,
  /** Seconds of grace after the alarm trips before a touch means capture. */
  tripGrace: 0,
};

export const TOOLS = {
  smoke: { count: 2, key: '1', name: 'Smoke', radius: 110, seconds: 6, blurb: 'Smoke bomb — blinds cones' },
  emp: { count: 1, key: '2', name: 'EMP', seconds: 9, blurb: 'EMP pulse — kills cameras' },
  coin: { count: 3, key: '3', name: 'Coin', range: 260, blurb: 'Coin toss — distracts a guard' },
};

export const SCORE = {
  star: 5000,
  artefact: 1200,
  timeBonusPerSecond: 25,
  alarmPenaltyPerPoint: 15,
  toolBonus: 400,
};

export const PALETTE = {
  backdrop: '#0a0d16',
  floorA: '#171c2b',
  floorB: '#1b2133',
  floorLine: '#232a3d',
  carpet: '#3f1a22',
  carpetEdge: '#6b5a35',
  wall: '#2e3550',
  wallTop: '#454f74',
  caseGlass: '#3d5a78',
  caseGold: '#d9a441',
  pillar: '#39415f',
  plant: '#2e5d43',
  thief: '#e8e4d8',
  thiefCoat: '#23202a',
  guard: '#c94f43',
  guardDark: '#7e2f28',
  camera: '#d9a441',
  coneGuard: 'rgba(233, 196, 90, 0.20)',
  coneGuardEdge: 'rgba(233, 196, 90, 0.55)',
  coneCamera: 'rgba(217, 68, 68, 0.16)',
  coneCameraEdge: 'rgba(217, 68, 68, 0.5)',
  loot: '#ffd94d',
  lootGlow: 'rgba(255, 217, 77, 0.35)',
  laser: 'rgba(255, 70, 70, 0.85)',
  laserOff: 'rgba(255, 70, 70, 0.12)',
  smoke: 'rgba(200, 205, 220, 0.55)',
  exit: '#3f9e6b',
  exitGlow: 'rgba(63, 158, 107, 0.35)',
  text: '#eef1f5',
  muted: '#9aa3b8',
  alarmLow: '#3f9e6b',
  alarmMid: '#d9a441',
  alarmHigh: '#d94f43',
  panel: 'rgba(10, 13, 22, 0.88)',
  panelEdge: '#3a4360',
  gold: '#d9a441',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-vault.best';
