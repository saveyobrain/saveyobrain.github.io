import type { Scene } from "@babylonjs/core/scene";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreateIcoSphere } from "@babylonjs/core/Meshes/Builders/icoSphereBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";

export type BodyKind = "asteroid" | "bonus";

export interface BodyVisual {
  id: string;
  kind: BodyKind;
  label: number;
  /** World position; station deck is at low Y, threats fall from high Y. */
  x: number;
  y: number;
  z: number;
  selected?: boolean;
  burning?: boolean;
  hitFlash?: number;
}

export interface ShotVisual {
  id: string;
  from: Vector3;
  to: Vector3;
  life: number;
  maxLife: number;
  success: boolean;
}

interface BodyMesh {
  root: Mesh;
  labelPlane: Mesh;
  texture: DynamicTexture;
  label: number;
  kind: BodyKind;
  selected: boolean;
  baseDiffuse: Color3;
  baseEmissive: Color3;
}

interface CannonRig {
  x: number;
  pivot: TransformNode;
  barrel: Mesh;
  muzzle: Mesh;
}

/** Half-width of the play lane (world X). */
export const PLAYFIELD_HALF = 5.2;
/** Y of the station deck top. */
export const STATION_DECK_Y = 0.4;
/** Asteroids hit the station when they reach this height. */
export const IMPACT_Y = 1.7;
/** Just above the camera frustum top (rocks enter from over the horizon). */
export const OFFSCREEN_Y = 15.2;
/** Past the left/right edges of the framed play column. */
export const OFFSCREEN_X = 8.6;

const CANNON_X = [-2.6, 2.6] as const;
const BARREL_LEN = 1.05;

function litMat(scene: Scene, name: string, diffuse: Color3, emissive: Color3, specular = 0.35): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = diffuse;
  m.emissiveColor = emissive;
  m.specularColor = new Color3(specular, specular * 0.9, specular * 0.8);
  return m;
}

function glowMat(scene: Scene, name: string, color: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = color;
  m.disableLighting = true;
  return m;
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Displace an icosphere into a lumpy rock; returns flat-shaded mesh. */
function createRockyMesh(scene: Scene, name: string, seed: number, radius: number): Mesh {
  const mesh = CreateIcoSphere(name, { radius, subdivisions: 2, flat: true }, scene);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) return mesh;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const n =
      hash01(seed + x * 12.3 + y * 7.1 + z * 5.9) * 0.55 +
      hash01(seed * 1.7 + x * 3.1 - y * 8.4 + z * 2.2) * 0.35 +
      hash01(seed * 3.3 - x * 6.2 + y * 1.9 + z * 9.5) * 0.25;
    const s = 0.72 + n * 0.55;
    // Stretch slightly so it doesn't read as a pool ball.
    positions[i] = x * s * (0.9 + hash01(seed + i) * 0.25);
    positions[i + 1] = y * s * (0.85 + hash01(seed + i + 1) * 0.3);
    positions[i + 2] = z * s * (0.95 + hash01(seed + i + 2) * 0.2);
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  mesh.convertToFlatShadedMesh();
  mesh.refreshBoundingInfo();
  return mesh;
}

function rockPalette(seed: number): { diffuse: Color3; emissive: Color3 } {
  const t = hash01(seed);
  // Greys / dusty browns — not toy orange spheres.
  if (t < 0.34) {
    return { diffuse: new Color3(0.45, 0.4, 0.36), emissive: new Color3(0.08, 0.06, 0.05) };
  }
  if (t < 0.67) {
    return { diffuse: new Color3(0.38, 0.34, 0.32), emissive: new Color3(0.06, 0.05, 0.05) };
  }
  return { diffuse: new Color3(0.52, 0.42, 0.3), emissive: new Color3(0.09, 0.06, 0.04) };
}

