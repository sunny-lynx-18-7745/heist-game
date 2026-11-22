// The heist itself: the thief, the guards, the cameras, the lasers and the alarm meter.
// One fixed step advances everything; the renderer only reads the state it returns.

import {
  ALARM, CAMERA, GUARD, LASER, ROOM, SCORE, STEP, THIEF, TIME_LIMIT, TOOLS,
} from './config.js';
import { buildLevel, wallRects } from './level.js';
import { createRandom } from './random.js';
import { angleDifference, circleHitsRect, coneVisibility, hasLineOfSight } from './vision.js';
import { createTools, stepTools, useCoin, useEmp, useSmoke } from './tools.js';

export const EVENT_SPOTTED = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_PICKUP = 16;
export const EVENT_STAR = 32;
export const EVENT_LASER = 64;
export const EVENT_TIMEOUT = 128;
export const EVENT_COIN = 256;
export const EVENT_SMOKE = 512;
export const EVENT_EMP = 1024;

const WAYPOINT_PAUSE = 1.2;
const INVESTIGATE_LOOK = 2.2;
const CHASE_MEMORY = 3.0;
const CATCH_DISTANCE = GUARD.radius + THIEF.radius + 2;

function moveWithCollision(state, x, y, dx, dy, radius) {
  const solids = state.solids;
  let nx = x + dx;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nx, y, radius, solids[i])) {
      nx = dx > 0 ? solids[i].x - radius : solids[i].x + solids[i].w + radius;
    }
  }
  let ny = y + dy;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nx, ny, radius, solids[i])) {
      ny = dy > 0 ? solids[i].y - radius : solids[i].y + solids[i].h + radius;
    }
  }
  nx = Math.max(20 + radius, Math.min(ROOM.width - 20 - radius, nx));
  ny = Math.max(20 + radius, Math.min(ROOM.height - 20 - radius, ny));
  return { x: nx, y: ny };
}

function makeGuard(def, random) {
  const first = def.waypoints[0];
  return {
    id: def.id,
    name: def.name,
    x: first.x,
    y: first.y,
    heading: 0,
    waypointIndex: 1,
    mode: 'patrol',
    detection: 0,
    lastSeen: null,
    unseenFor: 0,
    // Staggered starts, so the three guards are never in step with each other.
    waitLeft: random() * 1.5,
    investigateTarget: null,
    suspicious: false,
  };
}

function makeCamera(def, random) {
  return {
    id: def.id,
    name: def.name,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    angle: def.baseAngle,
    phase: random() * Math.PI * 2,
    detection: 0,
    disabled: false,
  };
}

export function createWorld(seed = 0) {
  const random = createRandom(seed);
  const level = buildLevel();
  const state = {
    seed,
    level,
    solids: [...wallRects(), ...level.obstacles],
    sightBlockers: [...wallRects(), ...level.obstacles.filter((o) => o.blocksSight)],
    thief: {
      x: level.entry.x, y: level.entry.y, heading: -Math.PI / 2,
      sneaking: false, grabbing: null, grabProgress: 0, moving: false,
    },
    guards: level.guards.map((def) => makeGuard(def, random)),
    cameras: level.cameras.map((def) => makeCamera(def, random)),
    tools: createTools(),
    alarm: 0,
    alarmTripped: false,
    timeLeft: TIME_LIMIT,
    elapsed: 0,
    starTaken: false,
    starGrabbedAt: 0,
    score: 0,
    phase: 'playing',
    laserOn: true,
    laserCycle: 0,
    coinSpot: null,
    seenNow: false,
    message: '',
    messageLeft: 0,
  };
  return {
    state,
    reset() {
      const fresh = createWorld(seed);
      Object.assign(state, fresh.state);
    },
    step: (input, dt = STEP) => step(state, input, dt),
  };
}

function laserBeamXs(level) {
  const xs = [];
  for (let x = level.lasers.x0; x <= level.lasers.x1; x += LASER.beamGap) xs.push(x);
  return xs;
}

