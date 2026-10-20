import * as THREE from "three";
import Lenis from "lenis";
import { Group as TweenGroup } from "tween";
import { createCellMaterials } from "./cellMaterials.js";
import { SceneManager } from "./sceneManager.js";
import { loadCellModel } from "../models/cell.js";
import { loadProductModel } from "../models/product.js";
import { disposeModelLoader } from "../models/loader.js";
import { SpeckleSystem } from "../effects/speckles.js";
import { StarField, starfieldParams } from "../effects/starfield.js";
import { PodSelector } from "../effects/podSelector.js";
import { StoryTimeline } from "./timeline.js";
import { disposeScene } from "../utils/dispose.js";
import { performanceMonitor } from "../utils/performance.js";
import { LoadingStatus } from "../ui/loadingStatus.js";

export class StoryApp {
  constructor() {
    this.isMobile = window.innerWidth < 768;
    this.motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.motionPaused = false;
    this.overlayActive = false;
    this.loadingStatus = new LoadingStatus();
    this.events = new AbortController();
    this.animationFrameId = null;
    this.lastFrameTime = null;
    this.lastRenderSlot = null;
    this.lastActivity = performance.now();
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
        controls: { dampingFactor: 0.03, autoRotateSpeed: 0.4 },
        assets: { envMap: "assets/cell/aloe.hdr" },
      },
      () => this.invalidate(true),
    );
    this.cellGroup = new THREE.Group();
    this.sceneManager.scene.add(this.cellGroup);
    this.setupEvents();
  }

  async init() {
    this.ambientLight = this.sceneManager.initLights();
    const progress = new Map();
    const updateProgress = (name, event) => {
      if (this.disposed) return;
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
      ].map(([file, material, order]) =>
        loadCellModel(file, {
          material,
          renderOrder: order,
          onProgress: (event) => updateProgress(file, event),
        }),
      ),
    );
    if (this.disposed) return;
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
    this.starField = new StarField(starfieldParams);
    this.starField.visible = false;
    this.starField.position.set(0, 0, -20);
    this.sceneManager.camera.add(this.starField);
    this.sceneManager.scene.add(this.sceneManager.camera);
    await this.sceneManager.environmentReady;
    if (this.sceneManager.environmentError)
      throw this.sceneManager.environmentError;
    if (this.disposed) return;
    // Warm shader programs before the first visible frame. This uses parallel
    // GPU compilation where supported, with the environment already available.
    await this.sceneManager.warmMaterials(this.sceneManager.scene);
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
    // Start low-priority preparation after the hero is available, so first
    // product use need not allocate GPU resources during the scroll handoff.
    const prepare = () => {
      if (!this.disposed) this.preloadProduct();
    };
    if (window.requestIdleCallback)
      window.requestIdleCallback(prepare, { timeout: 1500 });
    else setTimeout(prepare, 300);
  }

  preloadProduct() {
    if (this.productPromise || this.productError) return;
    // One shared promise prevents scroll bursts from starting duplicate loads.
    this.productPromise = loadProductModel("swap.glb", { renderOrder: 200 })
      .then(async (product) => {
        if (this.disposed) {
          disposeScene(product.root);
          return;
        }
        await this.sceneManager.warmProduct(product);
        if (this.disposed) {
          disposeScene(product.root);
          return;
        }
        const anchor = await this.sceneManager.warmProductFrames(
          product,
          this.cellGroup,
          this.starField,
        );
        if (this.disposed) {
          disposeScene(product.root);
          return;
        }
        this.product = product;
        this.productAnchor = anchor;
        this.sceneManager.scene.add(this.productAnchor);
        this.loadingStatus.hide();
        this.invalidate(true);
      })
      .catch((error) => {
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
      this.animationFrameId === null
    ) {
      this.animationFrameId = requestAnimationFrame(this.frame);
    }
  }

  frame(time) {
    this.animationFrameId = null;
    if (this.disposed || document.hidden) return;
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
    this.timeline.tick(delta);
    this.ribbons.root.visible = this.timeline.ribbonMaterial.opacity > 0;
    for (const mesh of this.speckles.meshes)
      mesh.visible = mesh.material.opacity > 0;
    const idle = time - this.lastActivity > 40000;
    const continuous =
      !idle && !this.motionPaused && !this.reducedMotion && !this.overlayActive;
    const controls = this.sceneManager.controls;
    const configuredRotation = controls.autoRotate;
    controls.autoRotate = configuredRotation && continuous;
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
      this.sceneManager.render();
      if (!this.sceneRevealed) {
        // Reveal only after the first story frame, never an empty canvas or
        // a temporary shader-warming pose. CSS handles the original fade.
        this.sceneRevealed = true;
        document.body.classList.add("scene-ready");
      }
      performanceMonitor.recordFrame(time, this.sceneManager.renderer.info);
    }
    const moving = continuous && (configuredRotation || particles);
    if (
      moving ||
      !this.tweens.allStopped() ||
      this.scroller.isScrolling ||
      cameraChanged ||
      this.needsRender
    )
      this.invalidate();
    else this.lastFrameTime = null;
  }

  setupEvents() {
    const signal = this.events.signal;
    const activity = (event) => {
      const now = performance.now();
      const wasIdle = now - this.lastActivity > 40000;
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
          this.lastFrameTime = null;
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
      () => {
        this.reducedMotion = this.motionQuery.matches;
        this.invalidate(true);
      },
      { signal },
    );
    document.getElementById("motion-toggle").addEventListener(
      "click",
      (event) => {
        this.motionPaused = !this.motionPaused;
        event.currentTarget.textContent = this.motionPaused
          ? "Resume motion"
          : "Pause motion";
        event.currentTarget.setAttribute(
          "aria-pressed",
          String(this.motionPaused),
        );
        this.invalidate(true);
      },
      { signal },
    );
    document.getElementById("retry-load").addEventListener(
      "click",
      () => {
        this.productError = null;
        this.loadingStatus.hide();
        this.preloadProduct();
      },
      { signal },
    );
    this.sceneManager.renderer.domElement.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        this.isInitialized = false;
        this.loadingStatus.show("Restoring the animation…");
      },
      { signal },
    );
    this.sceneManager.renderer.domElement.addEventListener(
      "webglcontextrestored",
      () => {
        this.isInitialized = true;
        this.loadingStatus.hide();
        this.invalidate(true);
      },
      { signal },
    );
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrameId);
    this.events.abort();
    this.scroller?.destroy();
    this.tweens.removeAll();
    this.timeline?.dispose();
    disposeModelLoader();
    this.sceneManager.dispose();
  }
}