/**
 * Same boxy slab proportions, but softens the camera-facing corners/edges:
 * larger front vertical fillets, a rounded front-top lip, and corner spheres.
 * Back stays mostly square so we don't redesign the station.
 */
function softFrontSlab(
  scene: Scene,
  name: string,
  width: number,
  height: number,
  depth: number,
  position: Vector3,
  frontR: number,
  mat: StandardMaterial,
): void {
  const r = Math.min(frontR, width * 0.22, depth * 0.5, height * 0.85);
  const core = CreateBox(`${name}Core`, { width: width - 2 * r, height, depth: depth - r * 0.35 }, scene);
  core.position = new Vector3(position.x, position.y, position.z + r * 0.15);
  core.material = mat;

  // Front-left / front-right vertical fillets (the corners you actually see).
  for (const sx of [-1, 1] as const) {
    const post = CreateCylinder(`${name}FrontPost${sx}`, { height, diameter: r * 2 }, scene);
    post.position = new Vector3(position.x + sx * (width / 2 - r), position.y, position.z - (depth / 2 - r));
    post.material = mat;

    // Milder rear posts so the slab isn't a razor table from an angle.
    const rear = CreateCylinder(`${name}RearPost${sx}`, { height, diameter: r * 1.15 }, scene);
    rear.position = new Vector3(position.x + sx * (width / 2 - r * 0.55), position.y, position.z + (depth / 2 - r * 0.55));
    rear.material = mat;

    const side = CreateBox(`${name}Side${sx}`, { width: r * 2, height, depth: depth - 2 * r }, scene);
    side.position = new Vector3(position.x + sx * (width / 2 - r), position.y, position.z);
    side.material = mat;
  }

  // Front-top lip: horizontal cylinder so the deck edge isn't a hard table cut.
  const lip = CreateCylinder(`${name}FrontLip`, { height: width - 2 * r, diameter: Math.min(r * 1.35, height * 1.6) }, scene);
  lip.rotation.z = Math.PI / 2;
  lip.position = new Vector3(position.x, position.y + height / 2 - r * 0.15, position.z - (depth / 2 - r * 0.55));
  lip.material = mat;

  // Spherical blends at the two visible front-top corners.
  for (const sx of [-1, 1] as const) {
    const cap = CreateSphere(`${name}FrontCap${sx}`, { diameter: r * 1.7, segments: 14 }, scene);
    cap.position = new Vector3(
      position.x + sx * (width / 2 - r),
      position.y + height / 2 - r * 0.2,
      position.z - (depth / 2 - r),
    );
    cap.material = mat;
  }
}

/** Front-facing space view: prior boxy station (rounded corners) + aiming cannons. */
export class SpaceView {
  readonly camera: TargetCamera;
  private readonly bodies = new Map<string, BodyMesh>();
  private readonly shots = new Map<string, Mesh>();
  private readonly cannons: CannonRig[] = [];
  private stationShield: Mesh | null = null;
  private time = 0;
  private pulse = 0;
  private aimTarget: Vector3 | null = null;

  constructor(private readonly scene: Scene) {
    scene.clearColor = new Color4(0.015, 0.03, 0.07, 1);

    this.camera = new TargetCamera("cam", new Vector3(0, 6.4, -17.5), scene);
    this.camera.setTarget(new Vector3(0, 6.4, 0));
    this.camera.fov = 0.78;
    this.camera.minZ = 0.2;
    this.camera.maxZ = 80;

    const hemi = new HemisphericLight("hemi", new Vector3(0.1, 1, -0.4), scene);
    hemi.intensity = 0.7;
    hemi.groundColor = new Color3(0.1, 0.14, 0.22);

    const sun = new PointLight("sun", new Vector3(3, 12, -10), scene);
    sun.intensity = 0.95;
    sun.diffuse = new Color3(0.85, 0.92, 1);

    this.buildStation();
    this.buildStars();
  }

