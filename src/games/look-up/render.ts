import type { Scene } from "@babylonjs/core/scene";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateIcoSphere } from "@babylonjs/core/Meshes/Builders/icoSphereBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { TIER_KITS, type StationTier, type TierArtKit } from "./art";

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
  /** -1 for mirrored left hardpoint, +1 for right. */
  flip: number;
  /** Hardpoint on deck (base stays put). */
  root: TransformNode;
  /** Optional yaw of the base-pivot plate. */
  yaw: TransformNode;
  /** Pitch hinge at the barrel rear. */
  hinge: TransformNode;
  basePlane: Mesh;
  barrelPlane: Mesh;
  /** Muzzle tip in hinge-local space (rest pose). */
  muzzleLocal: Vector3;
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

function litMat(scene: Scene, name: string, diffuse: Color3, emissive: Color3, specular = 0.35): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = diffuse;
  m.emissiveColor = emissive;
  m.specularColor = new Color3(specular, specular * 0.9, specular * 0.8);
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

/** Shared GPU textures — left/right turrets reuse the same Texture instances. */
const artTexCache = new Map<string, Texture>();

function artTexture(scene: Scene, url: string, hasAlpha: boolean): Texture {
  const hit = artTexCache.get(url);
  if (hit) return hit;
  const tex = new Texture(url, scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
  tex.hasAlpha = hasAlpha;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 1;
  artTexCache.set(url, tex);
  return tex;
}

function spriteMat(scene: Scene, name: string, url: string, hasAlpha: boolean): StandardMaterial {
  const tex = artTexture(scene, url, hasAlpha);
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = Color3.White();
  m.opacityTexture = hasAlpha ? tex : null;
  m.useAlphaFromDiffuseTexture = hasAlpha;
  m.transparencyMode = hasAlpha ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE;
  m.disableLighting = true;
  m.backFaceCulling = false;
  m.specularColor = Color3.Black();
  return m;
}

/** UV on a CreatePlane (width×height) → local XY with image top at +Y when invertY. */
function planeUvToLocal(u: number, v: number, width: number, height: number): Vector3 {
  return new Vector3((u - 0.5) * width, (0.5 - v) * height, 0);
}

const DECK_WORLD_W = 14.8;

/** Front-facing space view: painted deck billboard + layered PNG turrets that aim. */
export class SpaceView {
  readonly camera: TargetCamera;
  private readonly bodies = new Map<string, BodyMesh>();
  private readonly shots = new Map<string, Mesh>();
  private readonly cannons: CannonRig[] = [];
  private stationShield: Mesh | null = null;
  private stationRoot: TransformNode | null = null;
  private deckMat: StandardMaterial | null = null;
  private tier: StationTier = 1;
  private time = 0;
  private pulse = 0;
  private aimTarget: Vector3 | null = null;

  constructor(private readonly scene: Scene) {
    scene.clearColor = new Color4(0.015, 0.03, 0.07, 1);
    // Keep depth when drawing turret layers above the deck plate.
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    scene.setRenderingAutoClearDepthStencil(2, false, false, false);

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

    this.buildStation(TIER_KITS[this.tier]);
    this.buildStars();
  }

  /** Visual tier swap (upgrade economy can call this; waves stub it for now). */
  setStationTier(tier: StationTier): void {
    if (tier === this.tier && this.cannons.length) return;
    const prev = this.tier;
    this.tier = tier;
    if (!this.cannons.length || !this.deckMat) {
      this.buildStation(TIER_KITS[tier]);
      return;
    }
    // In-place texture swap — avoid dispose/rebuild thrash at wave boundaries.
    if (prev !== tier) this.applyTierTextures(TIER_KITS[tier]);
  }

  getStationTier(): StationTier {
    return this.tier;
  }

  private applyTierTextures(kit: TierArtKit): void {
    if (this.deckMat) {
      const deckTex = artTexture(this.scene, kit.deck, false);
      this.deckMat.diffuseTexture = deckTex;
      this.deckMat.emissiveTexture = deckTex;
    }
    for (const rig of this.cannons) {
      const baseMat = rig.basePlane.material as StandardMaterial;
      const barrelMat = rig.barrelPlane.material as StandardMaterial;
      const baseTex = artTexture(this.scene, kit.basePivot, true);
      const barrelTex = artTexture(this.scene, kit.barrel, true);
      baseMat.diffuseTexture = baseTex;
      baseMat.emissiveTexture = baseTex;
      baseMat.opacityTexture = baseTex;
      barrelMat.diffuseTexture = barrelTex;
      barrelMat.emissiveTexture = barrelTex;
      barrelMat.opacityTexture = barrelTex;
      this.layoutTurretLayers(rig, kit);
    }
  }

  private layoutTurretLayers(rig: CannonRig, kit: TierArtKit): void {
    const size = kit.turretSize;
    const meta = (rig.basePlane.metadata as { builtSize?: number; turretSize?: number } | null) ?? {};
    const built = meta.builtSize ?? size;
    const s = size / built;
    rig.basePlane.scaling.set(s, s, s);
    rig.barrelPlane.scaling.set(s, s, s);
    const cradle = planeUvToLocal(kit.baseHingeU, kit.baseHingeV, size, size);
    const hingeLocal = planeUvToLocal(kit.hingeU, kit.hingeV, size, size);
    const tipLocal = planeUvToLocal(kit.tipU, kit.tipV, size, size);
    rig.hinge.position.set(cradle.x, cradle.y, -0.04);
    rig.barrelPlane.position.set(-hingeLocal.x, -hingeLocal.y, 0);
    rig.muzzleLocal = tipLocal.subtract(hingeLocal);
    rig.basePlane.metadata = { ...meta, turretSize: size, builtSize: built };
    rig.barrelPlane.metadata = { turretSize: size, builtSize: built };
  }

  private buildStation(kit: TierArtKit): void {
    // Clear any prior station (first build or recovery).
    this.stationRoot?.dispose();
    this.cannons.length = 0;
    this.stationRoot = null;
    this.deckMat = null;
    this.stationShield = null;

    const root = new TransformNode("stationRoot", this.scene);
    this.stationRoot = root;
    // Hide until textures decode so start doesn't flash oversized/untextured planes.
    root.setEnabled(false);

    // Dark under-hull so the deck billboard has a solid silhouette edge.
    const hull = CreateBox("stationHull", { width: 13.2, height: 1.6, depth: 2.4 }, this.scene);
    hull.parent = root;
    hull.position = new Vector3(0, -0.55, 0.65);
    hull.material = litMat(this.scene, "hullMat", new Color3(0.08, 0.12, 0.18), new Color3(0.02, 0.04, 0.07), 0.15);

    // Deck plate — world size matches image aspect so hardpoint UVs stay true.
    const deckW = DECK_WORLD_W;
    const deckH = deckW / kit.deckAspect;
    const deck = CreatePlane("stationDeckArt", { width: deckW, height: deckH }, this.scene);
    deck.parent = root;
    deck.position = new Vector3(0, 1.55, 0.4);
    deck.rotation.x = 0.16;
    const deckMat = spriteMat(this.scene, "deckArtMat", kit.deck, false);
    deck.material = deckMat;
    this.deckMat = deckMat;

    for (let i = 0; i < kit.hardpoints.length; i++) {
      this.buildArtCannon(i, kit.hardpoints[i], kit, deck, deckW, deckH);
    }

    const shield = CreateBox("shieldHint", { width: 12.2, height: 0.55, depth: 2.2 }, this.scene);
    shield.parent = root;
    shield.position = new Vector3(0, IMPACT_Y + 0.05, 0.05);
    const shieldMat = new StandardMaterial("shieldMat", this.scene);
    shieldMat.emissiveColor = new Color3(0.15, 0.85, 0.65);
    shieldMat.alpha = 0.14;
    shieldMat.wireframe = true;
    shieldMat.disableLighting = true;
    shield.material = shieldMat;
    this.stationShield = shield;

    const pending = [kit.deck, kit.basePivot, kit.barrel].map((url) => artTexture(this.scene, url, url.endsWith(".png")));
    Texture.WhenAllReady(pending, () => {
      if (this.stationRoot === root) root.setEnabled(true);
    });
  }

  /**
   * Layered PNG turret: UV-locked to a deck hardpoint; base fixed, barrel pitches
   * about the cradle hinge.
   */
  private buildArtCannon(
    i: number,
    hp: { u: number; v: number },
    kit: TierArtKit,
    deck: Mesh,
    deckW: number,
    deckH: number,
  ): void {
    const size = kit.turretSize;
    const flip = hp.u < 0.5 ? -1 : 1;
    const local = planeUvToLocal(hp.u, hp.v, deckW, deckH);

    const root = new TransformNode(`turretRoot-${i}`, this.scene);
    root.parent = deck;
    // Sit on the hardpoint ring, slightly toward camera (local −Z on the plate).
    root.position = new Vector3(local.x, local.y, -0.05);
    root.scaling.x = flip;

    const yaw = new TransformNode(`turretYaw-${i}`, this.scene);
    yaw.parent = root;

    const base = CreatePlane(`turretBase-${i}`, { width: size, height: size }, this.scene);
    base.parent = yaw;
    base.position = new Vector3(0, 0, 0);
    base.renderingGroupId = 1;
    base.material = spriteMat(this.scene, `turretBaseMat-${i}`, kit.basePivot, true);
    base.metadata = { turretSize: size, builtSize: size };

    const cradle = planeUvToLocal(kit.baseHingeU, kit.baseHingeV, size, size);
    const hingeLocal = planeUvToLocal(kit.hingeU, kit.hingeV, size, size);
    const tipLocal = planeUvToLocal(kit.tipU, kit.tipV, size, size);

    const hinge = new TransformNode(`turretHinge-${i}`, this.scene);
    hinge.parent = yaw;
    hinge.position = new Vector3(cradle.x, cradle.y, -0.04);

    const barrel = CreatePlane(`turretBarrel-${i}`, { width: size, height: size }, this.scene);
    barrel.parent = hinge;
    barrel.position = new Vector3(-hingeLocal.x, -hingeLocal.y, 0);
    barrel.renderingGroupId = 2;
    barrel.material = spriteMat(this.scene, `turretBarrelMat-${i}`, kit.barrel, true);
    barrel.metadata = { turretSize: size, builtSize: size };

    const muzzleLocal = tipLocal.subtract(hingeLocal);
    // World X for muzzle pick — deck-local hardpoint X is enough for nearest-cannon.
    this.cannons.push({
      x: local.x,
      flip,
      root,
      yaw,
      hinge,
      basePlane: base,
      barrelPlane: barrel,
      muzzleLocal,
    });
  }

  private buildStars(): Mesh {
    const plane = CreatePlane("stars", { width: 38, height: 28 }, this.scene);
    plane.position = new Vector3(0, 7.5, 6);
    const tex = new DynamicTexture("starTex", { width: 512, height: 512 }, this.scene, false);
    tex.updateSamplingMode(Texture.NEAREST_NEAREST);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#03060f";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 220; i++) {
      const x = Math.floor(Math.random() * 512);
      const y = Math.floor(Math.random() * 512);
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
    return Vector3.TransformCoordinates(rig.muzzleLocal, rig.hinge.getWorldMatrix());
  }

  private aimCannons(): void {
    for (const rig of this.cannons) {
      if (!this.aimTarget) {
        rig.yaw.rotation.set(0, 0, 0);
        rig.hinge.rotation.set(0, 0, 0);
        continue;
      }
      const hingeWorld = rig.hinge.getAbsolutePosition();
      const dx = this.aimTarget.x - hingeWorld.x;
      const dy = this.aimTarget.y - hingeWorld.y;
      // Painted barrel points up-right; left mount mirrors via scale.x = -1.
      const rest = Math.atan2(rig.muzzleLocal.x, Math.max(0.05, rig.muzzleLocal.y));
      const wantLocal = Math.atan2(dx * rig.flip, Math.max(0.35, dy));
      const pitch = Math.max(-1.15, Math.min(1.15, wantLocal - rest));
      // Negative scale.x mirrors rotation sense — keep world aim coherent.
      rig.hinge.rotation.z = pitch;
      const yaw = Math.max(-0.3, Math.min(0.3, -dx * rig.flip * 0.07));
      rig.yaw.rotation.y = yaw;
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
