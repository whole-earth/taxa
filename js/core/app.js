import * as THREE from "three";
import Lenis from "lenis";
import { Group as TweenGroup } from "tween";
import { createCellMaterials } from "./cellMaterials.js";
import { SceneManager } from "./sceneManager.js";
import { loadCellModel } from "../models/cell.js";
import { loadProductModel } from "../models/product.js";
import { disposeModelLoader } from "../models/loader.js";
import { SpeckleSystem } from "../effects/speckles.js";
import { ZoomStreaks } from "../effects/zoomStreaks.js";
import { CELL_ROTATION } from "../effects/cellRotation.js";
import { PodSelector } from "../effects/podSelector.js";
import { StoryTimeline } from "./timeline.js";
import { disposeScene } from "../utils/dispose.js";
import { performanceMonitor } from "../utils/performance.js";
import { LoadingStatus } from "../ui/loadingStatus.js";
import { InactivityOverlay } from "../ui/inactivityOverlay.js";
import { ProductFallback } from "../ui/productFallback.js";

const IDLE_TIMEOUT = 40000;

export class StoryApp {
  constructor({
    assetBase = new URL("assets/", document.baseURI),
    webflow = false,
    onFirstFrame = () => {},
  } = {}) {
    this.assetBase = assetBase;
    this.webflow = webflow;
    this.onFirstFrame = onFirstFrame;
    this.isMobile = window.innerWidth < 768;
    this.motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.motionPaused = false;
    this.overlayActive = false;
    this.events = new AbortController();
    this.loadingStatus = new LoadingStatus({
      signal: this.events.signal,
      onRetry: () => {
        this.productError = null;
        this.loadingStatus.hide();
        this.prepareProduct();
      },
    });
    this.firstFrame = new Promise((resolve) => {
      this.resolveFirstFrame = resolve;
    });
    this.animationFrameId = null;
    this.lastFrameTime = null;
    this.lastRenderSlot = null;
    this.lastActivity = performance.now();
    this.idleTimer = null;
    this.inactivityOverlay = new InactivityOverlay(() => {
      this.lastActivity = performance.now();
      this.invalidate();
    }, this.events.signal);
    this.needsRender = true;
    this.needsTimelineUpdate = true;
    this.disposed = false;
    this.frame = this.frame.bind(this);
    this.tweens = new TweenGroup();
    this.sceneManager = new SceneManager(
      {
        lighting: { ambientIntensity: 4, envMapIntensity: 1 },
        renderer: {
          antialias: !this.isMobile,
          alpha: true,
          powerPreference: "high-performance",
          precision: "mediump",
          stencil: false,
        },
        camera: {
          fov: this.isMobile ? 90 : 60,
          near: 0.5,
          far: 2000,
          position: [0, 0, 60],
        },
        controls: {
          dampingFactor: 0.03,
          autoRotateSpeed: CELL_ROTATION.baseline,
          rotateSpeed: 0.8,
        },
        assets: { envMap: new URL("cell/reflections.bin", assetBase).href },
      },
      () => this.invalidate(true),
    );
    this.cellGroup = new THREE.Group();
    this.sceneManager.scene.add(this.cellGroup);
    this.productFallback = new ProductFallback(this);
    this.setupEvents();
  }