  private buildStation(): void {
    // Same boxy station — only soften the visible front corners / top lip.
    const hullMat = litMat(this.scene, "hullMat", new Color3(0.22, 0.3, 0.4), new Color3(0.05, 0.09, 0.14));
    softFrontSlab(this.scene, "stationHull", 13.5, 2.8, 2.6, new Vector3(0, -0.7, 0.4), 0.85, hullMat);

    const deckMat = litMat(this.scene, "deckMat", new Color3(0.4, 0.62, 0.78), new Color3(0.1, 0.22, 0.3));
    softFrontSlab(this.scene, "stationDeck", 12, 0.28, 2.2, new Vector3(0, STATION_DECK_Y, 0.1), 0.7, deckMat);

    for (let i = -4; i <= 4; i++) {
      const seam = CreateBox(`seam-${i}`, { width: 0.08, height: 0.06, depth: 1.9 }, this.scene);
      seam.position = new Vector3(i * 1.25, STATION_DECK_Y + 0.18, 0.05);
      seam.material = glowMat(this.scene, `seamMat-${i}`, new Color3(0.15, 0.35, 0.5));
    }
    for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) {
      const window = CreateBox(`win-${x}`, { width: 0.55, height: 0.28, depth: 0.12 }, this.scene);
      window.position = new Vector3(x, -0.15, -0.85);
      window.material = glowMat(this.scene, `winMat-${x}`, new Color3(0.95, 0.75, 0.35));
    }

    const tower = CreateBox("tower", { width: 1.6, height: 1.6, depth: 1.2 }, this.scene);
    tower.position = new Vector3(0, STATION_DECK_Y + 1.05, 0.35);
    tower.material = litMat(this.scene, "towerMat", new Color3(0.32, 0.48, 0.6), new Color3(0.07, 0.15, 0.22));
    const dish = CreateCylinder("dish", { height: 0.12, diameter: 1.1 }, this.scene);
    dish.position = new Vector3(0, STATION_DECK_Y + 1.95, 0.35);
    dish.material = litMat(this.scene, "dishMat", new Color3(0.7, 0.75, 0.85), new Color3(0.15, 0.2, 0.28));

    for (let i = 0; i < CANNON_X.length; i++) {
      this.buildCannon(i, CANNON_X[i]);
    }

