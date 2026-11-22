// The screenshot scenes behind ?shot=start|play|alarm|win. Each one plays the real rules
// forward from a fresh world, steered by an autopilot that reads the guards' cones the way a
// player would — waiting out a sweep, ducking back when seen, slipping the lasers while they
// flicker off — so the frame is what a real game looks like, and the same seed always gives
// the same frame.
import { CAMERA, GUARD, STEP } from './config.js';
import { coneVisibility } from './vision.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 8;
const ALARM_SECONDS = 40;
const WIN_LIMIT_SECONDS = 170;

/** The route the autopilot runs: west wing loot, up the middle, the Star, back west and out. */
const HEIST_ROUTE = [
  { x: 150, y: 330, grab: 'falcon' },
  { x: 300, y: 300 },
  { x: 640, y: 260 },
  { x: 640, y: 130, grab: 'star' },
  { x: 300, y: 260 },
  { x: 200, y: 560 },
  { x: 640, y: 620 },
  { x: 1188, y: 640 },
];

/** How strongly any watcher can see the thief right now (0 when unseen). */
function worstVisibility(state) {
  const thief = state.thief;
  const blockers = state.sightBlockers;
  const smoke = state.tools.smokeClouds;
  let worst = 0;
  let watcher = null;
  for (const guard of state.guards) {
    const vis = coneVisibility(guard, guard.heading, GUARD.viewHalfAngle, GUARD.viewRange, thief, blockers, smoke);
    if (vis > worst) {
      worst = vis;
      watcher = guard;
    }
  }
  for (const cam of state.cameras) {
    if (cam.disabled) continue;
    const vis = coneVisibility(cam, cam.angle, CAMERA.viewHalfAngle, CAMERA.viewRange, thief, blockers, smoke);
    if (vis > worst) {
      worst = vis;
      watcher = cam;
    }
  }
  return { vis: worst, watcher };
}

function lootTaken(state, grab) {
  if (grab === 'star') return state.starTaken;
  const art = state.level.artefacts.find((a) => a.id === grab);
  return art ? art.taken : true;
}

function nearestLoot(state, grab) {
  if (grab === 'star') return state.level.star;
  return state.level.artefacts.find((a) => a.id === grab);
}

/**
 * One autopilot decision: where to move, whether to sneak, whether to grab, whether to wait.
 * Seen but not yet chased, the thief backs straight away from the watcher that sees him;
 * chased, he drops smoke and sprints for the waypoint.
 */
function pilotInput(state, target, careless = false) {
  const thief = state.thief;
  const input = { dx: 0, dy: 0, sneak: false, grab: false, useTool: null, toolTarget: { x: 0, y: 0 } };
  if (!target) return input;

  // Finish a grab in progress: stand still and hold the button.
  if (thief.grabbing) {
    input.grab = true;
    return input;
  }

  // Near the loot this waypoint wants: stop and lift it.
  if (target.grab && !lootTaken(state, target.grab)) {
    const loot = nearestLoot(state, target.grab);
    const grabRange = 46 + (loot.r || 20) - 4;
    if (Math.hypot(thief.x - loot.x, thief.y - loot.y) < grabRange) {
      input.grab = true;
      return input;
    }
  }

  const { vis, watcher } = worstVisibility(state);
  const chased = state.guards.some((g) => g.mode === 'chase');
  if (!careless && chased && state.tools.smoke > 0 && state.tools.smokeClouds.length === 0) {
    input.useTool = 'smoke';
  }
  // Star in hand, a camera watching the getaway corridor: kill the cameras.
  if (!careless && state.starTaken && state.tools.emp > 0 && state.tools.empLeft <= 0 && watcher && watcher.id && watcher.id.startsWith('cam') && vis > 0.2) {
    input.useTool = 'emp';
  }

  let dest = target;
  if (!careless && vis > 0.25 && !chased && watcher) {
    // Back away from the watcher until its cone loses the thief.
    const dx = thief.x - watcher.x;
    const dy = thief.y - watcher.y;
    const dist = Math.hypot(dx, dy) || 1;
    dest = { x: thief.x + (dx / dist) * 120, y: thief.y + (dy / dist) * 120 };
  }

  // The lasers: never step into the band while they are live; wait below it.
  const band = state.level.lasers;
  if (dest.y < band.y0 && thief.y > band.y1 + 20 && state.laserOn) {
    dest = { x: 640, y: band.y1 + 70 };
  }

  const dx = dest.x - thief.x;
  const dy = dest.y - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) return input;
  input.dx = dx / dist;
  input.dy = dy / dist;
  // Sneak when a guard is near or already suspicious.
  const nearGuard = state.guards.some((g) => Math.hypot(g.x - thief.x, g.y - thief.y) < 230 || g.detection > 0.2);
  input.sneak = !careless && nearGuard && !chased;
  return input;
}

/** Drive the world along `route` for up to `maxSeconds`. Returns how it ended. */
function drive(world, route, maxSeconds, careless = false, stopWhen = null) {
  const state = world.state;
  let waypoint = 0;
  let seconds = 0;
  for (let i = 0; i < maxSeconds / STEP; i += 1) {
    if (state.phase !== 'playing') break;
    seconds += STEP;
    const target = route[waypoint];
    world.step(pilotInput(state, target, careless));
    if (target) {
      const close = Math.hypot(state.thief.x - target.x, state.thief.y - target.y) < 26;
      const done = target.grab ? lootTaken(state, target.grab) : close;
      if (done) waypoint += 1;
    }
    // Star in hand and a guard on the tail: skip the scenic route, run for the door.
    if (state.starTaken && state.guards.some((g) => g.mode === 'chase')) {
      waypoint = route.length - 1;
    }
    if (stopWhen && stopWhen(state)) break;
  }
  return { seconds, waypoint, phase: state.phase };
}

/**
 * Set `world` to the named scene (start, play, alarm or win) and return the screen to draw
 * over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'win') {
    const result = drive(world, HEIST_ROUTE, WIN_LIMIT_SECONDS);
    if (result.phase === 'won') return { screen: SCREEN_WIN, best: state.score };
    // The autopilot fell short: show the closest it got, a thief at the Star, mid-grab.
    world.reset();
    drive(world, HEIST_ROUTE.slice(0, 4), WIN_LIMIT_SECONDS);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alarm') {
    // Play the heist forward carelessly — no ducking, no sneaking — so the cones catch
    // the thief and the alarm climbs. If it is still low, stage the moment: alarm high,
    // a guard closing in.
    drive(world, HEIST_ROUTE, ALARM_SECONDS, true, (s) => s.alarm >= 45);
    if (state.alarm < 40 && state.phase === 'playing') {
      state.alarm = 62;
      const nearest = state.guards.reduce((a, b) => (
        Math.hypot(a.x - state.thief.x, a.y - state.thief.y)
        < Math.hypot(b.x - state.thief.x, b.y - state.thief.y) ? a : b
      ));
      nearest.mode = 'investigate';
      nearest.investigateTarget = { x: state.thief.x, y: state.thief.y };
      nearest.detection = 0.6;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'play') {
    drive(world, HEIST_ROUTE, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  // start: the title over a living room — guards on patrol, thief at the door.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step({ dx: 0, dy: 0, sneak: false, grab: false, useTool: null, toolTarget: { x: 0, y: 0 } });
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
