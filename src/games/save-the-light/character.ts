import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { disc, rect } from "./shapes";

const SKIN = "#ffd4ad";
const HAIR = "#7a4a2a";
const SHIRT = "#4f86ec";
const PANTS = "#3b3a5c";
const INK = "#2e2940";

/** Front-facing little explorer holding a candle; drawn from flat shapes. */
export class Character {
  readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly legs: Mesh[];
  private readonly flame: Mesh;
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

    // Candle held in the front hand.
    const cx = 0.25;
    rect(scene, "char-candle-outline", 0.1, 0.19, "#c9a57a", { parent: b, x: cx, y: -0.03, z: 0.195 });
    rect(scene, "char-candle", 0.07, 0.165, "#ffffff", { parent: b, x: cx, y: -0.03, z: 0.19 });
    rect(scene, "char-candle-holder", 0.15, 0.035, "#c98b4f", { parent: b, x: cx, y: -0.12, z: 0.185 });
    disc(scene, "char-hand", 0.05, SKIN, { parent: b, x: cx, y: -0.145, z: 0.18 });
    this.flame = disc(scene, "char-flame", 0.065, "#ff9d2e", { parent: b, x: cx, y: 0.1, z: 0.175 });
    this.flame.scaling.y = 1.4;
    disc(scene, "char-flame-core", 0.032, "#ffe066", { parent: this.flame, y: -0.012, z: -0.005 });
  }

  update(dt: number, time: number, moving: boolean, facing: number, warmth: number): void {
    if (facing !== 0) this.facing = facing;
    this.root.scaling.x = this.facing;

    this.walkPhase = moving ? this.walkPhase + dt * 14 : 0;
    const step = Math.sin(this.walkPhase);
    this.body.position.y = moving ? Math.abs(step) * 0.035 : 0;
    this.legs[0].position.y = -0.3 + (moving ? Math.max(0, step) * 0.04 : 0);
    this.legs[1].position.y = -0.3 + (moving ? Math.max(0, -step) * 0.04 : 0);

    const flicker = 1 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
    const grow = 1 + warmth * 0.5;
    this.flame.scaling.set(flicker * grow, (flicker + 0.4) * grow, 1);
  }
}