  async init() {
    this.ambientLight = this.sceneManager.initLights();
    const progress = new Map();
    const updateProgress = (name, event) => {
      if (this.disposed || this.sceneManager.contextLost) return;
      if (event.lengthComputable)
        progress.set(name, event.loaded / event.total);
      const value = Math.round(
        ([...progress.values()].reduce((a, b) => a + b, 0) / 3) * 100,
      );
      this.loadingStatus.show(`Loading the microbiome… ${value}%`);
    };
    const materials = createCellMaterials(this.isMobile);
    [this.innerCell, this.cellShell, this.ribbons] = await Promise.all(
      [
        ["blob-inner.glb", materials.inner, 0],
        ["blob-outer.glb", materials.shell, 2],
        ["ribbons.glb", materials.ribbons, 3],
      ].map(async ([file, material, order]) => {
        let model;
        try {
          model = await loadCellModel(file, {
            assetBase: this.assetBase,
            material,
            renderOrder: order,
            onProgress: (event) => updateProgress(file, event),
          });
        } catch (error) {
          material.dispose();
          throw error;
        }
        // Take ownership as each sibling resolves, including after another
        // load has failed and the app has already been disposed.
        if (this.disposed) disposeScene(model.root);
        else this.cellGroup.add(model.root);
        return model;
      }),
    );
    if (this.disposed) return;
    // Keep traversal order independent of network completion order.
    this.cellGroup.add(
      this.innerCell.root,
      this.cellShell.root,
      this.ribbons.root,
    );
    const size = this.innerCell.bounds.getSize(new THREE.Vector3());
    this.speckles = new SpeckleSystem(
      this,
      Math.max(size.x, size.y, size.z) * 0.48,
      this.cellGroup,
    );
    this.zoomStreaks = new ZoomStreaks();
    this.zoomStreaks.visible = false;
    this.zoomStreaks.position.set(0, 0, -20);
    this.sceneManager.camera.add(this.zoomStreaks);
    this.sceneManager.scene.add(this.sceneManager.camera);
    await this.sceneManager.environmentReady;
    if (this.sceneManager.environmentError)
      throw this.sceneManager.environmentError;
    if (this.disposed) return;
    // Cell downloads are finished. Fetch the product while the GPU prepares
    // the hero, but defer parsing and product GPU work until its first frame.
    this.prepareProduct();
    // Warm shader programs before the first visible frame. This uses parallel
    // GPU compilation where supported, with the environment already available.
    await this.sceneManager.warmMaterials(this.sceneManager.scene);
    await this.sceneManager.waitForContext();
    if (this.disposed) return;
    this.scroller = new Lenis({
      autoRaf: false,
      duration: 1.8,
      wheelMultiplier: 0.8,
      smoothWheel: !this.reducedMotion,
      syncTouch: false,
    });
    this.scroller.on("scroll", () => this.invalidate(true));
    this.timeline = new StoryTimeline(this);
    this.podSelector = new PodSelector(this);
    this.isInitialized = true;
    this.loadingStatus.hide();
    document.fonts.ready.then(() => {
      if (!this.disposed) this.timeline.measure();
    });
    const hash = location.hash.slice(1);
    const chapter = ["splash", "zoom", "pitch", "product"].indexOf(hash);
    if (chapter >= 0) this.timeline.goTo(chapter);
    this.invalidate(true);
  }

  prepareProduct() {
    if (this.disposed || this.productPromise || this.productError) return;
    // One shared promise prevents scroll bursts from starting duplicate loads.
    this.productPromise = loadProductModel("swap.glb", {
      assetBase: this.assetBase,
      renderOrder: 200,
      compressed: true,
      parseAfter: this.firstFrame,
      signal: this.events.signal,
    })
      .then(async (product) => {
        try {
          if (this.disposed) return;
          await this.sceneManager.warmProduct(product);
          if (this.disposed) return;
          const anchor = await this.sceneManager.warmProductFrames(
            product,
            this.cellGroup,
            this.zoomStreaks,
          );
          if (this.disposed) return;
          this.product = product;
          this.productAnchor = anchor;
          this.sceneManager.scene.add(this.productAnchor);
          this.loadingStatus.hide();
          this.invalidate(true);
        } finally {
          if (this.product !== product) {
            product.root.removeFromParent();
            disposeScene(product.root);
          }
        }
      })
      .catch(async (error) => {
        // A background product failure must not replace the hero's loading UI.
        await this.firstFrame;
        if (this.disposed) return;
        this.productError = error;
        this.productPromise = null;
        this.loadingStatus.show("The product could not load.", true);
      });
  }

  invalidate(updateTimeline = false) {
    if (this.disposed) return;
    this.needsRender = true;
    this.needsTimelineUpdate ||= updateTimeline;
    if (
      this.isInitialized &&
      !document.hidden &&
      !this.sceneManager.contextLost &&
      this.animationFrameId === null
    ) {
      this.animationFrameId = requestAnimationFrame(this.frame);
    }
  }

