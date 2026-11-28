import type { Scene } from "@babylonjs/core/scene";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateIcoSphere } from "@babylonjs/core/Meshes/Builders/icoSphereBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import "@babylonjs/core/Culling/ray";
import { TIER_KITS, type StationTier, type TierArtKit } from "./art";
import { IMPACT_Y, barrelPitch, frustumAtPlane, type PlayFrustum } from "./spawn";

export {
  APPROACH_FAST,
  APPROACH_SLOW,
  FRUSTUM_MARGIN,
  IMPACT_Y,
  MIN_SEPARATION,
  PLAYFIELD_HALF,
  approachSpeedScale,
  pickApproachSpawn,
  pickSeparatedApproach,
  placeAroundBreak,
  spawnAbove,
  splitRingOffsets,
  type ApproachSpawn,
  type OccupiedSpot,
  type PlayFrustum,
} from "./spawn";

export type BodyKind = "asteroid" | "shield" | "life";

function isPickup(kind: BodyKind): boolean {
  return kind === "shield" || kind === "life";
}

/** Heart silhouette, just taller than it is wide. The dividend sits in the middle. */
function traceHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.646);
  ctx.bezierCurveTo(cx - s * 0.9, cy + s * 0.158, cx - s * 0.46, cy - s * 0.725, cx, cy - s * 0.315);
  ctx.bezierCurveTo(cx + s * 0.46, cy - s * 0.725, cx + s * 0.9, cy + s * 0.158, cx, cy + s * 0.646);
  ctx.closePath();
}

/** Heater shield. The dividend sits in the face, above the point. */
function traceShield(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.62, cy - s * 0.28);
  ctx.quadraticCurveTo(cx, cy - s * 0.78, cx + s * 0.62, cy - s * 0.28);
  ctx.lineTo(cx + s * 0.62, cy + s * 0.08);
  ctx.quadraticCurveTo(cx + s * 0.48, cy + s * 0.5, cx, cy + s * 0.74);
  ctx.quadraticCurveTo(cx - s * 0.48, cy + s * 0.5, cx - s * 0.62, cy + s * 0.08);
  ctx.closePath();
}

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

/** Deck plate width. Short enough that a phone still shows both hardpoints. */
const DECK_WORLD_W = 11.4;
/** Tilt back so the top lip recedes slightly. */
const DECK_TILT = 0.14;
/** Tier-1 plate: metal lip image v. Above this row the JPG is starfield. */
const DECK_LIP_V = 0.2;
const LABEL_PX = 256;

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

/** Front-facing space view: painted deck billboard + layered PNG turrets that aim. */
export class SpaceView {
  readonly camera: TargetCamera;
  private readonly bodies = new Map<string, BodyMesh>();
  private readonly shots = new Map<string, Mesh>();
  private readonly cannons: CannonRig[] = [];
  private stationShield: Mesh | null = null;
  private stationRoot: TransformNode | null = null;
  private deckMat: StandardMaterial | null = null;
  private starTex: DynamicTexture | null = null;
  private tier: StationTier = 1;
  private time = 0;
  private pulse = 0;
  private aimTarget: Vector3 | null = null;