    const shield = CreateBox("shieldHint", { width: 12.2, height: 0.7, depth: 2.4 }, this.scene);
    shield.position = new Vector3(0, IMPACT_Y + 0.1, 0.05);
    const shieldMat = new StandardMaterial("shieldMat", this.scene);
    shieldMat.emissiveColor = new Color3(0.15, 0.85, 0.65);
    shieldMat.alpha = 0.16;
    shieldMat.wireframe = true;
    shieldMat.disableLighting = true;
    shield.material = shieldMat;
    this.stationShield = shield;
  }

  /** Short turret: fixed pedestal + aimable barrel pivot. */
  private buildCannon(i: number, x: number): void {
    const pedestal = CreateCylinder(`cannonPedestal-${i}`, { height: 0.45, diameterTop: 0.75, diameterBottom: 1.05 }, this.scene);
    pedestal.position = new Vector3(x, STATION_DECK_Y + 0.4, -0.4);
    pedestal.material = litMat(
      this.scene,
      `pedestalMat-${i}`,
      new Color3(0.45, 0.5, 0.58),
      new Color3(0.1, 0.12, 0.16),
    );

    const pivot = new TransformNode(`cannonPivot-${i}`, this.scene);
    pivot.position = new Vector3(x, STATION_DECK_Y + 0.78, -0.4);

    const yoke = CreateBox(`cannonYoke-${i}`, { width: 0.7, height: 0.28, depth: 0.45 }, this.scene);
    yoke.parent = pivot;
    yoke.position = new Vector3(0, 0, 0);
    yoke.material = litMat(this.scene, `yokeMat-${i}`, new Color3(0.55, 0.6, 0.68), new Color3(0.12, 0.14, 0.18));

    const barrel = CreateCylinder(`cannonBarrel-${i}`, { height: BARREL_LEN, diameterTop: 0.24, diameterBottom: 0.38 }, this.scene);
    barrel.parent = pivot;
    barrel.position = new Vector3(0, BARREL_LEN * 0.5 + 0.08, 0);
    barrel.material = litMat(this.scene, `barrelMat-${i}`, new Color3(0.65, 0.7, 0.8), new Color3(0.18, 0.22, 0.3));

    const collar = CreateCylinder(`cannonCollar-${i}`, { height: 0.16, diameter: 0.48 }, this.scene);
    collar.parent = pivot;
    collar.position = new Vector3(0, 0.18, 0);
    collar.material = litMat(this.scene, `collarMat-${i}`, new Color3(0.78, 0.55, 0.25), new Color3(0.32, 0.18, 0.05));

    const muzzle = CreateDisc(`cannonMuzzle-${i}`, { radius: 0.2, tessellation: 20 }, this.scene);
    muzzle.parent = pivot;
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position = new Vector3(0, BARREL_LEN + 0.08, 0);
    muzzle.material = glowMat(this.scene, `muzzleMat-${i}`, new Color3(1, 0.55, 0.2));

    const tip = CreateSphere(`cannonTip-${i}`, { diameter: 0.16, segments: 8 }, this.scene);
    tip.parent = pivot;
    tip.position = new Vector3(0, BARREL_LEN + 0.05, 0);
    tip.material = glowMat(this.scene, `tipMat-${i}`, new Color3(1, 0.85, 0.4));

    this.cannons.push({ x, pivot, barrel, muzzle });
  }

  private buildStars(): Mesh {
    const plane = CreatePlane("stars", { width: 38, height: 28 }, this.scene);
    plane.position = new Vector3(0, 7.5, 6);
    const tex = new DynamicTexture("starTex", { width: 1024, height: 1024 }, this.scene, false);
    tex.updateSamplingMode(Texture.NEAREST_NEAREST);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#03060f";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 320; i++) {
      const x = Math.floor(Math.random() * 1024);
      const y = Math.floor(Math.random() * 1024);
      const bright = 180 + Math.floor(Math.random() * 75);
      const size = Math.random() < 0.12 ? 2 : 1;
      ctx.fillStyle = `rgb(${bright},${bright},${Math.min(255, bright + 20)})`;
      ctx.fillRect(x, y, size, size);
    }
    tex.update();
    const mat = new StandardMaterial("starMat", this.scene);
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    plane.material = mat;
    return plane;
  }

  /** Aim both cannons toward a world-space point (current target asteroid). */
  setAimTarget(target: { x: number; y: number; z: number } | null): void {
    this.aimTarget = target ? new Vector3(target.x, target.y, target.z) : null;
  }

  /** World-space muzzle of the cannon nearest to target X (after aiming). */
  cannonMuzzle(targetX: number): Vector3 {
    const rig =
      this.cannons.find((c) => Math.abs(c.x - targetX) === Math.min(...this.cannons.map((o) => Math.abs(o.x - targetX)))) ??
      this.cannons[0];
    if (!rig) return new Vector3(0, STATION_DECK_Y + 1.5, -0.4);
    const local = new Vector3(0, BARREL_LEN + 0.08, 0);
    return Vector3.TransformCoordinates(local, rig.pivot.getWorldMatrix());
  }

  private aimCannons(): void {
    for (const rig of this.cannons) {
      if (!this.aimTarget) {
        rig.pivot.rotation.set(0, 0, 0);
        continue;
      }
      const dx = this.aimTarget.x - rig.pivot.position.x;
      const dy = this.aimTarget.y - rig.pivot.position.y;
      // Barrel defaults to +Y; rotate in the front XY plane toward the target.
      const angle = -Math.atan2(dx, Math.max(0.35, dy));
      // Clamp so barrels don't flip into the deck.
      rig.pivot.rotation.z = Math.max(-0.95, Math.min(0.95, angle));
      // Slight nod in depth toward the rock.
      const dz = this.aimTarget.z - rig.pivot.position.z;
      rig.pivot.rotation.x = Math.max(-0.25, Math.min(0.15, Math.atan2(dz, Math.max(0.5, dy)) * 0.35));
    }
  }

  private makeBody(id: string, kind: BodyKind, label: number): BodyMesh {
    const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), label * 17);
    let root: Mesh;
    let baseDiffuse: Color3;
    let baseEmissive: Color3;
    if (kind === "bonus") {
      root = CreateSphere(`body-${id}`, { diameter: 1.0, segments: 12 }, this.scene);
      baseDiffuse = new Color3(0.25, 0.95, 0.7);
      baseEmissive = new Color3(0.15, 0.45, 0.3);
    } else {
      root = createRockyMesh(this.scene, `body-${id}`, seed, 0.78);
      const palette = rockPalette(seed);
      baseDiffuse = palette.diffuse;
      baseEmissive = palette.emissive;
    }
    const mat = new StandardMaterial(`bodyMat-${id}`, this.scene);
    mat.diffuseColor = baseDiffuse.clone();
    mat.emissiveColor = baseEmissive.clone();
    mat.specularColor = kind === "bonus" ? new Color3(0.3, 0.4, 0.35) : new Color3(0.12, 0.1, 0.08);
    root.material = mat;

    const labelPlane = CreatePlane(`label-${id}`, { size: 1.15 }, this.scene);
    labelPlane.parent = root;
    labelPlane.position = new Vector3(0, 0, -0.95);
    labelPlane.billboardMode = 7;
    const texture = new DynamicTexture(`labelTex-${id}`, { width: 128, height: 128 }, this.scene, false);
    texture.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    const labelMat = new StandardMaterial(`labelMat-${id}`, this.scene);
    labelMat.diffuseTexture = texture;
    labelMat.emissiveTexture = texture;
    labelMat.opacityTexture = texture;
    labelMat.disableLighting = true;
    labelMat.backFaceCulling = false;
    labelPlane.material = labelMat;

    const body: BodyMesh = { root, labelPlane, texture, label, kind, selected: false, baseDiffuse, baseEmissive };
    this.paintLabel(body, label, false);
    this.bodies.set(id, body);
    return body;
  }

  private paintLabel(body: BodyMesh, label: number, selected: boolean): void {
    const ctx = body.texture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 128, 128);
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    if (body.kind === "bonus") {
      ctx.fillStyle = selected ? "rgba(120, 255, 210, 0.95)" : "rgba(8, 40, 32, 0.88)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#7dffc8";
      ctx.stroke();
      ctx.fillStyle = selected ? "#063328" : "#e8fff6";
      ctx.font = "bold 52px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u{1F6E1}", 64, 66);
    } else {
      ctx.fillStyle = selected ? "rgba(255, 220, 120, 0.95)" : "rgba(12, 20, 40, 0.88)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = selected ? "#ffe08a" : "rgba(180, 210, 255, 0.65)";
      ctx.stroke();
      ctx.fillStyle = selected ? "#1a1408" : "#f4f7ff";
      ctx.font = "bold 48px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(label), 64, 66);
    }
    body.texture.update();
    body.label = label;
  }

  syncBodies(list: readonly BodyVisual[]): void {
    const seen = new Set<string>();
    for (const b of list) {
      seen.add(b.id);
      let mesh = this.bodies.get(b.id);
      if (!mesh) mesh = this.makeBody(b.id, b.kind, b.label);
      mesh.root.position.set(b.x, b.y, b.z);
      // Slow tumble so rocks feel irregular, not floating balls.
      if (b.kind === "asteroid" && !b.burning) {
        mesh.root.rotation.x = this.time * 0.35 + b.x * 0.2;
        mesh.root.rotation.y = this.time * 0.55 + b.y * 0.1;
        mesh.root.rotation.z = this.time * 0.25;
      }
      const scale = b.burning ? 0.2 + (1 - (b.hitFlash ?? 0)) * 0.5 : 1 + (b.selected ? 0.12 : 0);
      mesh.root.scaling.setAll(scale * (b.kind === "bonus" ? 0.9 : 1));
      const selected = !!b.selected;
      if (mesh.label !== b.label || mesh.selected !== selected) {
        this.paintLabel(mesh, b.label, selected);
        mesh.selected = selected;
      }
      const mat = mesh.root.material as StandardMaterial;
      if (b.kind === "asteroid") {
        const flash = b.hitFlash ?? 0;
        mat.diffuseColor = mesh.baseDiffuse;
        mat.emissiveColor = b.burning
          ? new Color3(1, 0.55, 0.15)
          : new Color3(
              mesh.baseEmissive.r + flash * 0.55,
              mesh.baseEmissive.g + flash * 0.25,
              mesh.baseEmissive.b + flash * 0.1,
            );
      } else {
        mat.emissiveColor = new Color3(0.15, 0.55 + Math.sin(this.time * 4) * 0.15, 0.35);
      }
    }
    for (const [id, mesh] of this.bodies) {
      if (seen.has(id)) continue;
      mesh.root.dispose();
      mesh.labelPlane.dispose();
      mesh.texture.dispose();
      this.bodies.delete(id);
    }
  }

  syncShots(list: readonly ShotVisual[]): void {
    const seen = new Set<string>();
    for (const s of list) {
      seen.add(s.id);
      let mesh = this.shots.get(s.id);
      const t = 1 - s.life / s.maxLife;
      const pos = Vector3.Lerp(s.from, s.to, Math.min(1, t));
      if (!mesh) {
        mesh = CreateSphere(`shot-${s.id}`, { diameter: 0.28, segments: 8 }, this.scene);
        const mat = new StandardMaterial(`shotMat-${s.id}`, this.scene);
        mat.emissiveColor = s.success ? new Color3(0.45, 1, 0.75) : new Color3(1, 0.35, 0.3);
        mat.disableLighting = true;
        mesh.material = mat;
        this.shots.set(s.id, mesh);
      }
      mesh.position.copyFrom(pos);
      const mat = mesh.material as StandardMaterial;
      mat.alpha = Math.max(0, s.life / s.maxLife);
    }
    for (const [id, mesh] of this.shots) {
      if (seen.has(id)) continue;
      mesh.dispose();
      this.shots.delete(id);
    }
  }

  update(dt: number, shieldCharges: number): void {
    this.time += dt;
    this.pulse += dt;
    this.aimCannons();
    if (this.stationShield) {
      this.stationShield.scaling.y = 1 + Math.sin(this.pulse * 2.4) * 0.05;
      this.stationShield.isVisible = shieldCharges > 0;
      const mat = this.stationShield.material as StandardMaterial;
      mat.alpha = 0.12 + Math.min(0.2, shieldCharges * 0.07);
    }
  }

  /** Pick body under screen pointer; returns id or null. */
  pickBody(canvas: HTMLCanvasElement, clientX: number, clientY: number): string | null {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const pick = this.scene.pick(x, y, (m) => {
      let node: { name?: string; parent?: unknown } | null = m;
      while (node) {
        if (typeof node.name === "string" && node.name.startsWith("body-")) return true;
        node = (node.parent as { name?: string; parent?: unknown } | null) ?? null;
      }
      return false;
    });
    if (!pick?.hit || !pick.pickedMesh) return null;
    let node: { name?: string; parent?: unknown } | null = pick.pickedMesh;
    while (node) {
      if (typeof node.name === "string" && node.name.startsWith("body-")) return node.name.slice(5);
      node = (node.parent as { name?: string; parent?: unknown } | null) ?? null;
    }
    return null;
  }
}

