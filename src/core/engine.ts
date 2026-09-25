import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";

export interface BabylonSetup {
  engine: Engine;
  scene: Scene;
  dispose(): void;
}

/** Creates an engine + scene bound to `canvas` that tracks its size. */
export function createBabylon(canvas: HTMLCanvasElement, clearColor: Color4): BabylonSetup {
  const engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false }, true);
  const scene = new Scene(engine);
  scene.clearColor = clearColor;
  scene.skipPointerMovePicking = true;

  const resizeObserver = new ResizeObserver(() => engine.resize());
  resizeObserver.observe(canvas);

  return {
    engine,
    scene,
    dispose: () => {
      resizeObserver.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