/** One fixed step. `input` is {dx, dy, sneak, grab, useTool, toolTarget}. Returns event bits. */
function step(state, input, dt = STEP) {
  if (state.phase !== 'playing') return 0;
  let events = 0;
  state.elapsed += dt;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft <= 0) {
    state.phase = 'timeout';
    return EVENT_TIMEOUT;
  }

  const thief = state.thief;
  const level = state.level;

  // --- Tools (keys 1/2/3, mouse click tosses a coin at the cursor) ---
  if (input.useTool === 'smoke' && useSmoke(state.tools, thief.x, thief.y)) events |= EVENT_SMOKE;
  if (input.useTool === 'emp' && useEmp(state.tools)) events |= EVENT_EMP;
  if (input.useTool === 'coin') {
    const spot = useCoin(state.tools, thief, input.toolTarget.x, input.toolTarget.y);
    if (spot) {
      state.coinSpot = spot;
      events |= EVENT_COIN;
      for (const guard of state.guards) {
        if (guard.mode !== 'chase') {
          guard.mode = 'investigate';
          guard.investigateTarget = { ...spot };
        }
      }
    }
  }
  stepTools(state.tools, dt);

  // --- Thief movement ---
  const speed = input.sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
  const len = Math.hypot(input.dx, input.dy);
  thief.sneaking = input.sneak;
  thief.moving = len > 0;
  let moved = { x: thief.x, y: thief.y };
  if (len > 0) {
    const nx = (input.dx / len) * speed * dt;
    const ny = (input.dy / len) * speed * dt;
    moved = moveWithCollision(state, thief.x, thief.y, nx, ny, THIEF.radius);
    thief.heading = Math.atan2(ny, nx);
    thief.grabbing = null;
    thief.grabProgress = 0;
  }
  thief.x = moved.x;
  thief.y = moved.y;

  // --- Grabbing loot (hold Space / E near it) ---
  let grabTarget = null;
  if (!state.starTaken) {
    const d = Math.hypot(thief.x - level.star.x, thief.y - level.star.y);
    if (d < THIEF.grabRadius + level.star.r) grabTarget = { kind: 'star', x: level.star.x, y: level.star.y };
  }
  if (!grabTarget) {
    for (const art of level.artefacts) {
      if (art.taken) continue;
      const d = Math.hypot(thief.x - art.x, thief.y - art.y);
      if (d < THIEF.grabRadius + art.r) {
        grabTarget = { kind: 'artefact', id: art.id, name: art.name, x: art.x, y: art.y };
        break;
      }
    }
  }
  if (input.grab && grabTarget && len === 0) {
    thief.grabbing = grabTarget;
    thief.grabProgress += dt / THIEF.grabSeconds;
    if (thief.grabProgress >= 1) {
      if (grabTarget.kind === 'star') {
        state.starTaken = true;
        state.starGrabbedAt = state.elapsed;
        state.score += SCORE.star;
        events |= EVENT_STAR;
        state.message = 'The Star of Meridian is yours. Get to the getaway door!';
        state.messageLeft = 4;
      } else {
        const art = level.artefacts.find((a) => a.id === grabTarget.id);
        art.taken = true;
        state.score += SCORE.artefact;
        events |= EVENT_PICKUP;
        state.message = `${grabTarget.name} pocketed (+${SCORE.artefact}).`;
        state.messageLeft = 3;
      }
      thief.grabbing = null;
      thief.grabProgress = 0;
    }
  } else {
    thief.grabbing = null;
    thief.grabProgress = 0;
  }

  // --- Lasers: on, then a flicker-off window to slip through ---
  state.laserCycle = (state.laserCycle + dt) % LASER.cycleSeconds;
  state.laserOn = state.laserCycle < LASER.cycleSeconds - LASER.offSeconds;
  if (state.laserOn) {
    const lz = level.lasers;
    if (thief.y > lz.y0 - THIEF.radius && thief.y < lz.y1 + THIEF.radius) {
      for (const bx of laserBeamXs(level)) {
        if (Math.abs(thief.x - bx) < THIEF.radius) {
          // A live beam trips the alarm fast: about a second and a half to cross safely.
          state.alarm = Math.min(ALARM.max, state.alarm + 45 * dt);
          events |= EVENT_LASER;
          break;
        }
      }
    }
  }

  // --- Cameras sweep and watch ---
  const blockers = state.sightBlockers;
  const smoke = state.tools.smokeClouds;
  const camerasDead = state.tools.empLeft > 0;
  let anyoneSees = false;
  for (const cam of state.cameras) {
    cam.disabled = camerasDead;
    cam.angle = cam.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed + cam.phase) * CAMERA.sweepHalfAngle;
    if (cam.disabled) {
      cam.detection = Math.max(0, cam.detection - CAMERA.detectRate * dt);
      continue;
    }
    const vis = coneVisibility(
      cam, cam.angle, CAMERA.viewHalfAngle, CAMERA.viewRange,
      thief, blockers, smoke,
    );
    if (vis > 0) {
      anyoneSees = true;
      cam.detection = Math.min(1, cam.detection + vis * CAMERA.detectRate * dt);
      // A camera that is sure of what it sees sends the nearest guard to look.
      if (cam.detection >= 0.6) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const guard of state.guards) {
          if (guard.mode !== 'patrol') continue;
          const d = Math.hypot(guard.x - thief.x, guard.y - thief.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = guard;
          }
        }
        if (nearest) {
          nearest.mode = 'investigate';
          nearest.investigateTarget = { x: thief.x, y: thief.y };
          nearest.detection = Math.max(nearest.detection, GUARD.suspiciousAt);
        }
      }
    } else {
      cam.detection = Math.max(0, cam.detection - GUARD.forgetRate * dt);
    }
  }

  // --- Guards patrol, investigate, chase; their cones watch ---
  for (const guard of state.guards) {
    const vis = coneVisibility(
      guard, guard.heading, GUARD.viewHalfAngle, GUARD.viewRange,
      thief, blockers, smoke,
    );
    const sneakFactor = thief.sneaking ? 0.5 : 1;
    if (vis > 0) {
      anyoneSees = true;
      const rate = (vis < 0.6 ? GUARD.detectRate : GUARD.detectRateClose) * sneakFactor;
      const before = guard.detection;
      guard.detection = Math.min(1, guard.detection + vis * rate * dt);
      guard.lastSeen = { x: thief.x, y: thief.y };
      guard.unseenFor = 0;
      if (before < GUARD.suspiciousAt && guard.detection >= GUARD.suspiciousAt && guard.mode === 'patrol') {
        events |= EVENT_SPOTTED;
        state.message = `${guard.name} thinks he saw something…`;
        state.messageLeft = 2.5;
      }
      if (guard.detection >= GUARD.alarmAt && guard.mode !== 'chase') {
        guard.mode = 'chase';
        if (!state.alarmTripped) {
          state.alarmTripped = true;
          state.alarm = ALARM.max;
          events |= EVENT_ALARM;
          state.message = 'ALARM! Every guard is coming for you — run!';
          state.messageLeft = 4;
        }
      }
    } else {
      guard.detection = Math.max(0, guard.detection - GUARD.forgetRate * dt);
      guard.unseenFor += dt;
      if (guard.mode === 'chase' && guard.unseenFor > CHASE_MEMORY) {
        guard.mode = 'investigate';
        guard.investigateTarget = guard.lastSeen ? { ...guard.lastSeen } : null;
      }
    }

    // Guard movement by mode.
    if (guard.mode === 'patrol') {
      const target = level.guards.find((g) => g.id === guard.id).waypoints[guard.waypointIndex];
      if (guard.waitLeft > 0) {
        guard.waitLeft -= dt;
        guard.heading += dt * 0.9;
      } else {
        const dx = target.x - guard.x;
        const dy = target.y - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          guard.waypointIndex = (guard.waypointIndex + 1) % level.guards.find((g) => g.id === guard.id).waypoints.length;
          guard.waitLeft = WAYPOINT_PAUSE;
        } else {
          const stepLen = GUARD.patrolSpeed * dt;
          const nx = (dx / dist) * stepLen;
          const ny = (dy / dist) * stepLen;
          const pos = moveWithCollision(state, guard.x, guard.y, nx, ny, GUARD.radius);
          guard.x = pos.x;
          guard.y = pos.y;
          guard.heading = Math.atan2(dy, dx);
        }
      }
    } else if (guard.mode === 'investigate' && guard.investigateTarget) {
      const target = guard.investigateTarget;
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        guard.waitLeft += dt;
        guard.heading += dt * 1.4;
        if (guard.waitLeft > INVESTIGATE_LOOK) {
          guard.mode = 'patrol';
          guard.investigateTarget = null;
          guard.waitLeft = 0;
          if (state.coinSpot && Math.hypot(state.coinSpot.x - target.x, state.coinSpot.y - target.y) < 12) {
            state.coinSpot = null;
          }
        }
      } else {
        guard.waitLeft = 0;
        const stepLen = GUARD.investigateSpeed * dt;
        const pos = moveWithCollision(state, guard.x, guard.y, (dx / dist) * stepLen, (dy / dist) * stepLen, GUARD.radius);
        guard.x = pos.x;
        guard.y = pos.y;
        guard.heading = Math.atan2(dy, dx);
      }
    } else if (guard.mode === 'chase') {
      const target = guard.lastSeen || { x: thief.x, y: thief.y };
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const stepLen = GUARD.chaseSpeed * dt;
        const pos = moveWithCollision(state, guard.x, guard.y, (dx / dist) * stepLen, (dy / dist) * stepLen, GUARD.radius);
        guard.x = pos.x;
        guard.y = pos.y;
        guard.heading = Math.atan2(dy, dx);
      }
    }

    // Caught on touch — but only when the guard has noticed the thief: bumping into a
    // guard who never saw you is a shove, not a capture. Smoke and a blind back count.
    const touchVis = coneVisibility(guard, guard.heading, GUARD.viewHalfAngle, GUARD.viewRange, thief, blockers, smoke);
    if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < CATCH_DISTANCE
      && (guard.detection > 0.2 || touchVis > 0)) {
      state.phase = 'caught';
      return EVENT_CAUGHT;
    }
  }

  // --- Alarm meter: rises while seen or chased, drains while hidden ---
  if (anyoneSees) state.alarm = Math.min(ALARM.max, state.alarm + ALARM.seenGain * dt);
  else if (!state.alarmTripped) state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
  if (state.guards.some((g) => g.mode === 'chase') && !state.alarmTripped) {
    state.alarm = Math.min(ALARM.max, state.alarm + ALARM.chaseGain * dt);
  }
  if (state.alarm >= ALARM.max && !state.alarmTripped) {
    state.alarmTripped = true;
    events |= EVENT_ALARM;
    state.message = 'ALARM! Every guard is coming for you — run!';
    state.messageLeft = 4;
    for (const guard of state.guards) {
      if (guard.mode !== 'chase') {
        guard.mode = 'chase';
        guard.lastSeen = { x: thief.x, y: thief.y };
      }
    }
  }
  state.seenNow = anyoneSees;

  if (state.messageLeft > 0) state.messageLeft -= dt;

  // --- Win: the Star in hand and the thief at the getaway door ---
  if (state.starTaken) {
    const e = level.exit;
    if (thief.x > e.x - e.w / 2 && thief.x < e.x + e.w / 2 && thief.y > e.y - e.h / 2 - 10 && thief.y < e.y + e.h / 2 + 30) {
      state.phase = 'won';
      const timeBonus = Math.round(state.timeLeft) * SCORE.timeBonusPerSecond;
      const alarmPenalty = Math.round(state.alarm) * SCORE.alarmPenaltyPerPoint;
      const unused = state.tools.smoke + state.tools.emp + state.tools.coin;
      const toolBonus = unused * SCORE.toolBonus;
      state.score += Math.max(0, timeBonus - alarmPenalty) + toolBonus;
      state.winBreakdown = { timeBonus, alarmPenalty, toolBonus };
      return events | EVENT_WIN;
    }
  }

  return events;
}

/** Final score shown on the end screens. */
export function finalScore(state) {
  return state.score;
}
