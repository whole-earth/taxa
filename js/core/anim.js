import * as THREE from 'three';
import { Group } from 'tween';
import { dispersion, dispersionMobile, mauve, pearlBlue } from '../utils/materials.js';
import { animatePage } from './scroll.js';
import { StarField, starfieldParams } from '../effects/starfield.js';
import { PRODUCT_COLORS, ColorChangeAnimationSequence, colorTweenGroup } from '../effects/podColors.js';
import { SceneManager } from './sceneManager.js';
import { CellComponent, ProductComponent } from '../components/components.js';
import { SpeckleSystem } from '../effects/speckles.js';
import { initInactivityManager } from '../utils/inactivity.js';

const CONFIG = {
    lighting: {
        ambientIntensity: 4,
        envMapIntensity: 1,
        exposure: 1,
        toneMapping: 'ACESFilmic',
        enableEnvironment: true
    },
    renderer: {
        antialias: window.innerWidth > 768,
        alpha: true,
        powerPreference: 'high-performance',
        precision: 'mediump',
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: false
    },
    camera: {
        fov: window.innerWidth < 768 ? 90 : 60,
        near: 0.5,
        far: 2000,
        position: [0, 0, 60]
    },
    controls: {
        dampingFactor: 0.03,
        autoRotateSpeed: 0.2
    },
    assets: {
        meshLine: "https://unpkg.com/three.meshline@1.4.0/src/THREE.MeshLine.js",
        envMap: "https://cdn.jsdelivr.net/gh/whole-earth/taxa-v3@main/assets/cell/aloe.hdr"
    }
};

export const state = {
    lastScrollY: 0,
    dotTweenGroup: new Group(),
    ribbonTweenGroup: new Group(),
    blobTweenGroup: new Group(),
    mobilizeTweenGroup: new Group(),
    applicatorObject: null,
    starField: null,
    sceneManager: null,
    scrollTimeout: null,
    lenis: null,
    app: null,
    setLastScrollY(value) {
        this.lastScrollY = value;
    }
};

export const setApplicatorObject = (value) => { state.applicatorObject = value; };

window.THREE = window.THREE || {};
Object.assign(window.THREE, THREE);

// Load MeshLine dependency
const meshLineScript = document.createElement('script');
meshLineScript.src = CONFIG.assets.meshLine;
document.head.appendChild(meshLineScript);

export class App {
    constructor() {
        document.body.classList.add('loading');
        this.sceneManager = new SceneManager(CONFIG);
        state.sceneManager = this.sceneManager;
        state.app = this;
        this.cellObject = new THREE.Object3D();
        this.boundingBoxes = [];
        this.loadedObjects = [];
        this.isInitialized = false;
        this.animationFrameId = null;
        this.animate = this.animate.bind(this);
        this.init().catch(error => console.error('Failed to initialize:', error));
        this.setupEventListeners();
    }

