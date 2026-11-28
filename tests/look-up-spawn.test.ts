import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/math/rng";
import {
  APPROACH_FAST,
  APPROACH_FAST_DIST,
  APPROACH_SLOW,
  APPROACH_SLOW_DIST,
  FRUSTUM_MARGIN,
  MIN_SEPARATION,
  SPLIT_SEPARATION,
  approachSpeedScale,
  barrelPitch,
  frustumAtPlane,
  isInsideFrustum,
  pickApproachSpawn,
  pickSeparatedApproach,
  placeAroundBreak,
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
    expect(ys.every((y) => y >= 0)).toBe(true);
  });

  it("keeps shards at or above the break and clear of each other", () => {
    const parent = { x: 0.4, y: 6.2, z: 0 };
    const ring = splitRingOffsets(5, createRng(9));
    const placed: { x: number; y: number }[] = [{ x: parent.x, y: parent.y }];
    const shards = ring.map((off) => {
      const p = placeAroundBreak(parent, off, placed);
      placed.push(p);
      return p;
    });
    for (const p of shards) expect(p.y).toBeGreaterThanOrEqual(parent.y);
    for (let i = 0; i < shards.length; i++) {
      for (let j = i + 1; j < shards.length; j++) {
        expect(Math.hypot(shards[i].x - shards[j].x, shards[i].y - shards[j].y)).toBeGreaterThanOrEqual(
          MIN_SEPARATION - 0.05,
        );
      }
    }
  });

  it("keeps a 36 split by 3, 4, or 6 from stacking", () => {
    // 36 ÷ 3, 36 ÷ 4, and 36 ÷ 6 are the overlaps that matter: 3, 4, or 6 shards, not 12.
    for (const count of [3, 4, 6]) {
      for (const seed of [1, 4, 9, 12]) {
        for (const parent of [
          { x: 0, y: 8, z: 0 },
          { x: 4.2, y: 7, z: 0 },
          { x: -4.2, y: 9, z: 0 },
        ]) {
          const ring = splitRingOffsets(count, createRng(seed + count * 10));
          const placed: { x: number; y: number }[] = [{ x: parent.x, y: parent.y }];
          const shards = ring.map((off) => {
            const p = placeAroundBreak(parent, off, placed);
            placed.push(p);
            return p;
          });
          for (const p of shards) expect(p.y).toBeGreaterThanOrEqual(parent.y);
          for (let i = 0; i < shards.length; i++) {
            for (let j = i + 1; j < shards.length; j++) {
              expect(Math.hypot(shards[i].x - shards[j].x, shards[i].y - shards[j].y)).toBeGreaterThanOrEqual(
                SPLIT_SEPARATION - 0.05,
              );
            }
          }
        }
      }
    }
  });

  it("keeps a clean-break burst of primes next to the parent", () => {
    // 12 burning children (24 ÷ 12). They die in a fraction of a second, so they
    // use a tight ring instead of the shard separation that would park them off screen.
    for (const parent of [
      { x: 0, y: 6, z: 0 },
      { x: 3.5, y: 8, z: 0 },
      { x: -3.5, y: 5, z: 0 },
    ]) {
      const ring = splitRingOffsets(12, createRng(4), 2.5);
      const placed: { x: number; y: number }[] = [{ x: parent.x, y: parent.y }];
      const shards = ring.map((off) => {
        const p = placeAroundBreak(parent, off, placed, 1.2);
        placed.push(p);
        return p;
      });
      for (const p of shards) {
        expect(p.y).toBeGreaterThanOrEqual(parent.y);
        expect(Math.hypot(p.x - parent.x, p.y - parent.y)).toBeLessThan(7.5);
      }
    }
  });

  it("does not drop a new approach on top of a rock already in play", () => {
    const frustum = frustumAtPlane(CAMERA.distance, CAMERA.fov, 1.6, CAMERA.centerY);
    const occupied = [
      { x: 0, y: frustum.centerY + frustum.halfH + FRUSTUM_MARGIN, targetX: 0 },
      { x: -4, y: 8, targetX: -2 },
    ];
    const rng = createRng(21);
    for (let i = 0; i < 40; i++) {
      const p = pickSeparatedApproach(rng, frustum, occupied);
      for (const o of occupied) {
        expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThanOrEqual(MIN_SEPARATION - 0.01);
        expect(Math.abs(p.targetX - o.targetX)).toBeGreaterThanOrEqual(1.15 - 0.01);
      }
    }
  });

  it("falls a bit faster far away and eases down near the station", () => {
    expect(approachSpeedScale(APPROACH_FAST_DIST + 4)).toBe(APPROACH_FAST);
    expect(approachSpeedScale(APPROACH_FAST_DIST)).toBe(APPROACH_FAST);
    expect(approachSpeedScale(APPROACH_SLOW_DIST)).toBe(APPROACH_SLOW);
    expect(approachSpeedScale(0)).toBe(APPROACH_SLOW);
    expect(APPROACH_FAST).toBeGreaterThan(1);
    expect(APPROACH_FAST).toBeLessThan(1.8);
    expect(APPROACH_SLOW).toBeLessThan(1);
    const mid = (APPROACH_FAST_DIST + APPROACH_SLOW_DIST) / 2;
    const atMid = approachSpeedScale(mid);
    expect(atMid).toBeGreaterThan(APPROACH_SLOW);
    expect(atMid).toBeLessThan(APPROACH_FAST);
    expect(approachSpeedScale(mid + 1)).toBeGreaterThan(atMid);
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
