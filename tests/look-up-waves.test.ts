import { describe, expect, it } from "vitest";
import { answerMode, hazardSpawnBlocked, lifeCap, waveConfig } from "../src/games/look-up/waves";

describe("look-up lives and hazard cap", () => {
  it("caps lives by wave", () => {
    expect(lifeCap(1)).toBe(3);
    expect(lifeCap(3)).toBe(3);
    expect(lifeCap(4)).toBe(4);
    expect(lifeCap(6)).toBe(4);
    expect(lifeCap(7)).toBe(5);
    expect(lifeCap(9)).toBe(5);
    expect(lifeCap(10)).toBe(5);
    expect(lifeCap(11)).toBe(6);
    expect(lifeCap(12)).toBe(6);
    expect(lifeCap(0)).toBe(3);
  });

  it("uses four choices on Easy, Normal, and Hard, and a typed divisor on Hardcore", () => {
    expect(answerMode("easy")).toBe("choices");
    expect(answerMode("normal")).toBe("choices");
    expect(answerMode("hard")).toBe("choices");
    expect(answerMode("custom")).toBe("choices");
    expect(answerMode("hardcore")).toBe("entry");
  });

  it("opens wave 1 wide enough for a clean break and a shard split", () => {
    for (const difficulty of ["easy", "normal", "hard", "hardcore"] as const) {
      const cfg = waveConfig(1, difficulty);
      expect(cfg.maxValue).toBeGreaterThanOrEqual(24);
      expect(cfg.minValue).toBeLessThanOrEqual(8);
    }
  });

  it("stops new asteroids once six hazards are in play", () => {
    expect(hazardSpawnBlocked(5)).toBe(false);
    expect(hazardSpawnBlocked(6)).toBe(true);
    expect(hazardSpawnBlocked(7)).toBe(true);
  });
});
