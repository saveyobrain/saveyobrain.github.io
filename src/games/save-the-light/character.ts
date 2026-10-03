import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { disc, rect } from "./shapes";

const SKIN = "#ffd4ad";
const HAIR = "#7a4a2a";
const SHIRT = "#4f86ec";
const PANTS = "#3b3a5c";
const INK = "#2e2940";

const FLAME_BRIGHT = "#ffb84d";
const FLAME_CORE_BRIGHT = "#ffe566";
const FLAME_MID = "#ff9d2e";
const FLAME_CORE_MID = "#ffe066";
const FLAME_DIM = "#d47820";
const FLAME_CORE_DIM = "#e8b050";
const FLAME_LOW = "#8a5a30";
const FLAME_CORE_LOW = "#a87840";

interface CandleBand {
  waxScale: number;
  flameScale: number;
  flame: string;
  core: string;
}

function bandForFuel(fuel: number): CandleBand {
  if (fuel >= 0.75) return { waxScale: 1.15, flameScale: 1.2, flame: FLAME_BRIGHT, core: FLAME_CORE_BRIGHT };
  if (fuel >= 0.5) return { waxScale: 1, flameScale: 1, flame: FLAME_MID, core: FLAME_CORE_MID };
  if (fuel >= 0.25) return { waxScale: 0.85, flameScale: 0.8, flame: FLAME_DIM, core: FLAME_CORE_DIM };
  return { waxScale: 0.55, flameScale: 0.5, flame: FLAME_LOW, core: FLAME_CORE_LOW };
}

/** Front-facing little explorer holding a candle; drawn from flat shapes. */
export class Character {
  readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly legs: Mesh[];
  private readonly candleRoot: TransformNode;
  private readonly flame: Mesh;
  private readonly flameCore: Mesh;
  private readonly flameMat: StandardMaterial;
  private readonly flameCoreMat: StandardMaterial;
  private readonly baseFlameY: number;
  private walkPhase = 0;
  private facing = 1;

  constructor(scene: Scene) {
    this.root = new TransformNode("character", scene);
    disc(scene, "char-shadow", 0.24, "#5a4a30", { parent: this.root, y: -0.36, z: 0.3, alpha: 0.18 }).scaling.y = 0.35;

    this.body = new TransformNode("char-body", scene);
    this.body.parent = this.root;
    const b = this.body;

    this.legs = [
      rect(scene, "char-leg-l", 0.09, 0.14, PANTS, { parent: b, x: -0.075, y: -0.3, z: 0.26 }),
      rect(scene, "char-leg-r", 0.09, 0.14, PANTS, { parent: b, x: 0.075, y: -0.3, z: 0.26 }),
    ];
    const torso = disc(scene, "char-torso", 0.19, SHIRT, { parent: b, y: -0.12, z: 0.24 });
    torso.scaling.set(1.05, 0.95, 1);
    disc(scene, "char-hand-back", 0.05, SKIN, { parent: b, x: -0.19, y: -0.14, z: 0.235 });

    disc(scene, "char-head", 0.19, SKIN, { parent: b, y: 0.14, z: 0.22 });
    disc(scene, "char-hair", 0.2, HAIR, { parent: b, y: 0.17, z: 0.21 }, 0.5);
    disc(scene, "char-eye-l", 0.027, INK, { parent: b, x: -0.065, y: 0.11, z: 0.2 });
    disc(scene, "char-eye-r", 0.027, INK, { parent: b, x: 0.065, y: 0.11, z: 0.2 });
    disc(scene, "char-cheek-l", 0.03, "#ff9d9d", { parent: b, x: -0.11, y: 0.05, z: 0.205, alpha: 0.7 });
    disc(scene, "char-cheek-r", 0.03, "#ff9d9d", { parent: b, x: 0.11, y: 0.05, z: 0.205, alpha: 0.7 });

    // Candle held in the front hand (scaled as a group by fuel band).
    const cx = 0.25;
    this.candleRoot = new TransformNode("char-candle-root", scene);
    this.candleRoot.parent = b;
    this.candleRoot.position.set(cx, -0.03, 0.19);

    rect(scene, "char-candle-outline", 0.1, 0.19, "#c9a57a", {
      parent: this.candleRoot,
      z: 0.005,
    });
    rect(scene, "char-candle", 0.07, 0.165, "#ffffff", { parent: this.candleRoot, z: 0 });
    rect(scene, "char-candle-holder", 0.15, 0.035, "#c98b4f", {
      parent: this.candleRoot,
      y: -0.09,
      z: -0.005,
    });
    disc(scene, "char-hand", 0.05, SKIN, { parent: b, x: cx, y: -0.145, z: 0.18 });

    this.baseFlameY = 0.13;
    this.flame = disc(scene, "char-flame", 0.065, FLAME_MID, {
      parent: this.candleRoot,
      y: this.baseFlameY,
      z: -0.015,
    });
    this.flame.scaling.y = 1.4;
    this.flameCore = disc(scene, "char-flame-core", 0.032, FLAME_CORE_MID, {
      parent: this.flame,
      y: -0.012,
      z: -0.005,
    });
    this.flameMat = this.flame.material as StandardMaterial;
    this.flameCoreMat = this.flameCore.material as StandardMaterial;
  }

  update(dt: number, time: number, moving: boolean, facing: number, warmth: number, fuel = 1): void {
    if (facing !== 0) this.facing = facing;
    this.root.scaling.x = this.facing;

    this.walkPhase = moving ? this.walkPhase + dt * 14 : 0;
    const step = Math.sin(this.walkPhase);
    this.body.position.y = moving ? Math.abs(step) * 0.035 : 0;
    this.legs[0].position.y = -0.3 + (moving ? Math.max(0, step) * 0.04 : 0);
    this.legs[1].position.y = -0.3 + (moving ? Math.max(0, -step) * 0.04 : 0);

    const band = bandForFuel(fuel);
    this.candleRoot.scaling.set(band.waxScale, band.waxScale, 1);
    // Keep flame tip near the top of the (scaled) wax.
    this.flame.position.y = this.baseFlameY * (0.85 + 0.15 * band.waxScale);

    const flicker = 1 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
    const grow = 1 + warmth * 0.5;
    const fs = band.flameScale * flicker * grow;
    this.flame.scaling.set(fs, (flicker + 0.4) * band.flameScale * grow, 1);
    this.flameMat.emissiveColor = Color3.FromHexString(band.flame);
    this.flameCoreMat.emissiveColor = Color3.FromHexString(band.core);
  }
}
