/** Pure Look UP playfield geometry (no Babylon), shared by the runtime and tests. */

/** Half-width of the play lane (world X). */
export const PLAYFIELD_HALF = 5.2;
/**
 * World Y where rocks meet the station. The deck billboard is placed so its
 * top metal lip sits on this line and the rest of the hull falls below the view.
 */
export const IMPACT_Y = 1.65;
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

/** Clamp a split shard's lane X to the play column. */
export function spawnAbove(laneX: number, height: number, depth = 0): { x: number; y: number; z: number } {
  return {
    x: Math.max(-PLAYFIELD_HALF, Math.min(PLAYFIELD_HALF, laneX)),
    y: height,
    z: depth,
  };
}

/** Place split shards on a circle around the parent with generous spacing. */
export function splitRingOffsets(
  count: number,
  rng: { next(): number },
  radius = 1.85,
): { dx: number; dy: number; dz: number }[] {
  const n = Math.max(1, count);
  const base = rng.next() * Math.PI * 2;
  return Array.from({ length: n }, (_, i) => {
    const ang = base + (i * Math.PI * 2) / n + (rng.next() - 0.5) * 0.35;
    const r = radius * (0.85 + rng.next() * 0.35);
    return {
      dx: Math.cos(ang) * r,
      dy: Math.sin(ang) * r * 0.55,
      dz: Math.sin(ang * 1.3) * 0.25,
    };
  });
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
