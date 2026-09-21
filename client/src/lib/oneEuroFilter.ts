// One Euro Filter — a lightweight low-pass filter tuned for interactive, low-latency
// signals (Casiez, Roussel, Vogel 2012). It removes camera/tracking jitter while
// staying responsive to fast, intentional motion, which is exactly the trade-off
// a hand-drawing canvas needs: shaky "hold still" noise gone, quick strokes intact.
class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number) {
    if (this.y === null) {
      this.s = value;
    } else {
      this.s = alpha * value + (1 - alpha) * (this.s as number);
    }
    this.y = value;
    return this.s as number;
  }

  lastRaw() {
    return this.y;
  }
}

function smoothingAlpha(cutoff: number, dt: number) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(minCutoff = 1.2, beta = 0.35, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(value: number, timestampMs: number) {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      this.xFilter.filter(value, 1);
      return value;
    }
    const dt = Math.max((timestampMs - this.lastTime) / 1000, 1 / 120);
    this.lastTime = timestampMs;

    const previousRaw = this.xFilter.lastRaw();
    const derivative = previousRaw === null ? 0 : (value - previousRaw) / dt;
    const edx = this.dxFilter.filter(derivative, smoothingAlpha(this.dCutoff, dt));

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(value, smoothingAlpha(cutoff, dt));
  }

  reset() {
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    this.lastTime = null;
  }
}

/** Filters a full 21-point hand landmark set (x, y, z each get their own filter state). */
export class LandmarkSmoother {
  private filters: { x: OneEuroFilter; y: OneEuroFilter; z: OneEuroFilter }[] = [];

  constructor(private minCutoff = 1.2, private beta = 0.35) {}

  smooth(points: { x: number; y: number; z: number }[], timestampMs: number) {
    if (this.filters.length !== points.length) {
      this.filters = points.map(() => ({
        x: new OneEuroFilter(this.minCutoff, this.beta),
        y: new OneEuroFilter(this.minCutoff, this.beta),
        z: new OneEuroFilter(this.minCutoff, this.beta),
      }));
    }
    return points.map((point, index) => {
      const f = this.filters[index];
      return {
        x: f.x.filter(point.x, timestampMs),
        y: f.y.filter(point.y, timestampMs),
        z: f.z.filter(point.z, timestampMs),
      };
    });
  }

  reset() {
    this.filters = [];
  }
}