/** Spawn a falling body in a horizontal lane above the station. */
export function spawnAbove(laneX: number, height: number, depth = 0): { x: number; y: number; z: number } {
  return {
    x: Math.max(-PLAYFIELD_HALF, Math.min(PLAYFIELD_HALF, laneX)),
    y: height,
    z: depth,
  };
}

export interface ApproachSpawn {
  x: number;
  y: number;
  z: number;
  /** Deck aim point — rock drifts toward (targetX, IMPACT_Y). */
  targetX: number;
}

type ApproachKind = "overTop" | "left" | "right" | "cornerL" | "cornerR";

/**
 * Always spawn past the framed viewport (over the horizon / off the sides),
 * then drift into view toward a deck aim point. Never mid-viewport empty space.
 */
export function pickApproachSpawn(rng: { next(): number; pick<T>(items: readonly T[]): T }): ApproachSpawn {
  // Bias sides/corners so entries feel lateral, not only dropping from dead center.
  const kind = rng.pick<ApproachKind>([
    "overTop",
    "overTop",
    "left",
    "right",
    "cornerL",
    "cornerR",
    "left",
    "right",
  ]);
  const targetX = (rng.next() * 2 - 1) * (PLAYFIELD_HALF * 0.55);
  const z = (rng.next() - 0.5) * 0.55;
  switch (kind) {
    case "overTop": {
      // Above the top of the frame; X can lean left/right but still off-screen in Y.
      const lean = rng.pick([-1, 0, 1] as const);
      const x =
        lean === 0
          ? (rng.next() * 2 - 1) * (PLAYFIELD_HALF * 0.9)
          : lean * (OFFSCREEN_X * 0.55 + rng.next() * 1.8);
      return {
        x,
        y: OFFSCREEN_Y + rng.next() * 2.4,
        z,
        targetX: lean === 0 ? targetX : lean < 0 ? Math.min(targetX, -0.3) : Math.max(targetX, 0.3),
      };
    }
    case "left":
      return {
        x: -OFFSCREEN_X - rng.next() * 1.8,
        y: 3.2 + rng.next() * 9.5,
        z: (rng.next() - 0.5) * 0.8,
        targetX: Math.min(targetX, 0.9),
      };
    case "right":
      return {
        x: OFFSCREEN_X + rng.next() * 1.8,
        y: 3.2 + rng.next() * 9.5,
        z: (rng.next() - 0.5) * 0.8,
        targetX: Math.max(targetX, -0.9),
      };
    case "cornerL":
      return {
        x: -OFFSCREEN_X - 0.6 - rng.next() * 1.4,
        y: OFFSCREEN_Y + rng.next() * 1.8,
        z: -0.25 - rng.next() * 0.55,
        targetX: Math.min(targetX, 0.2),
      };
    case "cornerR":
      return {
        x: OFFSCREEN_X + 0.6 + rng.next() * 1.4,
        y: OFFSCREEN_Y + rng.next() * 1.8,
        z: -0.25 - rng.next() * 0.55,
        targetX: Math.max(targetX, -0.2),
      };
  }
}

/** Place split shards on a circle around the parent with generous spacing. */
export function splitRingOffsets(
  count: number,
  rng: { next(): number },
  radius = 1.85,
): { dx: number; dy: number; dz: number }[] {
  const n = Math.max(1, count);
  const base = rng.next() * Math.PI * 2;
  return Array.from({ length: n }, (_, i) => {
    const ang = base + (i * Math.PI * 2) / n + (rng.next() - 0.5) * 0.35;
    const r = radius * (0.85 + rng.next() * 0.35);
    return {
      dx: Math.cos(ang) * r,
      dy: Math.sin(ang) * r * 0.55,
      dz: Math.sin(ang * 1.3) * 0.25,
    };
  });
}
