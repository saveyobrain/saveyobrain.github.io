/** Pure Look UP playfield geometry (no Babylon), shared by the runtime and tests. */

/** Half-width of the play lane (world X). */
export const PLAYFIELD_HALF = 5.2;
/**
 * World Y where rocks meet the station. The deck billboard is placed so its
 * top metal lip sits on this line and the rest of the hull falls below the view.
 * Lowered so the deck shows about 30% less of the screen than the previous lip.
 */
export const IMPACT_Y = 0.92;
/** Minimum centre distance so one rock's badge does not cover another. */
export const MIN_SEPARATION = 2.55;
/**
 * Wider gap for split shards. 36 ÷ 3, 36 ÷ 4, and 36 ÷ 6 drop 3, 4, or 6
 * full-size rocks; a tighter ring lets those pieces cover each other.
 */
export const SPLIT_SEPARATION = 3.45;
/**
 * Clearance past the frustum edge. Covers the largest rock (≈1.45 world units
 * from centre, plus the selected-scale bump) so a rock is fully hidden at spawn,
 * while keeping it close enough to start showing within about a second.
 */
export const FRUSTUM_MARGIN = 1.6;

export interface ApproachSpawn {
  x: number;
  y: number;
  z: number;
  /** Deck aim point — rock drifts toward (targetX, IMPACT_Y). */
  targetX: number;
}

/** Live frustum half-extents at the play plane (z≈0), from the game camera. */
export interface PlayFrustum {
  halfW: number;
  halfH: number;
  /** World Y of the camera aim / frustum center. */
  centerY: number;
}

/** Frustum at the z=0 plane for a camera `distance` away with vertical `fov` (radians). */
export function frustumAtPlane(distance: number, fov: number, aspect: number, centerY: number): PlayFrustum {
  const halfH = distance * Math.tan(fov * 0.5);
  return { halfW: halfH * Math.max(0.5, aspect), halfH, centerY };
}

export function isInsideFrustum(p: { x: number; y: number }, f: PlayFrustum, pad = 0): boolean {
  return Math.abs(p.x) <= f.halfW + pad && Math.abs(p.y - f.centerY) <= f.halfH + pad;
}

type ApproachKind = "top" | "left" | "right" | "cornerL" | "cornerR";

/**
 * Spawn just outside the live frustum on the top edge, a side, or a top corner,
 * then drift into view toward a deck aim point. Never inside the visible rectangle.
 */
export function pickApproachSpawn(
  rng: { next(): number; pick<T>(items: readonly T[]): T },
  frustum: PlayFrustum,
): ApproachSpawn {
  const top = frustum.centerY + frustum.halfH;
  const edgeX = frustum.halfW + FRUSTUM_MARGIN;
  const spawnTop = top + FRUSTUM_MARGIN;
  // Side entries stay in the upper part of the frame so they cross the sky, not the deck.
  const sideLow = Math.max(IMPACT_Y + 3, frustum.centerY - frustum.halfH * 0.1);
  const sideHigh = top - 1;
  const kind = rng.pick<ApproachKind>(["top", "top", "top", "left", "right", "cornerL", "cornerR"]);
  const targetX = (rng.next() * 2 - 1) * (PLAYFIELD_HALF * 0.55);
  const z = (rng.next() - 0.5) * 0.35;
  switch (kind) {
    case "top":
      return {
        x: (rng.next() * 2 - 1) * frustum.halfW * 0.8,
        y: spawnTop + rng.next() * 0.3,
        z,
        targetX,
      };
    case "left":
      return {
        x: -edgeX - rng.next() * 0.3,
        y: sideLow + rng.next() * Math.max(0, sideHigh - sideLow),
        z,
        targetX: Math.min(targetX, 0.9),
      };
    case "right":
      return {
        x: edgeX + rng.next() * 0.3,
        y: sideLow + rng.next() * Math.max(0, sideHigh - sideLow),
        z,
        targetX: Math.max(targetX, -0.9),
      };
    case "cornerL":
      return {
        x: -edgeX - rng.next() * 0.3,
        y: spawnTop + rng.next() * 0.3,
        z,
        targetX: Math.min(targetX, 0.2),
      };
    case "cornerR":
      return {
        x: edgeX + rng.next() * 0.3,
        y: spawnTop + rng.next() * 0.3,
        z,
        targetX: Math.max(targetX, -0.2),
      };
  }
}

export interface OccupiedSpot {
  x: number;
  y: number;
  targetX?: number;
}

/** True when `p` sits on top of an existing rock. */
export function tooClose(
  p: { x: number; y: number },
  others: readonly { x: number; y: number }[],
  min = MIN_SEPARATION,
): boolean {
  return others.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < min);
}

