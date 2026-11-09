// Rotation speeds use OrbitControls units (1 = 6 degrees/second).
// Response times are seconds; scroll speed is viewport heights/second.
export const CELL_ROTATION = {
  baseline: 0.4,
  forwardBoost: 2.8,
  reverseBoost: 1.6,
  sensitivity: 0.8,
  maxScrollSpeed: 4,
  inputResponse: 0.12,
  releaseDelay: 0.06,
  acceleration: 0.24,
  reverseResponse: 0.42,
  release: 0.65,
};

const damp = (current, target, delta, response) =>
  target + (current - target) * Math.exp(-delta / response);

export class CellRotation {
  constructor(scrollY) {
    this.reset(scrollY);
  }

  reset(scrollY) {
    this.scrollY = scrollY;
    this.velocity = 0;
    this.idleTime = 0;
    this.speed = CELL_ROTATION.baseline;
  }

  update(scrollY, delta, viewportHeight, active = true) {
    if (!active) {
      this.reset(scrollY);
      return this.speed;
    }
    if (delta <= 0) return this.speed;
    const c = CELL_ROTATION;
    const distance = scrollY - this.scrollY;
    this.scrollY = scrollY;
    const velocity = distance / Math.max(1, viewportHeight) / delta;
    this.idleTime = distance ? 0 : this.idleTime + delta;
    // Filter before limiting: a 30 Hz touch sample can span several 144 Hz
    // frames. Clamping individual samples would discard that scroll distance.
    this.velocity = Math.max(
      -c.maxScrollSpeed,
      Math.min(
        c.maxScrollSpeed,
        damp(this.velocity, velocity, delta, c.inputResponse),
      ),
    );
    const boost = this.velocity < 0 ? c.reverseBoost : c.forwardBoost;
    const target =
      c.baseline + Math.tanh(this.velocity * c.sensitivity) * boost;
    const response =
      this.idleTime >= c.releaseDelay
        ? c.release
        : target < 0
          ? c.reverseResponse
          : c.acceleration;
    this.speed = damp(this.speed, target, delta, response);
    return this.speed;
  }
}
