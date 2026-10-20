import * as THREE from "three";
import { PRODUCT_PHASE } from "./productConfig.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { PMREMGenerator } from "three";
import { disposeScene } from "../utils/dispose.js";

/**
 * Manages the Three.js scene, camera, renderer, and controls
 */
export class SceneManager {
  constructor(config, invalidate = () => {}) {
    this.invalidate = invalidate;
    this.config = config;
    this.contextLost = false;
    this.contextReady = Promise.resolve();
    this.compilations = new Map();
    this.scene = new THREE.Scene();
    this.camera = this.initCamera();
    this.transitionCamera = this.camera.clone(false);
    this.renderer = this.initRenderer();
    this.controls = this.initControls();

    this.setupEventListeners();
  }

  initCamera() {
    const { fov, near, far, position } = this.config.camera;
    const camera = new THREE.PerspectiveCamera(
      fov,
      window.innerWidth / window.innerHeight,
      near,
      far,
    );
    camera.position.set(...position);
    return camera;
  }

  initRenderer() {
    const renderer = new THREE.WebGLRenderer(this.config.renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.querySelector("#three").appendChild(renderer.domElement);
    return renderer;
  }

  initControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = this.config.controls.dampingFactor;
    controls.rotateSpeed = this.config.controls.rotateSpeed;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = this.config.controls.autoRotateSpeed;
    controls.target.set(0, 0, 0);
    controls.minPolarAngle = Math.PI / 2;
    controls.maxPolarAngle = Math.PI / 2;

    // Disable all touch interactions on mobile devices
    if (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    ) {
      controls.enabled = false; // This disables all interactions
      controls.enableRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.autoRotate = true; // Keep auto-rotation enabled
    }

    return controls;
  }

