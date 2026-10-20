// Opt-in instrumentation records actual scene renders, not a separate RAF's FPS.
export const performanceMonitor = {
  frames: 0,
  samples: [],
  enabled: new URLSearchParams(location.search).has("perf"),
  lastTime: 0,
  recordFrame(time, info) {
    this.frames++;
    if (!this.enabled) return;
    if (this.lastTime) this.samples.push(time - this.lastTime);
    if (this.samples.length > 600) this.samples.shift();
    this.lastTime = time;
    this.drawCalls = info.render.calls;
    this.triangles = info.render.triangles;
    this.geometries = info.memory.geometries;
    this.textures = info.memory.textures;
  },
  snapshot() {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      frames: this.frames,
      medianMs: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      geometries: this.geometries,
      textures: this.textures,
    };
  },
};
