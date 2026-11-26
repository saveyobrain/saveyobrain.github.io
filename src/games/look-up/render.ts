import type { Scene } from "@babylonjs/core/scene";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
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
}

/** Half-width of the play lane (world X). */
export const PLAYFIELD_HALF = 5.2;
/** Y of the station deck top. */
export const STATION_DECK_Y = 0.4;
/** Asteroids hit the station when they reach this height. */
export const IMPACT_Y = 1.7;
/**
 * Lowest spawn band — kept inside the camera frame so rocks are visible
 * immediately after Start (not waiting off-screen above the frustum).
 */
export const SPAWN_Y = 11.2;
/** Top of the visible play column (for staggered rows). */
export const SPAWN_Y_MAX = 13.4;

const CANNON_X = [-2.6, 2.6] as const;

function litMat(scene: Scene, name: string, diffuse: Color3, emissive: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = diffuse;
  m.emissiveColor = emissive;
  m.specularColor = new Color3(0.35, 0.4, 0.5);
  return m;
}

function glowMat(scene: Scene, name: string, color: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = color;
  m.disableLighting = true;
  return m;
}

/** Front-facing space view: station deck at bottom, asteroids fall from the top of the frame. */
export class SpaceView {
  readonly camera: TargetCamera;
  private readonly bodies = new Map<string, BodyMesh>();
  private readonly shots = new Map<string, Mesh>();
  private readonly cannons: Mesh[] = [];
  private stationShield: Mesh | null = null;
  private time = 0;
  private pulse = 0;

  constructor(private readonly scene: Scene) {
    scene.clearColor = new Color4(0.015, 0.03, 0.07, 1);

    // Frame: station near bottom edge, spawn band near top — rocks visible at once.
    this.camera = new TargetCamera("cam", new Vector3(0, 6.4, -17.5), scene);
    this.camera.setTarget(new Vector3(0, 6.4, 0));
    this.camera.fov = 0.78; // ~45° — full column from deck (~0) to spawn (~13)
    this.camera.minZ = 0.2;
    this.camera.maxZ = 80;

    const hemi = new HemisphericLight("hemi", new Vector3(0.1, 1, -0.4), scene);
    hemi.intensity = 0.7;
    hemi.groundColor = new Color3(0.1, 0.14, 0.22);

    const sun = new PointLight("sun", new Vector3(3, 12, -10), scene);
    sun.intensity = 0.95;
    sun.diffuse = new Color3(0.85, 0.92, 1);

    this.buildStation();
    this.buildStars(); // stays in the scene; no further animation needed
  }

  private buildStation(): void {
    // Thick hull slab peeking from the bottom of the screen.
    const hull = CreateBox("stationHull", { width: 13.5, height: 2.8, depth: 2.6 }, this.scene);
    hull.position = new Vector3(0, -0.7, 0.4);
    hull.material = litMat(this.scene, "hullMat", new Color3(0.22, 0.3, 0.4), new Color3(0.05, 0.09, 0.14));

    // Flat deck surface — reads as a platform, not a globe.
    const deck = CreateBox("stationDeck", { width: 12, height: 0.28, depth: 2.2 }, this.scene);
    deck.position = new Vector3(0, STATION_DECK_Y, 0.1);
    deck.material = litMat(this.scene, "deckMat", new Color3(0.4, 0.62, 0.78), new Color3(0.1, 0.22, 0.3));

    // Panel seams / window row for “station surface” silhouette.
    for (let i = -4; i <= 4; i++) {
      const seam = CreateBox(`seam-${i}`, { width: 0.08, height: 0.06, depth: 2.0 }, this.scene);
      seam.position = new Vector3(i * 1.25, STATION_DECK_Y + 0.18, 0.05);
      seam.material = glowMat(this.scene, `seamMat-${i}`, new Color3(0.15, 0.35, 0.5));
    }
    for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) {
      const window = CreateBox(`win-${x}`, { width: 0.55, height: 0.28, depth: 0.12 }, this.scene);
      window.position = new Vector3(x, -0.15, -0.85);
      window.material = glowMat(this.scene, `winMat-${x}`, new Color3(0.95, 0.75, 0.35));
    }

    // Central tower so the silhouette is clearly artificial.
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