/**
 * Like `pickApproachSpawn`, but retry so a new rock does not cover one already in play
 * and does not share its deck lane.
 */
export function pickSeparatedApproach(
  rng: { next(): number; pick<T>(items: readonly T[]): T },
  frustum: PlayFrustum,
  occupied: readonly OccupiedSpot[],
): ApproachSpawn {
  let fallback = pickApproachSpawn(rng, frustum);
  for (let i = 0; i < 14; i++) {
    const p = i === 0 ? fallback : pickApproachSpawn(rng, frustum);
    const clear = occupied.every((o) => {
      const apart = Math.hypot(p.x - o.x, p.y - o.y) >= MIN_SEPARATION;
      const lane = o.targetX === undefined || Math.abs(p.targetX - o.targetX) >= 1.15;
      return apart && lane;
    });
    if (clear) return p;
    fallback = p;
  }
  return fallback;
}

/** Clamp a split shard's lane X to the play column. */
export function spawnAbove(laneX: number, height: number, depth = 0): { x: number; y: number; z: number } {
  return {
    x: Math.max(-PLAYFIELD_HALF, Math.min(PLAYFIELD_HALF, laneX)),
    y: height,
    z: depth,
  };
}

/**
 * Place split shards on an arc above the break. `dy` is never negative, so a
 * child does not appear closer to the station than the rock that just split.
 */
export function splitRingOffsets(
  count: number,
  rng: { next(): number },
  radius?: number,
): { dx: number; dy: number; dz: number }[] {
  const n = Math.max(1, count);
  const span = Math.PI * 0.76;
  const step = n <= 1 ? Math.PI : span / (n - 1);
  const needed = n <= 1 ? 1.5 : SPLIT_SEPARATION / (2 * Math.sin(step / 2));
  const r0 = radius ?? Math.max(2.35, needed + 0.2);
  const jitter = (rng.next() - 0.5) * 0.18;
  const start = Math.PI * 0.12;
  const end = Math.PI * 0.88;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ang = Math.min(Math.PI - 0.08, Math.max(0.08, start + (end - start) * t + jitter + (rng.next() - 0.5) * 0.1));
    const rad = r0 * (0.94 + rng.next() * 0.12);
    return {
      dx: Math.cos(ang) * rad,
      dy: Math.sin(ang) * rad,
      dz: (rng.next() - 0.5) * 0.2,
    };
  });
}

/**
 * Drop a shard around the parent. Overlaps are pushed sideways or upward, never
 * down toward the station, and the result stays at or above the break.
 */
export function placeAroundBreak(
  parent: { x: number; y: number; z: number },
  offset: { dx: number; dy: number; dz: number },
  others: readonly { x: number; y: number }[],
  min = SPLIT_SEPARATION,
): { x: number; y: number; z: number } {
  let x = parent.x + offset.dx;
  let y = parent.y + Math.max(0, offset.dy);
  const limit = PLAYFIELD_HALF * 2.2;
  for (let pass = 0; pass < 8; pass++) {
    x = Math.max(-limit, Math.min(limit, x));
    for (const o of others) {
      const dx = x - o.x;
      const dy = y - o.y;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 1e-4) {
        y += min;
        continue;
      }
      const push = min - d;
      const nx = dx / d;
      const ny = dy / d;
      let nextX = x + nx * push;
      let nextY = y + (ny > 0 ? ny * push : 0);
      const clampedX = Math.max(-limit, Math.min(limit, nextX));
      // A side wall ate the sideways push, so lift the shard instead of stacking it.
      if (ny <= 0 && Math.abs(clampedX - x) < push * 0.55) nextY += push;
      x = clampedX;
      y = Math.max(parent.y, nextY);
      const left = Math.hypot(x - o.x, y - o.y);
      if (left < min) y += min - left;
    }
  }
  if (y < parent.y) y = parent.y;
  x = Math.max(-limit, Math.min(limit, x));
  return { x, y, z: parent.z + offset.dz };
}

/**
 * Local Z pitch so a barrel aims at world offset (dx, dy).
 * The painted barrel rests up-right. `flip` is -1 on the mirrored left mount,
 * so dx is converted into that mount's local frame.
 * Positive Z rotation decreases atan2(localX, localY), so pitch is rest − want.
 */
export function barrelPitch(
  muzzleLocalX: number,
  muzzleLocalY: number,
  dx: number,
  dy: number,
  flip: number,
): number {
  const rest = Math.atan2(muzzleLocalX, Math.max(0.05, muzzleLocalY));
  const want = Math.atan2(dx * flip, Math.max(0.2, dy));
  return Math.max(-1.2, Math.min(1.2, rest - want));
}
