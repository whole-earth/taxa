import { test, expect } from "@playwright/test";
import { CellRotation } from "../js/effects/cellRotation.js";
import { ready, seek } from "./helpers.js";

function drive(rotation, velocity, seconds, hz = 60, height = 900) {
  const speeds = [];
  let y = rotation.scrollY;
  for (let i = 0; i < seconds * hz; i++) {
    y += (velocity * height) / hz;
    speeds.push(rotation.update(y, 1 / hz, height));
  }
  return speeds;
}

test("cell rotation brakes before reversing, limits reverse speed and returns to baseline", () => {
  const rotation = new CellRotation(0);
  const baseline = rotation.speed;
  const forward = drive(rotation, 1, 3);
  const reverse = drive(rotation, -1, 3);
  const resume = drive(rotation, 1, 3);
  const released = drive(rotation, 0, 6);
  expect(forward.at(-1)).toBeGreaterThan(baseline);
  expect(reverse[0]).toBeGreaterThan(0);
  expect(reverse.at(-1)).toBeLessThan(0);
  expect(Math.abs(reverse.at(-1))).toBeLessThan(forward.at(-1));
  expect(resume[0]).toBeLessThan(0);
  expect(resume.at(-1)).toBeGreaterThan(baseline);
  expect(released.at(-1)).toBeCloseTo(baseline, 3);
  for (const speeds of [reverse, resume]) {
    const crossing = speeds.findIndex((speed) => speed * speeds[0] <= 0) / 60;
    expect(crossing).toBeGreaterThan(0.1);
    expect(crossing).toBeLessThan(2);
  }
  const speeds = [...forward, ...reverse, ...resume, ...released];
  for (let i = 1; i < speeds.length; i++)
    expect(Math.abs(speeds[i] - speeds[i - 1])).toBeLessThan(0.15);
});

test("cell scroll response is consistent across refresh rates and viewport sizes", () => {
  const profiles = [];
  for (const hz of [30, 60, 120, 144]) {
    for (const height of [844, 900]) {
      const rotation = new CellRotation(0);
      profiles.push(
        [1, 1, -1, -1, 1, 1, 0, 0, 0].map((velocity) =>
          drive(rotation, velocity, 1, hz, height).at(-1),
        ),
      );
    }
  }
  for (const profile of profiles)
    for (let i = 0; i < profile.length; i++)
      expect(Math.abs(profile[i] - profiles[0][i])).toBeLessThan(0.03);
});

test("scroll jumps are bounded and suspended rotation discards momentum", () => {
  const rotation = new CellRotation(0);
  const baseline = rotation.speed;
  for (const velocity of [1000, -1000]) {
    const speeds = drive(rotation, velocity, 3);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(3.2);
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(-1.2);
  }
  rotation.update(10000, 1 / 60, 900, false);
  expect(rotation.speed).toBe(baseline);
  expect(rotation.update(10000, 1 / 60, 900)).toBe(baseline);
});

for (const mobile of [false, true]) {
  test(`rotation resumes after programmatically paused scrolling and stays off through product closure (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(() => {
      const app = window.taxaDebug.app;
      app.motionPaused = !app.motionPaused;
      app.invalidate(true);
    });
    await seek(page, "zoom", 0.2);
    await page.evaluate(() => {
      const app = window.taxaDebug.app;
      app.motionPaused = !app.motionPaused;
      app.invalidate(true);
    });
    await page.waitForFunction(() => {
      const app = window.taxaDebug.app;
      return !app.motionPaused && app.sceneManager.controls.autoRotate;
    });
    const before = await page.evaluate(() =>
      window.taxaDebug.app.sceneManager.camera.position.toArray(),
    );
    await page.waitForFunction(
      (before) =>
        window.taxaDebug.app.sceneManager.camera.position
          .toArray()
          .some((value, i) => Math.abs(value - before[i]) > 0.01),
      before,
    );
    await seek(page, "product", 0.99);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    expect(
      await page.evaluate(
        () => window.taxaDebug.app.sceneManager.controls.autoRotate,
      ),
    ).toBe(false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seek(page, "splash");
    expect(
      await page.evaluate(
        () => window.taxaDebug.app.sceneManager.controls.autoRotate,
      ),
    ).toBe(false);
  });
}

test("sparse touch samples retain their motion on high-refresh screens", () => {
  const results = [];
  for (const hz of [30, 60, 120, 144]) {
    const rotation = new CellRotation(0);
    let integral = 0;
    for (let i = 1; i <= hz * 3; i++) {
      const y = (Math.floor((i / hz) * 30 + 1e-8) / 30) * 900;
      integral += rotation.update(y, 1 / hz, 900) / hz;
    }
    results.push(integral);
  }
  for (const result of results)
    expect(Math.abs(result / results[0] - 1)).toBeLessThan(0.02);
});

test("actual camera inertia stays consistent across display refresh rates", async ({
  page,
}) => {
  await ready(page);
  const angles = await page.evaluate(() => {
    const app = window.taxaDebug.app;
    cancelAnimationFrame(app.animationFrameId);
    app.isInitialized = false;
    app.scroller.raf = () => {};
    app.sceneManager.render = () => true;
    const controls = app.sceneManager.controls;
    const camera = app.sceneManager.camera;
    const results = [];
    for (const hz of [30, 60, 120, 144]) {
      controls.autoRotate = false;
      controls.enableDamping = false;
      controls.update();
      camera.position.set(0, 0, 60);
      controls.update();
      controls.enableDamping = true;
      controls.autoRotate = true;
      app.timeline.rotation.reset(0);
      let y = 0;
      const start = performance.now();
      app.lastActivity = start;
      app.lastFrameTime = start;
      for (let i = 1; i <= hz * 9; i++) {
        const t = (i - 1) / hz;
        y += ((t < 2 ? 1 : t < 4 ? -1 : t < 6 ? 1 : 0) * 900) / hz;
        app.timeline.lastScrollY = y;
        app.needsTimelineUpdate = false;
        app.frame(start + (i * 1000) / hz);
      }
      results.push(controls.getAzimuthalAngle());
    }
    return results;
  });
  for (const angle of angles)
    expect(Math.abs(angle - angles[0])).toBeLessThan(0.02);
});
