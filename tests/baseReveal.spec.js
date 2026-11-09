import { test, expect } from "@playwright/test";
import { ready } from "./helpers.js";

for (const mobile of [false, true]) {
  test(`base stays out of the zoom and fades in during the turn (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    const result = await page.evaluate(() => {
      const app = window.taxaDebug.app;
      cancelAnimationFrame(app.animationFrameId);
      app.isInitialized = false;
      const dimensions = () =>
        app.timeline.sections.map((section) => [
          section.offsetTop,
          section.offsetHeight,
        ]);
      const before = dimensions();
      const { top, height } = app.timeline.bounds[3];
      const sample = (progress) => {
        app.timeline.update(top + (height - innerHeight) * progress);
        const meshes = ["tube", "bottom_dial", "dark-adapter"].map((name) => {
          const mesh = app.product.root.getObjectByName(name);
          return {
            visible: mesh.visible,
            opacity: mesh.material.opacity,
            transparent: mesh.material.transparent,
          };
        });
        return {
          meshes,
          capY: app.product.applicator.position.y,
          capTurn: app.product.applicator.rotation.y,
        };
      };
      const progress = [
        0.32, 0.55, 0.6999, 0.7001, 0.725, 0.775, 0.825, 0.85, 0.9, 0.925, 0.95,
        0.975, 1,
      ];
      // Start at the final pose: direct entry and reverse seeks must also work.
      sample(1);
      const forward = progress.map(sample);
      const reverse = [...progress].reverse().map(sample).reverse();
      return { before, after: dimensions(), forward, reverse };
    });
    expect(result.after).toEqual(result.before);
    expect(result.reverse).toEqual(result.forward);
    for (const frame of result.forward.slice(0, 3)) {
      for (const mesh of frame.meshes) {
        expect(mesh.visible).toBe(false);
        expect(mesh.opacity).toBe(0);
      }
    }
    const fading = result.forward.slice(3, 7);
    for (const frame of fading) {
      for (const mesh of frame.meshes) {
        expect(mesh.visible).toBe(true);
        expect(mesh.transparent).toBe(true);
        expect(mesh.opacity).toBeGreaterThan(0);
        expect(mesh.opacity).toBeLessThan(1);
      }
    }
    expect(fading[0].meshes[0].opacity).toBeLessThan(0.00001);
    expect(fading[2].meshes[0].opacity).toBeCloseTo(0.5);
    for (let i = 1; i < fading.length; i++)
      expect(fading[i].meshes[0].opacity).toBeGreaterThan(
        fading[i - 1].meshes[0].opacity,
      );
    for (const frame of result.forward.slice(7))
      for (const mesh of frame.meshes)
        expect(mesh).toEqual({ visible: true, opacity: 1, transparent: false });
    const [raised, lowering, seated, turning, locked] = result.forward.slice(8);
    expect(raised.capY).toBeCloseTo(1);
    expect(lowering.capY).toBeCloseTo(0.5);
    expect(seated.capY).toBeCloseTo(0);
    expect(seated.capTurn).toBeCloseTo(0);
    expect(turning.capTurn).toBeCloseTo(Math.PI * 0.13);
    expect(locked.capTurn).toBeCloseTo(Math.PI * 0.26);
  });
}
