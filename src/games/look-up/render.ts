import type { Scene } from "@babylonjs/core/scene";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
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
export const PLAYFIELD_HALF = 5.5;
/** Y of the station deck top (impact line sits just above). */
export const STATION_DECK_Y = 0.35;
/** Asteroids hit the station when they reach this height. */
export const IMPACT_Y = 1.55;
/** Typical spawn height above the station. */
export const SPAWN_Y = 15.5;

const CANNON_X = [-2.35, 2.35] as const;

/** Front-facing space view: station at the bottom, asteroids fall from above. */
export class SpaceView {
  readonly camera: TargetCamera;
  private readonly bodies = new Map<string, BodyMesh>();
  private readonly shots = new Map<string, Mesh>();
  private readonly starField: Mesh;
  private readonly cannons: Mesh[] = [];
  private stationShield: Mesh | null = null;
  private time = 0;
  private pulse = 0;

  constructor(private readonly scene: Scene) {
    scene.clearColor = new Color4(0.02, 0.04, 0.1, 1);

    // Look straight at the vertical playfield (station bottom, sky top).
    this.camera = new TargetCamera("cam", new Vector3(0, 7.2, -18.5), scene);
    this.camera.setTarget(new Vector3(0, 6.4, 0));
    this.camera.fov = 0.55;
    this.camera.minZ = 0.2;
    this.camera.maxZ = 80;

    const hemi = new HemisphericLight("hemi", new Vector3(0.15, 1, -0.35), scene);
    hemi.intensity = 0.6;
    hemi.groundColor = new Color3(0.08, 0.12, 0.2);

    const sun = new PointLight("sun", new Vector3(-4, 14, -8), scene);
    sun.intensity = 0.9;
    sun.diffuse = new Color3(0.75, 0.88, 1);

    this.buildStation();
    this.starField = this.buildStars();
  }

  private buildStation(): void {
    // Partially visible station hull / deck along the bottom of the view.
    const hull = CreateBox("stationHull", { width: 14, height: 2.4, depth: 3.2 }, this.scene);
    hull.position = new Vector3(0, -0.55, 0.6);
    const hullMat = new StandardMaterial("hullMat", this.scene);
    hullMat.diffuseColor = new Color3(0.28, 0.38, 0.48);
    hullMat.emissiveColor = new Color3(0.04, 0.08, 0.12);
    hullMat.specularColor = new Color3(0.25, 0.35, 0.45);
    hull.material = hullMat;

    const deck = CreateBox("stationDeck", { width: 11.5, height: 0.35, depth: 2.4 }, this.scene);
    deck.position = new Vector3(0, STATION_DECK_Y, 0.2);
    const deckMat = new StandardMaterial("deckMat", this.scene);
    deckMat.diffuseColor = new Color3(0.45, 0.7, 0.85);
    deckMat.emissiveColor = new Color3(0.08, 0.18, 0.25);
    deck.material = deckMat;

    // Soft lit strips so the surface reads as a station deck, not a planet.
    for (const x of [-4.2, -1.4, 1.4, 4.2]) {
      const strip = CreateBox(`deckStrip-${x}`, { width: 0.35, height: 0.08, depth: 2.1 }, this.scene);
      strip.position = new Vector3(x, STATION_DECK_Y + 0.22, 0.15);
      const stripMat = new StandardMaterial(`stripMat-${x}`, this.scene);
      stripMat.emissiveColor = new Color3(0.95, 0.7, 0.25);
      stripMat.disableLighting = true;
      strip.material = stripMat;
    }

    const bridge = CreateBox("bridge", { width: 2.4, height: 1.1, depth: 1.4 }, this.scene);
    bridge.position = new Vector3(0, STATION_DECK_Y + 0.85, 0.55);
    const bridgeMat = new StandardMaterial("bridgeMat", this.scene);
    bridgeMat.diffuseColor = new Color3(0.35, 0.55, 0.7);
    bridgeMat.emissiveColor = new Color3(0.06, 0.14, 0.2);
    bridge.material = bridgeMat;

    for (let i = 0; i < CANNON_X.length; i++) {
      const x = CANNON_X[i];
      const base = CreateCylinder(`cannonBase-${i}`, { height: 0.45, diameter: 0.85 }, this.scene);
      base.position = new Vector3(x, STATION_DECK_Y + 0.4, -0.15);
      const baseMat = new StandardMaterial(`cannonBaseMat-${i}`, this.scene);
      baseMat.diffuseColor = new Color3(0.55, 0.6, 0.7);
      baseMat.emissiveColor = new Color3(0.08, 0.1, 0.14);
      base.material = baseMat;

      const barrel = CreateCylinder(`cannonBarrel-${i}`, { height: 1.35, diameterTop: 0.28, diameterBottom: 0.42 }, this.scene);
      barrel.rotation.x = Math.PI / 2;
      barrel.position = new Vector3(x, STATION_DECK_Y + 0.85, -0.75);
      const barrelMat = new StandardMaterial(`cannonBarrelMat-${i}`, this.scene);
      barrelMat.diffuseColor = new Color3(0.7, 0.75, 0.85);
      barrelMat.emissiveColor = new Color3(0.12, 0.16, 0.22);
      barrel.material = barrelMat;
      this.cannons.push(barrel);
    }

    const shield = CreateBox("shieldHint", { width: 12, height: 0.9, depth: 2.8 }, this.scene);
    shield.position = new Vector3(0, IMPACT_Y + 0.15, 0.1);
    const shieldMat = new StandardMaterial("shieldMat", this.scene);
    shieldMat.diffuseColor = new Color3(0.2, 0.9, 0.7);
    shieldMat.emissiveColor = new Color3(0.05, 0.25, 0.2);
    shieldMat.alpha = 0.14;
    shieldMat.wireframe = true;
    shield.material = shieldMat;
    this.stationShield = shield;
  }

