import * as THREE from 'three';
import { Group } from 'tween';
import { dispersion, mauve, pearlBlue } from '../utils/materials.js';
import { animatePage } from './scroll.js';
import { StarField, starfieldParams } from '../effects/starfield.js';
import { initActivityTracking, setAnimationFrameId } from '../utils/inactivity.js';
import { PRODUCT_COLORS, ColorChangeAnimationSequence, colorTweenGroup } from '../effects/podColors.js';
import { SceneManager } from './sceneManager.js';
import { CellComponent, ProductComponent } from '../components/components.js';
import { SpeckleSystem } from '../effects/speckles.js';

// Configuration
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
        autoRotateSpeed: 0.1
    },
    assets: {
        meshLine: "https://unpkg.com/three.meshline@1.4.0/src/THREE.MeshLine.js",
        envMap: "https://cdn.jsdelivr.net/gh/whole-earth/taxa-v3@main/assets/cell/aloe.hdr"
    }
};

// Global state
export const state = {
    lastScrollY: 0,
    dotTweenGroup: new Group(),
    ribbonTweenGroup: new Group(),
    blobTweenGroup: new Group(),
    applicatorObject: null,
    starField: null,
    sceneManager: null,
    scrollTimeout: null,
    lenis: null,
    setLastScrollY(value) { 
        this.lastScrollY = value; 
    }
};

// Export state setters
export const setApplicatorObject = (value) => { state.applicatorObject = value; };

// Initialize Three.js globally for MeshLine
window.THREE = window.THREE || {};
Object.assign(window.THREE, THREE);

// Load MeshLine dependency
const meshLineScript = document.createElement('script');
meshLineScript.src = CONFIG.assets.meshLine;
document.head.appendChild(meshLineScript);

export class App {
    constructor() {
        this.sceneManager = new SceneManager(CONFIG);
        state.sceneManager = this.sceneManager;
        this.cellObject = new THREE.Object3D();
        this.boundingBoxes = [];
        this.loadedObjects = [];
        this.isInitialized = false;
        this.animationFrameId = null;
        this.animate = this.animate.bind(this);
        
        // Start initialization immediately
        this.init().catch(error => console.error('Failed to initialize:', error));
        this.setupEventListeners();
    }

    async init() {
        try {
            // Initialize core scene components first
            this.ambientLight = this.sceneManager.initLights();
            
            // Setup and initialize starfield
            await this.initializeStarfield();
            
            // Load all 3D components
            await this.loadAllComponents();
            
            // Reset initial state
            this.resetInitialState();

            // Initialize Lenis with mobile-optimized settings
            const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
            state.lenis = new window.Lenis({
                duration: isMobile ? 1.8 : 1.2,
                smoothWheel: true,
                wheelMultiplier: isMobile ? 0.5 : 1,
                touchMultiplier: 1.2,
                infinite: false,
                orientation: 'vertical',
                gestureOrientation: 'vertical',
                smoothTouch: true,
                touchInertiaMultiplier: 1, // Reduced inertia for better control
                syncTouch: true,
                syncTouchLerp: 0.1, // Reduced lerp for more responsive touch
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Custom easing function
            });

            // Start animation loop
            this.startAnimationLoop();
            
            // Mark as fully initialized and enable activity tracking
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
        
        // Load product last
        await this.loadProduct();
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
        initActivityTracking(this.animate);
        
        // First wave - fade in three and scroll indicator
        document.body.classList.add('fade-in-primary');
        
        // Second wave - fade in main and nav after 1.4s
        setTimeout(() => {
            document.body.classList.add('fade-in-secondary');
        }, 1400);
    }

    startAnimationLoop() {
        let lastFrameTime = 0;
        const fpsInterval = 1000 / 60; // Target 60fps
        
        const animateLoop = (time) => {
            // Throttle animation updates to 60fps
            const elapsed = time - lastFrameTime;
            
            if (elapsed > fpsInterval) {
                if (state.lenis) {
                    state.lenis.raf(time); // Update Lenis first
                }
                this.animate(time);   // Then update our animations
                lastFrameTime = time - (elapsed % fpsInterval);
            }
            requestAnimationFrame(animateLoop);
        };
        requestAnimationFrame(animateLoop);
    }

    animate = (time) => {
        const needsUpdate = this.updateActiveAnimations();
        
        // Only render if there's actual animation activity
        if (needsUpdate) {
            this.sceneManager.update();
        }

        setAnimationFrameId(time);
    }

    updateActiveAnimations() {
        let needsUpdate = false;
        
        // Check tween groups efficiently
        const tweenGroups = [
            state.dotTweenGroup,
            state.ribbonTweenGroup,
            state.blobTweenGroup,
            colorTweenGroup
        ];
        
        for (const group of tweenGroups) {
            if (group.getAll().length > 0) {
                group.update();
                needsUpdate = true;
            }
        }

        // Early exit if no updates needed
        if (!needsUpdate && 
            !this.productAnchor?.visible && 
            !(this.speckleSystem?.wavingBlob.visible)) {
            return false;
        }

        // Update remaining elements
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
                new CellComponent(this.sceneManager.scene, "blob-outer.glb", dispersion, 2),
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

    async loadProduct() {
        try {
            const product = await new ProductComponent(this.sceneManager.scene, "newest.glb", 200);
            this.product = product;
            
            this.productAnchor = new THREE.Object3D();
            this.productAnchor.add(product.getObject());
            this.sceneManager.scene.add(this.productAnchor);

            // Attach spotlight container to the product
            if (this.sceneManager.spotlightContainer) {
                product.getObject().add(this.sceneManager.spotlightContainer);
            }

        } catch (error) {
            console.error('Failed to load product:', error);
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