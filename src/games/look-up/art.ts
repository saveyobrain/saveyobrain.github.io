/** Look UP station / turret art kits (public/games/look-up/art). */

export type StationTier = 1 | 2 | 3;

export interface TierArtKit {
  /** Cropped/brightened deck plate JPG (hardpoints, no sky). */
  deck: string;
  basePivot: string;
  barrel: string;
  /** Cradle hinge holes on the base-pivot PNG (UV 0..1). */
  baseHingeU: number;
  baseHingeV: number;
  /** Barrel rear-hinge in texture UV (0..1). */
  hingeU: number;
  hingeV: number;
  /** Barrel muzzle tip in texture UV (0..1). */
  tipU: number;
  tipV: number;
  /** World size of the square turret layer planes. */
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
 * Tier kits. Deck plates are bottom-cropped + brightened from the concepts.
 * Hinge/tip UVs aim the barrel layer about the rear hinge.
 */
export const TIER_KITS: Record<StationTier, TierArtKit> = {
  1: {
    deck: artUrl("deck-plate-tier-1.jpg"),
    basePivot: artUrl("turret-tier-1-base-pivot.png"),
    barrel: artUrl("turret-tier-1-barrel.png"),
    baseHingeU: 0.53,
    baseHingeV: 0.43,
    // Rear hinge ≈ lower-left of the barrel sprite; tip ≈ upper-right.
    hingeU: 0.4,
    hingeV: 0.58,
    tipU: 0.7,
    tipV: 0.36,
    turretSize: 2.7,
  },
  2: {
    deck: artUrl("deck-plate-tier-2.jpg"),
    basePivot: artUrl("turret-tier-2-base-pivot.png"),
    barrel: artUrl("turret-tier-2-barrel.png"),
    baseHingeU: 0.52,
    baseHingeV: 0.42,
    hingeU: 0.45,
    hingeV: 0.55,
    tipU: 0.74,
    tipV: 0.32,
    turretSize: 2.9,
  },
  3: {
    deck: artUrl("deck-plate-tier-3.jpg"),
    basePivot: artUrl("turret-tier-3-base-pivot.png"),
    barrel: artUrl("turret-tier-3-barrel.png"),
    baseHingeU: 0.5,
    baseHingeV: 0.4,
    hingeU: 0.38,
    hingeV: 0.6,
    tipU: 0.76,
    tipV: 0.3,
    turretSize: 3.15,
  },
};

/** Stub upgrade mapping until an economy exists — higher waves unlock flashier kits. */
export function tierForWave(wave: number): StationTier {
  if (wave >= 8) return 3;
  if (wave >= 4) return 2;
  return 1;
}
