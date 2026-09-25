const MIN_RADIUS = 1.3;
const MAX_RADIUS = 4.7;

/** Candle fuel (0..1) and the light radius it produces, in tiles. */
export class Candle {
  fuel = 1;
  /** Short-lived glow after a correct answer (0..1). */
  flare = 0;
  private shownRadius: number;

  constructor(private readonly lightScale = 1) {
    this.shownRadius = MAX_RADIUS * lightScale;
  }

  burn(dt: number, perSecond: number): void {
    this.fuel = Math.max(0, this.fuel - dt * perSecond);
  }

  add(amount: number): void {
    this.fuel = Math.max(0, Math.min(1, this.fuel + amount));
    if (amount > 0) this.flare = 1;
  }

  get isOut(): boolean {
    return this.fuel <= 0;
  }

  /** Smoothed radius with flicker; call once per frame. */
  radius(dt: number, time: number): number {
    this.flare = Math.max(0, this.flare - dt * 1.5);
    const target = (MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(this.fuel)) * this.lightScale + this.flare * 0.6;
    this.shownRadius += (target - this.shownRadius) * Math.min(1, dt * 6);
    const shaky = this.fuel < 0.25 ? 2.5 : 1;
    const flicker = 1 + shaky * (0.02 * Math.sin(time * 9.1) + 0.012 * Math.sin(time * 23.7));
    return this.shownRadius * flicker;
  }
}