  constructor(private readonly scene: Scene) {
    scene.clearColor = new Color4(0.015, 0.03, 0.07, 1);
    // Later groups clear depth so sprites composite above the deck and rocks:
    // 1 turret bases, 2 barrels, 3 number badges.
    scene.setRenderingAutoClearDepthStencil(1, true, true, false);
    scene.setRenderingAutoClearDepthStencil(2, true, true, false);
    scene.setRenderingAutoClearDepthStencil(3, true, true, false);

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
    // Keep the tier-1 deck. Higher plates have turrets baked in, which would
    // stack under the live barrels instead of replacing them.
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

    // Deck plate — world size matches image aspect so hardpoint UVs stay true.
    // The lip is pinned to IMPACT_Y; everything below it drops off the bottom of the view.
    const deckW = DECK_WORLD_W;
    const deckH = deckW / kit.deckAspect;
    const lipLocalY = (0.5 - DECK_LIP_V) * deckH;
    const deckY = IMPACT_Y - lipLocalY * Math.cos(DECK_TILT);

    // Dark under-hull, kept behind the plate and low so it doesn't read as a second station.
    const hull = CreateBox("stationHull", { width: deckW * 0.72, height: 0.55, depth: 1.8 }, this.scene);
    hull.parent = root;
    hull.position = new Vector3(0, deckY - deckH * 0.22, 1.15);
    hull.renderingGroupId = 0;
    hull.material = litMat(this.scene, "hullMat", new Color3(0.08, 0.12, 0.18), new Color3(0.02, 0.04, 0.07), 0.15);

    const deck = CreatePlane("stationDeckArt", { width: deckW, height: deckH }, this.scene);
    deck.parent = root;
    deck.position = new Vector3(0, deckY, 0.35);
    deck.rotation.x = DECK_TILT;
    deck.renderingGroupId = 0;
    const deckMat = spriteMat(this.scene, "deckArtMat", kit.deck, false);
    deck.material = deckMat;
    this.deckMat = deckMat;

    for (let i = 0; i < kit.hardpoints.length; i++) {
      this.buildArtCannon(i, kit.hardpoints[i], kit, deck, deckW, deckH);
    }

    const shield = CreateBox("shieldHint", { width: deckW * 0.66, height: 0.28, depth: 1.6 }, this.scene);
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
    base.alphaIndex = 1;
    const baseMat = spriteMat(this.scene, `turretBaseMat-${i}`, kit.basePivot, true);
    baseMat.disableDepthWrite = true;
    base.material = baseMat;
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
    barrel.alphaIndex = 2;
    const barrelMat = spriteMat(this.scene, `turretBarrelMat-${i}`, kit.barrel, true);
    barrelMat.disableDepthWrite = true;
    barrel.material = barrelMat;
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
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    this.starTex = tex;
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

  /** Frustum half-extents at the play plane (z≈0) for off-screen spawn placement. */
  playFrustum(): PlayFrustum {
    const cam = this.camera;
    const engine = this.scene.getEngine();
    const aspect = Math.max(0.5, engine.getAspectRatio(cam));
    return frustumAtPlane(Math.abs(cam.position.z), cam.fov, aspect, cam.position.y);
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
    if (!rig) return new Vector3(0, IMPACT_Y + 0.4, -0.4);
    return Vector3.TransformCoordinates(rig.muzzleLocal, rig.hinge.getWorldMatrix());
  }

  private aimCannons(): void {
    for (const rig of this.cannons) {
      if (!this.aimTarget) {
        rig.yaw.rotation.set(0, 0, 0);
        rig.hinge.rotation.set(0, 0, 0);
        continue;
      }
      rig.yaw.rotation.set(0, 0, 0);
      const hingeWorld = rig.hinge.getAbsolutePosition();
      const dx = this.aimTarget.x - hingeWorld.x;
      const dy = this.aimTarget.y - hingeWorld.y;
      // Pitch only. Yaw spun the flat sprite through the deck plane.
      rig.hinge.rotation.z = barrelPitch(rig.muzzleLocal.x, rig.muzzleLocal.y, dx, dy, rig.flip);
    }
  }

  private makeBody(id: string, kind: BodyKind, label: number): BodyMesh {
    const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), label * 17);
    let root: Mesh;
    let baseDiffuse: Color3;
    let baseEmissive: Color3;
    if (kind === "life") {
      root = CreateSphere(`body-${id}`, { diameter: 1.15, segments: 12 }, this.scene);
      baseDiffuse = new Color3(0.95, 0.35, 0.42);
      baseEmissive = new Color3(0.55, 0.1, 0.16);
    } else if (kind === "shield") {
      root = CreateSphere(`body-${id}`, { diameter: 1.15, segments: 12 }, this.scene);
      baseDiffuse = new Color3(0.25, 0.95, 0.7);
      baseEmissive = new Color3(0.15, 0.45, 0.3);
    } else {
      root = createRockyMesh(this.scene, `body-${id}`, seed, 0.92);
      const palette = rockPalette(seed);
      baseDiffuse = palette.diffuse;
      baseEmissive = palette.emissive;
    }
    const mat = new StandardMaterial(`bodyMat-${id}`, this.scene);
    mat.diffuseColor = baseDiffuse.clone();
    mat.emissiveColor = baseEmissive.clone();
    mat.specularColor = isPickup(kind) ? new Color3(0.3, 0.4, 0.35) : new Color3(0.12, 0.1, 0.08);
    root.material = mat;
    // The pickup is the heart or shield billboard, not a ball behind it.
    if (isPickup(kind)) root.isVisible = false;

