// The thief's tools, each with a cost: a limited count, spent when used. Smoke blinds every
// cone it covers, an EMP kills the cameras for a while, and a tossed coin pulls the nearest
// guard away to investigate the clink.

import { TOOLS } from './config.js';

export function createTools() {
  return {
    smoke: TOOLS.smoke.count,
    emp: TOOLS.emp.count,
    coin: TOOLS.coin.count,
    /** Active smoke clouds: {x, y, r, left}. */
    smokeClouds: [],
    /** Seconds of EMP left on the cameras. */
    empLeft: 0,
    /** Where the last coin landed, while a guard is still walking to it: {x, y} or null. */
    coinSpot: null,
  };
}

/** Use a smoke bomb at (x, y). Returns false when none are left. */
export function useSmoke(tools, x, y) {
  if (tools.smoke <= 0) return false;
  tools.smoke -= 1;
  tools.smokeClouds.push({ x, y, r: TOOLS.smoke.radius, left: TOOLS.smoke.seconds });
  return true;
}

/** Fire the EMP. Returns false when none are left. */
export function useEmp(tools) {
  if (tools.emp <= 0) return false;
  tools.emp -= 1;
  tools.empLeft = TOOLS.emp.seconds;
  return true;
}

/** Toss a coin toward (x, y), clamped to the tool's range. Returns the landing spot or null. */
export function useCoin(tools, from, x, y) {
  if (tools.coin <= 0) return null;
  const dx = x - from.x;
  const dy = y - from.y;
  const dist = Math.hypot(dx, dy);
  const reach = Math.min(dist, TOOLS.coin.range);
  const spot = dist === 0
    ? { x: from.x, y: from.y }
    : { x: from.x + (dx / dist) * reach, y: from.y + (dy / dist) * reach };
  tools.coin -= 1;
  tools.coinSpot = spot;
  return spot;
}

/** Age the tools' timed effects by dt seconds. */
export function stepTools(tools, dt) {
  for (let i = tools.smokeClouds.length - 1; i >= 0; i -= 1) {
    tools.smokeClouds[i].left -= dt;
    if (tools.smokeClouds[i].left <= 0) tools.smokeClouds.splice(i, 1);
  }
  if (tools.empLeft > 0) tools.empLeft = Math.max(0, tools.empLeft - dt);
}
