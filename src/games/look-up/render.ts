import type { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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
  /** World position; station is near origin, threats approach from +Z / ring. */
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

const STATION_RADIUS = 1.35;

/** Perspective space view: station at origin, threats drift inward. */
export class SpaceView {
  readonly camera: ArcRotateCamera;
  private readonly bodies = new Map<string, BodyMesh>();
  private readonly shots = new Map<string, Mesh>();
  private readonly starField: Mesh;
  private time = 0;
  private pulse = 0;

  constructor(private readonly scene: Scene) {
    scene.clearColor = new Color4(0.02, 0.04, 0.1, 1);

    this.camera = new ArcRotateCamera("cam", -Math.PI / 2, 1.05, 18, new Vector3(0, 0.4, 0), scene);
    this.camera.lowerRadiusLimit = 14;
    this.camera.upperRadiusLimit = 22;
    this.camera.panningSensibility = 0;
    this.camera.inputs.clear();

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.3), scene);
    hemi.intensity = 0.55;
    hemi.groundColor = new Color3(0.05, 0.08, 0.18);

    const sun = new PointLight("sun", new Vector3(8, 10, -6), scene);
    sun.intensity = 0.85;
    sun.diffuse = new Color3(0.7, 0.85, 1);

    this.buildStation();
    this.starField = this.buildStars();
  }

  private buildStation(): void {
    const core = CreateSphere("station", { diameter: STATION_RADIUS * 2, segments: 24 }, this.scene);
    const mat = new StandardMaterial("stationMat", this.scene);
    mat.diffuseColor = new Color3(0.35, 0.75, 0.9);
    mat.emissiveColor = new Color3(0.08, 0.22, 0.3);
    mat.specularColor = new Color3(0.4, 0.6, 0.8);
    core.material = mat;

    const ring = CreateSphere("stationRing", { diameter: STATION_RADIUS * 2.8, segments: 16 }, this.scene);
    ring.scaling = new Vector3(1, 0.12, 1);
    const ringMat = new StandardMaterial("ringMat", this.scene);
    ringMat.diffuseColor = new Color3(0.95, 0.65, 0.25);
    ringMat.emissiveColor = new Color3(0.35, 0.18, 0.05);
    ringMat.alpha = 0.9;
    ring.material = ringMat;

    const shield = CreateSphere("shieldHint", { diameter: STATION_RADIUS * 3.2, segments: 20 }, this.scene);
    const shieldMat = new StandardMaterial("shieldMat", this.scene);
    shieldMat.diffuseColor = new Color3(0.2, 0.9, 0.7);
    shieldMat.emissiveColor = new Color3(0.05, 0.25, 0.2);
    shieldMat.alpha = 0.12;
    shieldMat.wireframe = true;
    shield.material = shieldMat;
    this.stationShield = shield;
  }

  private stationShield: Mesh | null = null;

  private buildStars(): Mesh {
    const plane = CreatePlane("stars", { size: 60 }, this.scene);
    plane.position = new Vector3(0, 0, 12);
    plane.billboardMode = 7;
    const tex = new DynamicTexture("starTex", { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#02040c";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 1.6 + 0.3;
      ctx.fillStyle = `rgba(${180 + Math.random() * 75}, ${200 + Math.random() * 55}, 255, ${0.35 + Math.random() * 0.65})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft nebula washes
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 80 + Math.random() * 60);
      grd.addColorStop(0, `rgba(${40 + Math.random() * 80}, ${120 + Math.random() * 100}, ${180 + Math.random() * 60}, 0.22)`);
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

  setShieldVisible(on: boolean): void {
    if (this.stationShield) this.stationShield.isVisible = on;
  }

  private makeBody(id: string, kind: BodyKind, label: number): BodyMesh {
    const root = CreateSphere(`body-${id}`, { diameter: kind === "bonus" ? 0.9 : 1.35, segments: 14 }, this.scene);
    const mat = new StandardMaterial(`bodyMat-${id}`, this.scene);
    if (kind === "bonus") {
      mat.diffuseColor = new Color3(0.3, 0.95, 0.7);
      mat.emissiveColor = new Color3(0.1, 0.4, 0.25);
    } else {
      mat.diffuseColor = new Color3(0.75, 0.45, 0.35);
      mat.emissiveColor = new Color3(0.2, 0.08, 0.05);
    }
    root.material = mat;

    const labelPlane = CreatePlane(`label-${id}`, { size: 1.1 }, this.scene);
    labelPlane.parent = root;
    labelPlane.position = new Vector3(0, 0, -0.75);
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
        mesh = CreateSphere(`shot-${s.id}`, { diameter: 0.28, segments: 8 }, this.scene);
        const mat = new StandardMaterial(`shotMat-${s.id}`, this.scene);
        mat.emissiveColor = s.success ? new Color3(0.4, 1, 0.7) : new Color3(1, 0.35, 0.3);
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
    this.camera.alpha = -Math.PI / 2 + Math.sin(this.time * 0.15) * 0.08;
    this.camera.beta = 1.05 + Math.sin(this.time * 0.22) * 0.04;
    this.starField.rotation.z = this.time * 0.02;
    if (this.stationShield) {
      this.stationShield.scaling.setAll(1 + Math.sin(this.pulse * 2.5) * 0.03);
      this.stationShield.isVisible = shieldCharges > 0;
      const mat = this.stationShield.material as StandardMaterial;
      mat.alpha = 0.1 + Math.min(0.25, shieldCharges * 0.08);
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

/** World spawn on a ring facing the station, with slight elevation variety. */
export function spawnPoint(angle: number, distance: number, elevation = 0): { x: number; y: number; z: number } {
  return {
    x: Math.cos(angle) * distance,
    y: elevation,
    z: Math.sin(angle) * distance,
  };
}

export function stationHitDistance(): number {
  return STATION_RADIUS + 0.55;
}
