import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/math/rng";
import {
  FRUSTUM_MARGIN,
  barrelPitch,
  frustumAtPlane,
  isInsideFrustum,
  pickApproachSpawn,
  splitRingOffsets,
} from "../src/games/look-up/spawn";

const CAMERA = { distance: 17.5, fov: 0.78, centerY: 6.4 };
/** Largest rock centre-to-edge, including the selected-scale bump. */
const ROCK_RADIUS = 1.35;

describe("look-up spawn", () => {
  it("keeps every approach just outside the live frustum", () => {
    for (const aspect of [1, 1.25, 1.77, 2.1]) {
      const frustum = frustumAtPlane(CAMERA.distance, CAMERA.fov, aspect, CAMERA.centerY);
      const rng = createRng(11 + Math.round(aspect * 10));
      for (let i = 0; i < 240; i++) {
        const p = pickApproachSpawn(rng, frustum);
        expect(isInsideFrustum(p, frustum)).toBe(false);
        const outsideX = Math.abs(p.x) > frustum.halfW + ROCK_RADIUS;
        const outsideY = Math.abs(p.y - frustum.centerY) > frustum.halfH + ROCK_RADIUS;
        expect(outsideX || outsideY).toBe(true);
        const dx = Math.max(0, Math.abs(p.x) - frustum.halfW);
        const dy = Math.max(0, Math.abs(p.y - frustum.centerY) - frustum.halfH);
        expect(Math.max(dx, dy)).toBeLessThan(FRUSTUM_MARGIN + 0.85);
      }
    }
  });

  it("spreads split shards around the parent", () => {
    const ring = splitRingOffsets(4, createRng(3), 2.15);
    expect(ring).toHaveLength(4);
    for (let i = 0; i < ring.length; i++) {
      for (let j = i + 1; j < ring.length; j++) {
        const d = Math.hypot(ring[i].dx - ring[j].dx, ring[i].dy - ring[j].dy);
        expect(d).toBeGreaterThan(0.7);
      }
    }
    const xs = ring.map((p) => p.dx);
    const ys = ring.map((p) => p.dy);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.4);
  });

  it("pitches each barrel toward the target", () => {
    // Rest pose points up-right. +pitch swings that muzzle toward up / left.
    expect(barrelPitch(0.45, 0.55, -6, 1, 1)).toBeGreaterThan(0);
    expect(barrelPitch(0.45, 0.55, 6, 1, 1)).toBeLessThan(0);
    // Left mount is mirrored, so the same world offsets flip the local pitch.
    expect(barrelPitch(0.45, 0.55, 6, 1, -1)).toBeGreaterThan(0);
    expect(barrelPitch(0.45, 0.55, -6, 1, -1)).toBeLessThan(0);
  });
});