  /** Recognisable AA turret: pedestal + upright barrel + glowing muzzle ring. */
  private buildCannon(i: number, x: number): void {
    const pedestal = CreateCylinder(`cannonPedestal-${i}`, { height: 0.55, diameterTop: 0.7, diameterBottom: 0.95 }, this.scene);
    pedestal.position = new Vector3(x, STATION_DECK_Y + 0.45, -0.35);
    pedestal.material = litMat(
      this.scene,
      `pedestalMat-${i}`,
      new Color3(0.45, 0.5, 0.58),
      new Color3(0.1, 0.12, 0.16),
    );

    const yoke = CreateBox(`cannonYoke-${i}`, { width: 0.85, height: 0.35, depth: 0.55 }, this.scene);
    yoke.position = new Vector3(x, STATION_DECK_Y + 0.85, -0.35);
    yoke.material = litMat(this.scene, `yokeMat-${i}`, new Color3(0.55, 0.6, 0.68), new Color3(0.12, 0.14, 0.18));

    // Barrel points UP toward falling asteroids (default cylinder = Y axis).
    const barrel = CreateCylinder(`cannonBarrel-${i}`, { height: 1.7, diameterTop: 0.26, diameterBottom: 0.4 }, this.scene);
    barrel.position = new Vector3(x, STATION_DECK_Y + 1.75, -0.35);
    barrel.material = litMat(this.scene, `barrelMat-${i}`, new Color3(0.65, 0.7, 0.8), new Color3(0.18, 0.22, 0.3));
    this.cannons.push(barrel);

    const collar = CreateCylinder(`cannonCollar-${i}`, { height: 0.22, diameter: 0.52 }, this.scene);
    collar.position = new Vector3(x, STATION_DECK_Y + 1.15, -0.35);
    collar.material = litMat(this.scene, `collarMat-${i}`, new Color3(0.75, 0.55, 0.25), new Color3(0.3, 0.18, 0.05));

    const muzzle = CreateDisc(`cannonMuzzle-${i}`, { radius: 0.22, tessellation: 24 }, this.scene);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position = new Vector3(x, STATION_DECK_Y + 2.6, -0.35);
    muzzle.material = glowMat(this.scene, `muzzleMat-${i}`, new Color3(1, 0.55, 0.2));

    const tip = CreateSphere(`cannonTip-${i}`, { diameter: 0.18, segments: 8 }, this.scene);
    tip.position = new Vector3(x, STATION_DECK_Y + 2.55, -0.35);
    tip.material = glowMat(this.scene, `tipMat-${i}`, new Color3(1, 0.85, 0.4));
  }

  private buildStars(): Mesh {
    const plane = CreatePlane("stars", { width: 36, height: 26 }, this.scene);
    plane.position = new Vector3(0, 7.5, 6);
    // High-res + nearest sampling keeps points crisp (no soft bloom wash).
    const tex = new DynamicTexture("starTex", { width: 1024, height: 1024 }, this.scene, false);
    tex.updateSamplingMode(Texture.NEAREST_NEAREST);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#03060f";
    ctx.fillRect(0, 0, 1024, 1024);
    // Tiny hard dots only — no nebula gradients, no soft discs.
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

  /** Muzzle of the cannon nearest to world X (missiles launch upward from here). */
  cannonMuzzle(targetX: number): Vector3 {
    const i = Math.abs(targetX - CANNON_X[0]) <= Math.abs(targetX - CANNON_X[1]) ? 0 : 1;
    return new Vector3(CANNON_X[i], STATION_DECK_Y + 2.6, -0.35);
  }

  private makeBody(id: string, kind: BodyKind, label: number): BodyMesh {
    const root = CreateSphere(`body-${id}`, { diameter: kind === "bonus" ? 1.0 : 1.45, segments: 14 }, this.scene);
    const mat = new StandardMaterial(`bodyMat-${id}`, this.scene);
    if (kind === "bonus") {
      mat.diffuseColor = new Color3(0.25, 0.95, 0.7);
      mat.emissiveColor = new Color3(0.15, 0.45, 0.3);
    } else {
      // Bright rock so it pops against the dark sky.
      mat.diffuseColor = new Color3(0.9, 0.55, 0.35);
      mat.emissiveColor = new Color3(0.35, 0.15, 0.08);
    }
    root.material = mat;

    const labelPlane = CreatePlane(`label-${id}`, { size: 1.2 }, this.scene);
    labelPlane.parent = root;
    labelPlane.position = new Vector3(0, 0, -0.8);
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

    const body: BodyMesh = { root, labelPlane, texture, label, kind, selected: false };
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
      const scale = b.burning ? 0.2 + (1 - (b.hitFlash ?? 0)) * 0.5 : 1 + (b.selected ? 0.14 : 0);
      mesh.root.scaling.setAll(scale * (b.kind === "bonus" ? 0.9 : 1));
      const selected = !!b.selected;
      if (mesh.label !== b.label || mesh.selected !== selected) {
        this.paintLabel(mesh, b.label, selected);
        mesh.selected = selected;
      }
      const mat = mesh.root.material as StandardMaterial;
      if (b.kind === "asteroid") {
        const flash = b.hitFlash ?? 0;
        mat.emissiveColor = b.burning
          ? new Color3(1, 0.55, 0.15)
          : new Color3(0.35 + flash * 0.5, 0.15 + flash * 0.25, 0.08);
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
    for (const cannon of this.cannons) {
      cannon.scaling.y = 1 + Math.sin(this.pulse * 2.8 + cannon.position.x) * 0.04;
    }
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
    const pick = this.scene.pick(x, y, (m) => typeof m.name === "string" && m.name.startsWith("body-"));
    if (!pick?.hit || !pick.pickedMesh) return null;
    const name = pick.pickedMesh.name;
    return name.startsWith("body-") ? name.slice(5) : null;
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