  private buildStars(): Mesh {
    const plane = CreatePlane("stars", { width: 40, height: 28 }, this.scene);
    plane.position = new Vector3(0, 9, 8);
    const tex = new DynamicTexture("starTex", { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#02040c";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 1.5 + 0.25;
      ctx.fillStyle = `rgba(${180 + Math.random() * 75}, ${200 + Math.random() * 55}, 255, ${0.3 + Math.random() * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 70 + Math.random() * 50);
      grd.addColorStop(0, `rgba(${30 + Math.random() * 70}, ${100 + Math.random() * 90}, ${170 + Math.random() * 60}, 0.2)`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 512, 512);
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

  /** Muzzle of the cannon nearest to world X (missiles launch from here). */
  cannonMuzzle(targetX: number): Vector3 {
    const i = Math.abs(targetX - CANNON_X[0]) <= Math.abs(targetX - CANNON_X[1]) ? 0 : 1;
    return new Vector3(CANNON_X[i], STATION_DECK_Y + 1.15, -1.35);
  }

  private makeBody(id: string, kind: BodyKind, label: number): BodyMesh {
    const root = CreateSphere(`body-${id}`, { diameter: kind === "bonus" ? 0.85 : 1.25, segments: 14 }, this.scene);
    const mat = new StandardMaterial(`bodyMat-${id}`, this.scene);
    if (kind === "bonus") {
      mat.diffuseColor = new Color3(0.3, 0.95, 0.7);
      mat.emissiveColor = new Color3(0.1, 0.4, 0.25);
    } else {
      mat.diffuseColor = new Color3(0.75, 0.45, 0.35);
      mat.emissiveColor = new Color3(0.2, 0.08, 0.05);
    }
    root.material = mat;

    const labelPlane = CreatePlane(`label-${id}`, { size: 1.05 }, this.scene);
    labelPlane.parent = root;
    labelPlane.position = new Vector3(0, 0, -0.7);
    labelPlane.billboardMode = 7;
    const texture = new DynamicTexture(`labelTex-${id}`, { width: 128, height: 128 }, this.scene, false);
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
      ctx.fillStyle = selected ? "rgba(120, 255, 210, 0.92)" : "rgba(8, 40, 32, 0.82)";
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
      ctx.fillStyle = selected ? "rgba(255, 220, 120, 0.92)" : "rgba(12, 20, 40, 0.78)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = selected ? "#ffe08a" : "rgba(180, 210, 255, 0.55)";
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
      const scale = b.burning ? 0.2 + (1 - (b.hitFlash ?? 0)) * 0.5 : 1 + (b.selected ? 0.12 : 0);
      mesh.root.scaling.setAll(scale * (b.kind === "bonus" ? 0.85 : 1));
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
          : new Color3(0.2 + flash * 0.6, 0.08 + flash * 0.2, 0.05);
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
        mesh = CreateSphere(`shot-${s.id}`, { diameter: 0.26, segments: 8 }, this.scene);
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
    // Gentle bob so the station feels alive without changing the Tetris layout.
    this.camera.position.x = Math.sin(this.time * 0.12) * 0.15;
    this.starField.position.y = 9 + Math.sin(this.time * 0.08) * 0.2;
    for (const cannon of this.cannons) {
      cannon.scaling.y = 1 + Math.sin(this.pulse * 3 + cannon.position.x) * 0.03;
    }
    if (this.stationShield) {
      this.stationShield.scaling.y = 1 + Math.sin(this.pulse * 2.4) * 0.06;
      this.stationShield.isVisible = shieldCharges > 0;
      const mat = this.stationShield.material as StandardMaterial;
      mat.alpha = 0.1 + Math.min(0.22, shieldCharges * 0.08);
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
