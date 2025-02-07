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

class App {
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
        // Start animation loop immediately
        this.startAnimationLoop();

        try {
            // Initialize core scene components
            this.ambientLight = this.sceneManager.initLights();
            
            // Setup and initialize starfield
            await this.initializeStarfield();
            
            // Load all 3D components
            await this.loadAllComponents();
            
            // Reset initial state
            this.resetInitialState();
            
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
        if (!this.animationFrameId) {
            this.animate();
        }
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate);
        setAnimationFrameId(this.animationFrameId);

        // Update all active animations
        this.updateActiveAnimations();
        
        // Render the scene
        this.sceneManager.update();
    }

    updateActiveAnimations() {
        const activeTweenGroups = [
            { group: state.dotTweenGroup, active: state.dotTweenGroup.getAll().length > 0 },
            { group: state.ribbonTweenGroup, active: state.ribbonTweenGroup.getAll().length > 0 },
            { group: state.blobTweenGroup, active: state.blobTweenGroup.getAll().length > 0 },
            { group: colorTweenGroup, active: colorTweenGroup.getAll().length > 0 }
        ];

        activeTweenGroups.forEach(({ group, active }) => {
            if (active) group.update();
        });

        // Update product anchor
        if (this.productAnchor?.visible) {
            this.productAnchor.lookAt(this.sceneManager.camera.position);
        }

        // Update speckle system
        if (this.speckleSystem && this.speckleSystem.wavingBlob.visible) {
            this.speckleSystem.updatePositions();
        }
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
            const product = await new ProductComponent(this.sceneManager.scene, "product-v2.glb", 200);
            this.product = product;
            
            this.productAnchor = new THREE.Object3D();
            this.productAnchor.add(product.getObject());
            this.sceneManager.scene.add(this.productAnchor);

            // Attach spotlight container to the product
            if (this.sceneManager.spotlightContainer) {
                product.getObject().add(this.sceneManager.spotlightContainer);
            }

            // Set initial color
            const innerCap = product.getObject().getObjectByName('inner-cap');
            if (innerCap && innerCap.material) {
                innerCap.material.color = new THREE.Color(PRODUCT_COLORS.orange);
                innerCap.material.emissive = new THREE.Color(PRODUCT_COLORS.orange);
                innerCap.material.needsUpdate = true;
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
                null,
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
}

// Start app immediately without waiting for DOMContentLoaded
const app = new App();