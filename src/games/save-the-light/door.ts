import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { disc, rect } from "./shapes";

const PANEL_WIDTH = 0.54;

/** Simple wooden exit door with warm light leaking from under it; swings open on `open()`. */
export class Door {
  readonly root: TransformNode;
  private readonly hinge: TransformNode;
  private readonly glow: Mesh;
  private openness = 0;
  private target = 0;

  constructor(scene: Scene) {
    this.root = new TransformNode("door", scene);
    const r = this.root;
    this.glow = disc(scene, "door-glow", 0.5, "#ffe39a", { parent: r, y: -0.1, z: 0.62, alpha: 0.28 });
    rect(scene, "door-frame", 0.7, 0.86, "#8a5a36", { parent: r, y: 0.02, z: 0.6 });
    rect(scene, "door-opening", PANEL_WIDTH, 0.76, "#fff1c2", { parent: r, y: -0.01, z: 0.59 });
    rect(scene, "door-sill", 0.62, 0.05, "#ffd36b", { parent: r, y: -0.39, z: 0.585 });

    // Panel is parented to a hinge on its left edge so it can swing (squash towards the hinge).
    this.hinge = new TransformNode("door-hinge", scene);
    this.hinge.parent = r;
    this.hinge.position.set(-PANEL_WIDTH / 2, -0.01, 0);
    const p = { parent: this.hinge };
    rect(scene, "door-panel", PANEL_WIDTH, 0.76, "#c98b4f", { ...p, x: PANEL_WIDTH / 2, z: 0.58 });
    rect(scene, "door-inset-top", 0.36, 0.24, "#b77a42", { ...p, x: PANEL_WIDTH / 2, y: 0.17, z: 0.575 });
    rect(scene, "door-inset-bottom", 0.36, 0.24, "#b77a42", { ...p, x: PANEL_WIDTH / 2, y: -0.17, z: 0.575 });
    disc(scene, "door-knob", 0.04, "#ffd24d", { ...p, x: PANEL_WIDTH - 0.08, y: -0.02, z: 0.57 });
  }

  setPosition(x: number, y: number): void {
    this.root.position.set(x, y, 0);
    this.openness = 0;
    this.target = 0;
  }

  open(): void {
    this.target = 1;
  }

  update(dt: number, time: number): void {
    this.openness += (this.target - this.openness) * Math.min(1, dt * 6);
    this.hinge.scaling.x = 1 - this.openness * 0.8;
    const pulse = 1 + 0.12 * Math.sin(time * 3) + this.openness * 0.4;
    this.glow.scaling.set(pulse, pulse, 1);
  }
}