    // World-space badge. Parenting it to the tumbling rock swung the number behind the mesh.
    const labelPlane = CreatePlane(`label-${id}`, { size: 1.35 }, this.scene);
    labelPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    labelPlane.renderingGroupId = 3;
    labelPlane.isPickable = true;
    const texture = new DynamicTexture(`labelTex-${id}`, { width: LABEL_PX, height: LABEL_PX }, this.scene, false);
    texture.hasAlpha = true;
    texture.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    const labelMat = new StandardMaterial(`labelMat-${id}`, this.scene);
    labelMat.diffuseTexture = texture;
    labelMat.emissiveTexture = texture;
    labelMat.opacityTexture = texture;
    labelMat.useAlphaFromDiffuseTexture = true;
    labelMat.disableLighting = true;
    labelMat.disableDepthWrite = true;
    labelMat.backFaceCulling = false;
    labelMat.transparencyMode = Material.MATERIAL_ALPHABLEND;
    labelPlane.material = labelMat;

    const body: BodyMesh = { root, labelPlane, texture, label, kind, selected: false, baseDiffuse, baseEmissive };
    this.paintLabel(body, label, false);
    this.bodies.set(id, body);
    return body;
  }

  private paintLabel(body: BodyMesh, label: number, selected: boolean): void {
    const ctx = body.texture.getContext() as unknown as CanvasRenderingContext2D;
    const s = LABEL_PX;
    const c = s / 2;
    ctx.clearRect(0, 0, s, s);
    if (body.kind === "shield" || body.kind === "life") {
      const life = body.kind === "life";
      const text = String(label);
      const shape = s * (life ? 0.46 : 0.42);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (life) traceHeart(ctx, c, c, shape);
      else traceShield(ctx, c, c, shape);
      ctx.fillStyle = life ? "#ff3b55" : "#2ad4a2";
      ctx.fill();
      ctx.lineWidth = selected ? 16 : 12;
      ctx.strokeStyle = selected ? "#ffe7a3" : life ? "#ffd5de" : "#e7fff6";
      ctx.stroke();
      const fontPx = text.length >= 3 ? 64 : text.length === 1 ? 96 : 80;
      ctx.font = `400 ${fontPx}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Heart digit is centered on the silhouette. Canvas "middle" draws the
      // ink a little high, so the anchor sits below the heart's midpoint.
      // Shield digit sits on the face, under the wide top.
      const textY = life ? c + shape * 0.106 + fontPx * 0.078 : c + shape * 0.1;
      ctx.lineWidth = 5;
      ctx.strokeStyle = life ? "#4a1020" : "#04382c";
      ctx.strokeText(text, c, textY);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, c, textY);
    } else {
      ctx.beginPath();
      ctx.arc(c, c, s * 0.42, 0, Math.PI * 2);
      const text = String(label);
      ctx.fillStyle = selected ? "rgba(255, 214, 96, 0.97)" : "rgba(6, 12, 28, 0.94)";
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = selected ? "#ffe7a3" : "#f7fbff";
      ctx.stroke();
      const fontPx = text.length >= 3 ? 78 : text.length === 1 ? 118 : 100;
      ctx.font = `400 ${fontPx}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = selected ? "#1a1408" : "#061018";
      ctx.strokeText(text, c, c + 4);
      ctx.fillStyle = selected ? "#1a1408" : "#ffffff";
      ctx.fillText(text, c, c + 4);
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
      const bodyScale = scale * (isPickup(b.kind) ? 0.9 : 1);
      mesh.root.scaling.setAll(bodyScale);
      // Upright badge centered on the rock, a touch toward the camera.
      // Pickup icons are larger so the heart or shield reads at a glance.
      mesh.labelPlane.position.set(b.x, b.y, b.z - 0.45);
      const iconScale = b.kind === "life" ? 1.82 : b.kind === "shield" ? 1.55 : 1;
      mesh.labelPlane.scaling.setAll(bodyScale * iconScale);
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
      } else if (b.kind === "life") {
        const pulse = 0.45 + Math.sin(this.time * 4) * 0.2;
        mat.emissiveColor = new Color3(pulse, 0.12, 0.16);
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
    if (this.starTex) {
      // Positive vOffset walks the field down the screen, toward the station.
      this.starTex.vOffset = (this.starTex.vOffset + dt * 0.006) % 1;
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
    const pick = this.scene.pick(x, y, (m) => this.bodyIdOf(m) !== null);
    if (!pick?.hit || !pick.pickedMesh) return null;
    return this.bodyIdOf(pick.pickedMesh);
  }

  /** Rock mesh or its number badge. The badge is not parented to the tumbling mesh. */
  private bodyIdOf(node: { name?: string; parent?: unknown } | null): string | null {
    let current = node;
    while (current) {
      const name = current.name;
      if (typeof name === "string") {
        if (name.startsWith("body-")) return name.slice(5);
        if (name.startsWith("label-")) return name.slice(6);
      }
      current = (current.parent as { name?: string; parent?: unknown } | null) ?? null;
    }
    return null;
  }
}
