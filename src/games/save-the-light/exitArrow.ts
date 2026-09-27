import type { Scene } from "@babylonjs/core/scene";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

const TEX_SIZE = 128;
/** How far from the player (in tiles) the arrow sits, along the exit direction. */
const OFFSET = 1.15;
const ARROW_SIZE = 0.85;

/** Unlit exit compass: a clear arrow/cursor offset from the player. */
export class ExitArrow {
  readonly root: TransformNode;
  private visible = false;

  constructor(scene: Scene) {
    this.root = new TransformNode("exit-arrow", scene);
    this.root.setEnabled(false);

    const tex = new DynamicTexture(
      "exit-arrow-tex",
      { width: TEX_SIZE, height: TEX_SIZE },
      scene,
      false,
      Texture.BILINEAR_SAMPLINGMODE,
    );
    tex.hasAlpha = true;
    drawCursorArrow(tex.getContext() as unknown as CanvasRenderingContext2D, TEX_SIZE);
    tex.update();

    const mat = new StandardMaterial("exit-arrow-mat", scene);
    mat.disableLighting = true;
    mat.emissiveTexture = tex;
    mat.opacityTexture = tex;
    mat.backFaceCulling = false;
    mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;

    const plane = CreatePlane("exit-arrow-plane", { width: ARROW_SIZE, height: ARROW_SIZE }, scene);
    plane.material = mat;
    plane.parent = this.root;
    plane.position.set(0, 0, -0.05);
    plane.isPickable = false;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.root.setEnabled(on);
  }

  /** Sit ahead of the player, rotated so the tip aims at the exit (tile coords). */
  update(player: { x: number; y: number }, exit: { x: number; y: number }): void {
    if (!this.visible) return;
    const bx = exit.x - player.x;
    const by = player.y - exit.y; // babylon Y is flipped vs tile Y
    const len = Math.hypot(bx, by);
    if (len < 1e-6) {
      this.root.position.set(player.x, -player.y + OFFSET, -0.1);
      this.root.rotation.z = 0;
      return;
    }
    const nx = bx / len;
    const ny = by / len;
    this.root.position.set(player.x + nx * OFFSET, -player.y + ny * OFFSET, -0.1);
    this.root.rotation.z = Math.atan2(by, bx) - Math.PI / 2;
  }
}

/** Mouse-cursor style arrow pointing up (local +Y). */
function drawCursorArrow(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.clearRect(0, 0, size, size);
  const s = size;
  // Tip at top-center; classic pointer silhouette.
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.08);
  ctx.lineTo(s * 0.82, s * 0.55);
  ctx.lineTo(s * 0.62, s * 0.55);
  ctx.lineTo(s * 0.7, s * 0.9);
  ctx.lineTo(s * 0.5, s * 0.78);
  ctx.lineTo(s * 0.3, s * 0.9);
  ctx.lineTo(s * 0.38, s * 0.55);
  ctx.lineTo(s * 0.18, s * 0.55);
  ctx.closePath();

  ctx.fillStyle = "#ffd24a";
  ctx.fill();
  ctx.strokeStyle = "#7a4a00";
  ctx.lineWidth = Math.max(3, s * 0.035);
  ctx.lineJoin = "round";
  ctx.stroke();
}
