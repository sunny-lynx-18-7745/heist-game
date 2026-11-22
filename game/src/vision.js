// Vision only: cones, line of sight and detection. Nothing here moves anything; the world
// asks "can this watcher see the thief?" and gets a number back, so the rules stay in one place.

/** True when the segment p1-p2 crosses the rectangle r (edges count). */
export function segmentHitsRect(p1, p2, r) {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  if (maxX < r.x || minX > r.x + r.w || maxY < r.y || minY > r.y + r.h) return false;
  if (p1.x >= r.x && p1.x <= r.x + r.w && p1.y >= r.y && p1.y <= r.y + r.h) return true;
  if (p2.x >= r.x && p2.x <= r.x + r.w && p2.y >= r.y && p2.y <= r.y + r.h) return true;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const edges = [
    [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }],
    [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }],
    [{ x: r.x, y: r.y + r.h }, { x: r.x, y: r.y }],
  ];
  for (const [a, b] of edges) {
    const denom = (b.y - a.y) * dx - (b.x - a.x) * dy;
    if (denom === 0) continue;
    const t = ((b.x - a.x) * (p1.y - a.y) - (b.y - a.y) * (p1.x - a.x)) / denom;
    const u = ((p1.x - a.x) * dy - (p1.y - a.y) * dx) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

/** True when nothing sight-blocking stands between watcher and target. */
export function hasLineOfSight(from, to, blockers) {
  for (let i = 0; i < blockers.length; i += 1) {
    if (segmentHitsRect(from, to, blockers[i])) return false;
  }
  return true;
}

/** Smallest absolute angle between two headings, in radians. */
export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * How strongly a watcher at `from`, facing `heading`, with a cone of `halfAngle` and `range`,
 * can see `target`: 0 when out of range, out of the cone or behind cover, rising to 1 up
 * close and dead ahead. Smoke (a list of {x, y, r}) blinds any line crossing it.
 */
export function coneVisibility(from, heading, halfAngle, range, target, blockers, smoke) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (dist > 1 && angleDifference(Math.atan2(dy, dx), heading) > halfAngle) return 0;
  if (!hasLineOfSight(from, target, blockers)) return 0;
  if (smoke) {
    for (let i = 0; i < smoke.length; i += 1) {
      const s = smoke[i];
      if (segmentHitsRect(from, target, { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 })) return 0;
    }
  }
  // Nearer and more centred reads stronger: 0.45 at the cone's edge, 1.0 point blank.
  const closeness = 1 - dist / range;
  return 0.45 + 0.55 * closeness;
}

/** True when a circle at (x, y, r) overlaps rectangle r. */
export function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}
