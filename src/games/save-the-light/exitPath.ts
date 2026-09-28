import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { rect } from "./shapes";
import { findPath, type Maze, type Tile } from "./maze";

const DASH_COLOR = "#3dcc6e";
const DASH_LENGTH = 0.42;
const DASH_WIDTH = 0.12;
/** Keep dashes clear of the character sprite (tile units). */
const MIN_PLAYER_DIST = 0.6;
const MAX_DASHES = 256;

interface DashPose {
  x: number;
  y: number;
  angle: number;
}

/** World-anchored dashed trail along the shortest walkable path to the exit. */
export class ExitPath {
  readonly root: TransformNode;
  private readonly dashes: Mesh[] = [];
  private readonly mats: StandardMaterial[] = [];
  private visible = false;

  constructor(private readonly scene: Scene) {
    this.root = new TransformNode("exit-path", scene);
    this.root.setEnabled(false);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.root.setEnabled(on);
    if (!on) this.hideAll();
  }

  /**
   * Place dashes on fixed midpoints between path tiles. As the player approaches,
   * nearby dashes hide — they do not slide along the route.
   */
  update(maze: Maze, player: { x: number; y: number }, fromTile: Tile, exit: Tile, time: number): void {
    if (!this.visible) return;

    const path = findPath(maze, fromTile, exit);
    const nodes: Tile[] = path && path.length ? [fromTile, ...path] : [fromTile, exit];
    const poses = dashesAlongTiles(nodes, player, MIN_PLAYER_DIST);
    this.placeDashes(poses, time);
  }

  private placeDashes(poses: DashPose[], time: number): void {
    const n = Math.min(poses.length, MAX_DASHES);
    this.ensureDashes(n);
    const pulse = 0.75 + 0.25 * Math.sin(time * 4);

    for (let i = 0; i < this.dashes.length; i++) {
      if (i < n) {
        const p = poses[i];
        const mesh = this.dashes[i];
        mesh.setEnabled(true);
        mesh.position.set(p.x, -p.y, -0.08);
        mesh.rotation.z = p.angle;
        this.mats[i].alpha = 0.55 + 0.35 * pulse;
      } else {
        this.dashes[i].setEnabled(false);
      }
    }
  }

  private ensureDashes(count: number): void {
    while (this.dashes.length < count) {
      const i = this.dashes.length;
      // Local +Y is the dash length; rotated to follow each corridor step.
      const mesh = rect(this.scene, `exit-path-dash-${i}`, DASH_WIDTH, DASH_LENGTH, DASH_COLOR, {
        parent: this.root,
        z: -0.08,
        alpha: 0.8,
      });
      this.dashes.push(mesh);
      this.mats.push(mesh.material as StandardMaterial);
    }
  }

  private hideAll(): void {
    for (const d of this.dashes) d.setEnabled(false);
  }
}

/** One dash per corridor step, centered on the segment, culled near the player. */
function dashesAlongTiles(
  nodes: Tile[],
  player: { x: number; y: number },
  minDist: number,
): DashPose[] {
  const out: DashPose[] = [];
  const minDistSq = minDist * minDist;

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = mx - player.x;
    const dy = my - player.y;
    if (dx * dx + dy * dy < minDistSq) continue;

    const bx = b.x - a.x;
    const by = b.y - a.y;
    // Babylon Y is flipped vs tile Y; local +Y of the rect follows the step.
    const angle = Math.atan2(-by, bx) - Math.PI / 2;
    out.push({ x: mx, y: my, angle });
    if (out.length >= MAX_DASHES) break;
  }
  return out;
}