    async init() {
        try {
            this.ambientLight = this.sceneManager.initLights();
            await this.loadAllComponents();
            await this.initializeStarfield();
            this.resetInitialState();

            const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) && window.innerWidth < 768;
            if (isMobile) {
                console.log('Mobile device detected, initializing smoothScroll to mobile params');
            }
            /*
        state.lenis = new window.Lenis({
            duration: 2.0,
            smoothWheel: true,
            wheelMultiplier: 0.55,
            touchMultiplier: 3.4,
            infinite: false,
            smoothTouch: true,
            touchInertiaMultiplier: 3,
            syncTouch: true,
            syncTouchLerp: 1.4, // testing for mobile
            overscroll: false
        });
        */
            state.lenis = new window.Lenis({
                overscroll: false,
                wheelMultiplier: 0.55,
            });

            this.startAnimationLoop();

            this.completeInitialization();
        } catch (error) {
            console.error('Failed to initialize:', error);
            throw error;
        }
    }

    async initializeStarfield() {
        state.starField = new StarField(starfieldParams);
        state.starField.visible = true;
        state.starField.position.set(0, 0, -20);
        this.sceneManager.camera.add(state.starField);
        this.sceneManager.scene.add(this.sceneManager.camera);

        // Ensure proper starfield initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async loadAllComponents() {
        // Load cell components first
        await this.loadCellComponents();

        // Initialize speckle system if inner blob is available
        if (this.blobInner && this.blobInner.getBoundingBox()) {
            const dotBounds = this.blobInner.getBoundingBox().max.z * 0.85;
            this.speckleSystem = new SpeckleSystem(this.sceneManager.scene, dotBounds);
        }
    }

    async loadProductOnDemand() {
        if (!this.product) {
            try {
                const product = await new ProductComponent(this.sceneManager.scene, "wednesday.glb", 200);
                this.product = product;

                // Add reflectivity to outer-cap
                const productObj = product.getObject();
                const applicatorGroup = productObj.getObjectByName('applicator');
                if (applicatorGroup) {
                    applicatorGroup.traverse(child => {
                        if (child.name === 'outer-cap' && child.material) {
                            child.material.ior = 200;
                            child.material.needsUpdate = true;
                        }
                    });
                }

                this.productAnchor = new THREE.Object3D();
                this.productAnchor.add(productObj);
                this.sceneManager.scene.add(this.productAnchor);

                if (this.sceneManager.directionalContainer) {
                    productObj.add(this.sceneManager.directionalContainer);
                }

                return productObj;
            } catch (error) {
                console.error('Failed to load product:', error);
                throw error;
            }
        }
        return this.product.getObject();
    }

    resetInitialState() {
        window.scrollTo(0, 0);
        state.lastScrollY = 0;

        if (state.starField) {
            state.starField.updateProgress(0);
        }
    }

    completeInitialization() {
        this.isInitialized = true;
        
        // Initialize inactivity manager
        initInactivityManager(this);

        // Remove loading class and start completion transition
        document.body.classList.remove('loading');
        document.body.classList.add('completing');

        // Cleanup after all transitions complete
        setTimeout(() => {
            document.body.classList.remove('completing');
        }, 2800); // Matches longest transition duration (1.8s + 1s delay)
    }

    startAnimationLoop() {
        let lastFrameTime = 0;
        const fpsInterval = 1000 / 60;

        const animateLoop = (time) => {
            this.animationFrameId = requestAnimationFrame(animateLoop);

            const elapsed = time - lastFrameTime;
            if (elapsed > fpsInterval) {
                if (state.lenis) {
                    state.lenis.raf(time);
                }
                this.animate(time);
                lastFrameTime = time - (elapsed % fpsInterval);
            }
        };
        
        this.animationFrameId = requestAnimationFrame(animateLoop);
    }

    animate = (time) => {
        const needsUpdate = this.updateActiveAnimations();
        if (needsUpdate) {
            this.sceneManager.update();
        }
    }

    updateActiveAnimations() {
        let needsUpdate = false;

        const tweenGroups = [
            state.dotTweenGroup,
            state.ribbonTweenGroup,
            state.blobTweenGroup,
            state.mobilizeTweenGroup,
            colorTweenGroup
        ];

        for (const group of tweenGroups) {
            if (group.getAll().length > 0) {
                group.update();
                needsUpdate = true;
            }
        }

        if (!needsUpdate &&
            !this.productAnchor?.visible &&
            !(this.speckleSystem?.wavingBlob.visible)) {
            return false;
        }

        if (this.productAnchor?.visible) {
            this.productAnchor.lookAt(this.sceneManager.camera.position);
            needsUpdate = true;
        }

        if (this.speckleSystem?.wavingBlob.visible) {
            this.speckleSystem.updatePositions();
            needsUpdate = true;
        }

        return needsUpdate;
    }

    async loadCellComponents() {
        try {
            const [blobInner, blobOuter, ribbons] = await Promise.all([
                new CellComponent(this.sceneManager.scene, "blob-inner.glb", pearlBlue, 0),
                new CellComponent(this.sceneManager.scene, "blob-outer.glb", window.innerWidth < 768 ? dispersionMobile : dispersion, 2),
                new CellComponent(this.sceneManager.scene, "ribbons.glb", mauve, 3)
            ]);

            this.blobInner = blobInner;
            this.blobOuter = blobOuter;
            this.ribbons = ribbons;

            // Store bounding boxes
            this.boundingBoxes = [
                this.blobInner.getBoundingBox(),
                this.blobOuter.getBoundingBox(),
                this.ribbons.getBoundingBox()
            ];

            // Add the Three.js objects to the scene
            this.cellObject.add(
                blobInner.getObject(),
                blobOuter.getObject(),
                ribbons.getObject()
            );
            this.sceneManager.scene.add(this.cellObject);
        } catch (error) {
            console.error('Error loading cell components:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Color change handlers
        document.getElementById('podOrange').addEventListener('click', () => {
            if (!state.applicatorObject || !this.product) return;
            new ColorChangeAnimationSequence(state.applicatorObject, this.product.getObject(), PRODUCT_COLORS.orange).start();
        });

        document.getElementById('podGreen').addEventListener('click', () => {
            if (!state.applicatorObject || !this.product) return;
            new ColorChangeAnimationSequence(state.applicatorObject, this.product.getObject(), PRODUCT_COLORS.green).start();
        });

        document.getElementById('podYellow').addEventListener('click', () => {
            if (!state.applicatorObject || !this.product) return;
            new ColorChangeAnimationSequence(state.applicatorObject, this.product.getObject(), PRODUCT_COLORS.yellow).start();
        });

        // Scroll handler
        window.addEventListener('scroll', () => {
            if (!this.isInitialized) return;

            animatePage(
                this.sceneManager.controls,
                this.sceneManager.camera,
                this.cellObject,
                this.blobInner?.getObject(),
                this.blobOuter?.getObject(),
                this.ribbons?.getObject(),
                this.speckleSystem?.spheres,
                this.speckleSystem?.wavingBlob,
                this.speckleSystem?.dotBounds,
                this.product?.getObject(),
                this.sceneManager.renderer,
                this.ambientLight
            );
        });
    }

    dispose() {
        this.sceneManager.dispose();
        this.speckleSystem.dispose();
        cancelAnimationFrame(this.animationFrameId);
    }

    // Helper function to maintain your existing scroll duration logic
    calculateScrollDuration(targetPosition) {
        const sections = ['splash', 'zoom', 'pitch', 'product'];
        const currentSection = sections.find(section => {
            const elem = document.querySelector(`.${section}`);
            return elem && isVisibleBetweenTopAndBottom(elem);
        }) || 'splash';

        const targetSection = sections.find(section => {
            const elem = document.querySelector(`.${section}`);
            return elem && elem.offsetTop === targetPosition;
        });

        const currentIndex = sections.indexOf(currentSection);
        const targetIndex = sections.indexOf(targetSection);
        const numberOfSections = Math.abs(targetIndex - currentIndex);

        if (numberOfSections === 1) return 1200;
        if (numberOfSections === 2) return 2800;
        if (numberOfSections >= 3) return 3600;
        return 0;
    }
}

// Start app immediately without waiting for DOMContentLoaded
new App();