  setupEventListeners() {
    this.onResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.onResize, { passive: true });
  }

  handleResize() {
    this.camera.fov = window.innerWidth < 768 ? 90 : 60;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.invalidate();
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      this.config.lighting.ambientIntensity,
    );
    this.scene.add(ambientLight);

    const productLightRig = new THREE.Object3D();

    const spotLight = new THREE.SpotLight(0xebeeff, 20);
    spotLight.position.set(36, -50, 75);
    spotLight.visible = false;
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.decay = 0;
    spotLight.distance = 1000;

    // Add target that will move with the container
    const target = new THREE.Object3D();
    target.position.set(-44, 15, -20);
    productLightRig.add(target);
    spotLight.target = target;

    // Add spotlight to container
    productLightRig.add(spotLight);

    // No scene meshes cast or receive shadows. Avoid allocating and clearing
    // an empty shadow map whenever the product light becomes visible.
    spotLight.castShadow = false;

    this.productLight = spotLight;
    this.productLightRig = productLightRig;

    // Load environment map
    this.environmentReady = new RGBELoader()
      .loadAsync(this.config.assets.envMap)
      .then(async (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        // Retain the decoded HDR on the CPU so context recovery needs no
        // network request. The temporary GPU upload is released after PMREM.
        this.environmentSource = texture;
        await this.waitForContext();
        if (this.disposed) return;
        if (!this.environmentTarget) this.rebuildEnvironment();
        this.invalidate();
      })
      .catch((error) => {
        this.environmentError = error;
      });

    return ambientLight;
  }

  rebuildEnvironment() {
    if (!this.environmentSource || this.disposed) return;
    const generator = new PMREMGenerator(this.renderer);
    try {
      this.environmentTarget?.dispose();
      this.environmentSource.needsUpdate = true;
      this.environmentTarget = generator.fromEquirectangular(
        this.environmentSource,
      );
      this.scene.environment = this.environmentTarget.texture;
      this.scene.environmentIntensity = this.config.lighting.envMapIntensity;
    } finally {
      this.environmentSource.dispose();
      generator.dispose();
    }
  }

  loseContext() {
    if (this.contextLost) return;
    this.contextLost = true;
    this.contextReady = new Promise((resolve) => {
      this.resolveContext = resolve;
    });
  }

  async waitForContext() {
    if (this.disposed) return;
    // The GL context can be lost before its DOM event is delivered.
    if (this.renderer.getContext().isContextLost()) this.loseContext();
    await this.contextReady;
  }

  restoreContext() {
    if (this.disposed) return;
    this.rebuildEnvironment();
    // Three's async readiness checks consult the current renderer cache.
    // Recreate pending programs before those checks resume after restoration.
    for (const { object, lightingScene } of this.compilations.values()) {
      lightingScene.environment = this.scene.environment;
      this.renderer.compile(object, this.camera, lightingScene);
    }
    this.contextLost = false;
    this.resolveContext?.();
    this.resolveContext = null;
  }

  render() {
    if (this.disposed || this.contextLost) return false;
    if (this.renderer.getContext().isContextLost()) {
      this.loseContext();
      return false;
    }
    let camera = this.camera;
    if (this.renderer.transmissionResolutionScale < 1) {
      // Three keeps transmission targets per camera. A second camera retains
      // the smaller transition target instead of destroying/reallocating the
      // full-size target at both ends of every scroll crossing.
      this.transitionCamera.copy(this.camera, false);
      camera = this.transitionCamera;
    }
    this.renderer.render(this.scene, camera);
    return true;
  }

  async compileMaterials(object, lightingScene) {
    const ready = this.renderer.compileAsync(
      object,
      this.camera,
      lightingScene,
    );
    this.compilations.set(ready, { object, lightingScene });
    try {
      await ready;
    } finally {
      this.compilations.delete(ready);
    }
  }

  async warmMaterials(object, lightingScene = this.scene) {
    await this.waitForContext();
    if (this.disposed) return;
    const renderer = this.renderer;
    const transmissive = new Map();
    const transmissionObjects = new THREE.Group();
    object.traverse((node) => {
      if (!node.isMesh) return;
      const passMaterials = [];
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        // r173 retains the last explicit precision in WebGLPrograms. Without
        // this, lowp particles change the shader key of later null-precision
        // cell/product materials depending on traversal order.
        if (material.precision === null) {
          material.precision = this.config.renderer.precision;
          material.needsUpdate = true;
        }
        if (material.transmission > 0 && material.side === THREE.DoubleSide) {
          transmissive.set(material, material.side);
          passMaterials.push(material);
        } else if (!material.transmission && !material.transparent) {
          passMaterials.push(material);
        }
        for (const value of Object.values(material))
          if (value?.isTexture) renderer.initTexture(value);
      }
      if (passMaterials.length) {
        // Compile-only clones share geometry and materials. Transparent
        // objects never appear in the transmission backdrop, so skip them.
        const mesh = node.clone(false);
        mesh.material = passMaterials;
        transmissionObjects.add(mesh);
      }
    });
    // Transmission renders opaque objects a second time without tone mapping.
    // Its back-face pass also uses a different program from the main pass.
    const transmissionTarget = new THREE.WebGLRenderTarget(1, 1);
    try {
      const previousTarget = renderer.getRenderTarget();
      let ready;
      try {
        for (const material of transmissive.keys()) {
          material.side = THREE.BackSide;
          material.needsUpdate = true;
        }
        // A render target selects both linear output and NoToneMapping.
        // Changing toneMapping alone misses the linear-color shader variant.
        renderer.setRenderTarget(transmissionTarget);
        ready = this.compileMaterials(transmissionObjects, lightingScene);
      } finally {
        for (const [material, side] of transmissive) {
          material.side = side;
          material.needsUpdate = true;
        }
        renderer.setRenderTarget(previousTarget);
      }
      // Restore synchronous renderer state before yielding to the app RAF.
      await ready;
      await this.waitForContext();
      if (!this.disposed) await this.compileMaterials(object, lightingScene);
    } finally {
      transmissionTarget.dispose();
    }
  }

  async warmProduct(product) {
    // Use a detached lighting scene: warming a future phase must not change
    // the lights or materials in the currently visible cell scene.
    const lighting = new THREE.Scene();
    lighting.environment = this.scene.environment;
    lighting.add(new THREE.AmbientLight(0xffffff, 4));
    const spot = this.productLight.clone();
    spot.visible = false;
    lighting.add(spot);
    for (const phase of [PRODUCT_PHASE.TRANSITION, PRODUCT_PHASE.DISPLAY]) {
      product.setMaterialPhase(phase);
      spot.visible = phase === PRODUCT_PHASE.DISPLAY;
      await this.warmMaterials(product.root, lighting);
      if (this.disposed) return;
    }
    product.setMaterialPhase(PRODUCT_PHASE.TRANSITION);
  }

  async warmProductFrames(product, cell, starField) {
    const root = product.root;
    const anchor = new THREE.Group();
    anchor.add(root);
    root.add(this.productLightRig);
    root.position.set(0, 0, 0);
    root.scale.setScalar(4);
    root.rotation.set(Math.PI / 2, 0, 0);
    // compileAsync prepares WebGL programs, but drivers may defer pipeline
    // creation, buffer uploads and transmission-target allocation until a draw.
    // Prepare those during loading, one phase per idle task. Restore the real
    // scene in the same task, before the browser can present the warm-up pose.
    for (const phase of [PRODUCT_PHASE.TRANSITION, PRODUCT_PHASE.DISPLAY]) {
      await new Promise((resolve) => {
        if (window.requestIdleCallback)
          window.requestIdleCallback(resolve, { timeout: 500 });
        else setTimeout(resolve, 0);
      });
      await this.waitForContext();
      if (this.disposed) return anchor;
      const saved = {
        cell: cell.visible,
        stars: starField.visible,
        light: this.productLight.visible,
        scale: this.renderer.transmissionResolutionScale,
      };
      try {
        this.scene.add(anchor);
        anchor.lookAt(this.camera.position);
        root.visible = true;
        product.setMaterialPhase(phase);
        cell.visible = phase === PRODUCT_PHASE.TRANSITION && saved.cell;
        starField.visible = phase === PRODUCT_PHASE.TRANSITION;
        this.productLight.visible = phase === PRODUCT_PHASE.DISPLAY;
        this.renderer.transmissionResolutionScale =
          phase === PRODUCT_PHASE.TRANSITION
            ? Math.min(1, 1 / this.renderer.getPixelRatio())
            : 1;
        this.render();
      } finally {
        root.visible = false;
        this.scene.remove(anchor);
        cell.visible = saved.cell;
        starField.visible = saved.stars;
        this.productLight.visible = saved.light;
        this.renderer.transmissionResolutionScale = saved.scale;
        this.render();
      }
    }
    product.setMaterialPhase(PRODUCT_PHASE.TRANSITION);
    return anchor;
  }

  dispose() {
    this.disposed = true;
    this.resolveContext?.();
    this.resolveContext = null;
    window.removeEventListener("resize", this.onResize);
    this.controls.dispose();
    this.renderer.domElement.remove();
    const release = () => {
      this.environmentSource?.dispose();
      this.environmentSource = null;
      disposeScene(this.scene);
      this.environmentTarget?.dispose();
      this.renderer.dispose();
    };
    // Do not destroy program caches underneath Three's pending readiness polls.
    if (this.compilations.size)
      Promise.allSettled([...this.compilations.keys()]).then(release);
    else release();
  }
}