  frame(time) {
    this.animationFrameId = null;
    if (this.disposed || document.hidden || this.sceneManager.contextLost)
      return;
    const delta =
      this.lastFrameTime === null
        ? 1 / 60
        : Math.min(0.05, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;
    this.scroller.raf(time);
    if (this.needsTimelineUpdate) {
      this.needsTimelineUpdate = false;
      this.timeline.update(window.scrollY);
    }
    // Preserve unstarted chained tweens, remove only those that completed.
    // Tween.js update(time, false) would auto-start the entire chain at once.
    const tweening = !this.tweens.allStopped();
    if (tweening) {
      const playing = this.tweens.getAll().filter((tween) => tween.isPlaying());
      this.tweens.update(time);
      for (const tween of playing)
        if (!tween.isPlaying()) this.tweens.remove(tween);
    }
    this.ribbons.root.visible = this.timeline.ribbonMaterial.opacity > 0;
    for (const mesh of this.speckles.meshes)
      mesh.visible = mesh.material.opacity > 0;
    const idle = time - this.lastActivity >= IDLE_TIMEOUT;
    if (!idle) this.scheduleIdleCheck();
    const nearBottom =
      idle &&
      document.documentElement.scrollHeight - scrollY - innerHeight <= 40;
    this.inactivityOverlay.setVisible(
      idle &&
        !nearBottom &&
        !this.overlayActive &&
        !this.motionPaused &&
        !this.reducedMotion,
    );
    const continuous =
      !idle && !this.motionPaused && !this.reducedMotion && !this.overlayActive;
    this.timeline.tick(delta, continuous);
    const controls = this.sceneManager.controls;
    const configuredRotation = controls.autoRotate;
    controls.autoRotate = configuredRotation && continuous;
    // Keep the existing 60 Hz drag feel, with the same damping time on
    // high-refresh screens instead of consuming inertia once per frame.
    controls.dampingFactor =
      1 - (1 - this.sceneManager.config.controls.dampingFactor) ** (delta * 60);
    const cameraChanged = controls.update(delta);
    controls.autoRotate = configuredRotation;
    const particles = continuous && this.speckles.canAnimate;
    if (particles) this.speckles.rotateGroups(time);
    if (this.productAnchor && (cameraChanged || this.needsRender || tweening))
      this.productAnchor.lookAt(this.sceneManager.camera.position);
    // High-refresh displays can request 120+ full-resolution transmission
    // frames/sec and saturate the GPU command queue. Update motion at the
    // display cadence, but submit at most 60 scene renders/sec. Preserve dirty
    // state until it is actually drawn, including a tween's final frame.
    this.needsRender ||= cameraChanged || particles || tweening;
    const frameInterval = 1000 / 60;
    const renderDue =
      this.lastRenderSlot === null ||
      time - this.lastRenderSlot >= frameInterval - 0.5;
    if (this.needsRender && renderDue) {
      this.needsRender = false;
      // Keep the fractional remainder. Resetting the clock to `time` on each
      // draw accidentally limits 90 Hz screens to 45 fps and 144 Hz to 48 fps.
      // Skip missed slots after a stall; never submit catch-up render bursts.
      this.lastRenderSlot =
        this.lastRenderSlot === null
          ? time
          : this.lastRenderSlot +
            Math.max(
              1,
              Math.floor((time - this.lastRenderSlot + 0.5) / frameInterval),
            ) *
              frameInterval;
      if (this.sceneManager.render() === false) {
        this.needsRender = true;
        this.resetFrameClock();
        return;
      }
      this.productFallback.onFrame();
      if (!this.sceneRevealed) {
        // Reveal only after the first story frame, never an empty canvas or
        // a temporary shader-warming pose. CSS handles the original fade.
        this.sceneRevealed = true;
        this.onFirstFrame();
        // Yield a task so product parsing cannot run inside this first RAF.
        setTimeout(() => this.resolveFirstFrame?.(), 0);
      }
      performanceMonitor.recordFrame(time, this.sceneManager.renderer.info);
    }
    const moving = continuous && (configuredRotation || particles);
    if (
      moving ||
      !this.tweens.allStopped() ||
      // Native scrolling supplies its own events. Lenis 1.3 can retain its
      // "native" flag after a zero-distance event; that must not keep drawing.
      this.scroller.isScrolling === "smooth" ||
      cameraChanged ||
      this.needsRender
    )
      this.invalidate();
    else this.resetFrameClock();
  }

  scheduleIdleCheck() {
    if (this.idleTimer !== null) return;
    // One deadline wakes even a static scene; activity does not churn timers.
    this.idleTimer = setTimeout(
      () => {
        this.idleTimer = null;
        if (this.disposed || document.hidden) return;
        if (performance.now() - this.lastActivity < IDLE_TIMEOUT)
          this.scheduleIdleCheck();
        else this.invalidate();
      },
      Math.max(0, IDLE_TIMEOUT - (performance.now() - this.lastActivity)),
    );
  }

  resetFrameClock() {
    this.lastFrameTime = null;
    this.timeline?.rotation.reset(window.scrollY);
    performanceMonitor.resetClock();
  }

  updateMotionPreference() {
    this.reducedMotion = this.motionQuery.matches;
    if (this.scroller) {
      this.scroller.options.smoothWheel = !this.reducedMotion;
      if (this.reducedMotion) {
        const scroller = this.scroller;
        // Lenis 1.3 updates targetScroll to each intermediate programmatic
        // position. Preserve our chapter destination; native scrolling should
        // retain the actual position rather than a stale cached target.
        const target =
          scroller.isScrolling === "smooth"
            ? (scroller.userData?.storyTarget ?? scroller.targetScroll)
            : scroller.actualScroll;
        const wasStopped = scroller.isStopped;
        scroller.stop();
        if (!wasStopped) scroller.start();
        scroller.scrollTo(target, { immediate: true, force: true });
        this.timeline?.update(scroller.animatedScroll);
      }
    }
    if (this.reducedMotion) {
      // Complete chains in order, including the dot reveal queued by fade-out.
      // Every story tween is finite; completion also restores pod controls.
      while (!this.tweens.allStopped()) {
        for (const tween of this.tweens.getAll()) {
          if (!tween.isPlaying()) continue;
          // end() can round (start + duration) - start below duration,
          // skipping completion callbacks. These finite tweens must finish.
          tween.update(Infinity);
          this.tweens.remove(tween);
        }
      }
      for (const label of this.podSelector?.labels ?? [])
        for (const animation of label.getAnimations()) animation.finish();
    }
    this.invalidate(true);
  }

  setupEvents() {
    const signal = this.events.signal;
    const activity = (event) => {
      const now = performance.now();
      const wasIdle = now - this.lastActivity > IDLE_TIMEOUT;
      this.lastActivity = now;
      // Mouse movement over a static product changes nothing on the canvas.
      // Wheel/touch must wake Lenis even when no native scroll has fired yet.
      if (wasIdle || event.type !== "pointermove") this.invalidate();
    };
    ["pointerdown", "pointermove", "wheel", "touchstart", "keydown"].forEach(
      (type) =>
        window.addEventListener(type, activity, { passive: true, signal }),
    );
    window.addEventListener(
      "scroll",
      () => {
        this.lastActivity = performance.now();
        this.invalidate(true);
      },
      { passive: true, signal },
    );
    window.addEventListener(
      "resize",
      () => {
        this.isMobile = innerWidth < 768;
        if (this.timeline) {
          this.timeline.setMobile(this.isMobile);
          this.timeline.measure();
        }
      },
      { passive: true, signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
          this.resetFrameClock();
        } else {
          this.lastActivity = performance.now();
          this.invalidate(true);
        }
      },
      { signal },
    );
    this.sceneManager.controls.addEventListener("change", () =>
      this.invalidate(),
    );
    this.motionQuery.addEventListener(
      "change",
      () => this.updateMotionPreference(),
      { signal },
    );
    this.sceneManager.renderer.domElement.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        this.resetFrameClock();
        this.sceneManager.loseContext();
        this.loadingStatus.show("Restoring the animation…");
      },
      { signal },
    );
    this.sceneManager.renderer.domElement.addEventListener(
      "webglcontextrestored",
      () => {
        this.sceneManager.restoreContext();
        if (this.isInitialized) {
          if (this.productError)
            this.loadingStatus.show("The product could not load.", true);
          else this.loadingStatus.hide();
        }
        this.invalidate(true);
      },
      { signal },
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.resolveFirstFrame();
    cancelAnimationFrame(this.animationFrameId);
    this.events.abort();
    clearTimeout(this.idleTimer);
    this.inactivityOverlay.dispose();
    this.scroller?.destroy();
    this.tweens.removeAll();
    this.productFallback.dispose();
    disposeModelLoader();
    this.sceneManager.dispose();
  }
}
