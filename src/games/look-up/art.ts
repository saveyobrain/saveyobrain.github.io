/** Look UP station / turret art kits (public/games/look-up/art). */

export type StationTier = 1 | 2 | 3;

export interface TierArtKit {
  /** Cropped/brightened deck plate JPG (hardpoints, no sky). GPU-sized. */
  deck: string;
  basePivot: string;
  barrel: string;
  /** Deck plate pixel aspect (width/height) — keep plane undistorted. */
  deckAspect: number;
  /** Hardpoint centers in deck UV (0..1). */
  hardpoints: readonly [{ u: number; v: number }, { u: number; v: number }];
  /** Cradle hinge holes on the base-pivot PNG (UV 0..1). */
  baseHingeU: number;
  baseHingeV: number;
  /** Barrel rear-hinge in texture UV (0..1). */
  hingeU: number;
  hingeV: number;
  /** Barrel muzzle tip in texture UV (0..1). */
  tipU: number;
  tipV: number;
  /**
   * World size of square turret planes. Readable over exact ring fit —
   * opaque disc ≈ 0.55 of the PNG canvas.
   */
  turretSize: number;
}

function artUrl(file: string): string {
  return `${import.meta.env.BASE_URL}games/look-up/art/${file}`;
}

/** Resolve a file under public/games/look-up/art/. */
export function lookUpArtUrl(file: string): string {
  return artUrl(file);
}

/**
 * Every tier uses the tier-1 plate. Tier 2 and 3 plates have turrets painted
 * into the image, so swapping those decks stacks a second pair on the live sprites.
 */
const DECK_PLATE = artUrl("deck-plate-tier-1.jpg");

/** Shared hardpoint UVs measured on deck-plate-tier-1 (768×252). */
const HARDPOINTS = [
  { u: 0.38, v: 0.468 },
  { u: 0.632, v: 0.47 },
] as const;

/**
 * Tier kits. Deck/turret files are GPU-downscaled (≈768×252 / 512²).
 * Hardpoints are UV-locked to the plate; hinge UVs aim the barrel layer.
 */
export const TIER_KITS: Record<StationTier, TierArtKit> = {
  1: {
    deck: DECK_PLATE,
    basePivot: artUrl("turret-tier-1-base-pivot.png"),
    barrel: artUrl("turret-tier-1-barrel.png"),
    deckAspect: 768 / 252,
    hardpoints: HARDPOINTS,
    baseHingeU: 0.53,
    baseHingeV: 0.43,
    hingeU: 0.37,
    hingeV: 0.55,
    tipU: 0.69,
    tipV: 0.32,
    turretSize: 2.4,
  },
  2: {
    deck: DECK_PLATE,
    basePivot: artUrl("turret-tier-2-base-pivot.png"),
    barrel: artUrl("turret-tier-2-barrel.png"),
    deckAspect: 768 / 252,
    hardpoints: HARDPOINTS,
    baseHingeU: 0.5,
    baseHingeV: 0.36,
    // This barrel is painted up-left, opposite of tier 1. Pivot at the rear (lower right).
    hingeU: 0.76,
    hingeV: 0.57,
    tipU: 0.27,
    tipV: 0.3,
    turretSize: 2.55,
  },
  3: {
    deck: DECK_PLATE,
    basePivot: artUrl("turret-tier-3-base-pivot.png"),
    barrel: artUrl("turret-tier-3-barrel.png"),
    deckAspect: 768 / 252,
    hardpoints: HARDPOINTS,
    baseHingeU: 0.49,
    baseHingeV: 0.37,
    hingeU: 0.25,
    hingeV: 0.69,
    tipU: 0.76,
    tipV: 0.27,
    turretSize: 2.7,
  },
};

/** Stub upgrade mapping until an economy exists — higher waves unlock flashier kits. */
export function tierForWave(wave: number): StationTier {
  if (wave >= 8) return 3;
  if (wave >= 4) return 2;
  return 1;
}
