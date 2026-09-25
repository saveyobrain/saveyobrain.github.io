import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/** Unlit single-color material; the look is flat 2D shapes. */
export function flatMaterial(scene: Scene, name: string, hex: string, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.emissiveColor = Color3.FromHexString(hex);
  m.backFaceCulling = false;
  m.alpha = alpha;
  return m;
}

export interface ShapeOptions {
  parent: TransformNode;
  x?: number;
  y?: number;
  /** Smaller z is closer to the camera, i.e. drawn on top. */
  z: number;
  alpha?: number;
}

function place(mesh: Mesh, scene: Scene, hex: string, o: ShapeOptions): Mesh {
  mesh.material = flatMaterial(scene, `${mesh.name}-mat`, hex, o.alpha);
  mesh.parent = o.parent;
  mesh.position.set(o.x ?? 0, o.y ?? 0, o.z);
  mesh.isPickable = false;
  return mesh;
}

/** Circle, or a partial circle when `arc` < 1 (0.5 = upper half). */
export function disc(scene: Scene, name: string, radius: number, hex: string, o: ShapeOptions, arc = 1): Mesh {
  return place(CreateDisc(name, { radius, tessellation: 40, arc }, scene), scene, hex, o);
}

export function rect(scene: Scene, name: string, width: number, height: number, hex: string, o: ShapeOptions): Mesh {
  return place(CreatePlane(name, { width, height }, scene), scene, hex, o);
}
