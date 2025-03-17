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
import { materialManager } from '../utils/materialManager.js';

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
        autoRotateSpeed: 0.4
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
        // Select odor radio button by default
        const odorRadio = document.getElementById('odorRadio');
        if (odorRadio) {
            odorRadio.checked = true;
        }
        
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

        // Add loading overlay to the DOM
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'product-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="product-loading-content">
                <div class="product-loading-spinner"></div>
                <div class="product-loading-text">Loading Product</div>
                <div class="product-loading-progress">0%</div>
                <div class="product-loading-status">Preparing 3D model...</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);

        // Add loading overlay styles
        const style = document.createElement('style');
        style.textContent = `
            .product-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(255, 251, 244, 0.3);
                backdrop-filter: blur(6px);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                opacity: 0;
                transition: all 0.3s ease;
            }
            .product-loading-overlay.active {
                display: flex;
                opacity: 1;
            }
            .product-loading-content {
                text-align: center;
                color: var(--taxa-blue);
                font-family: sans-serif;
            }
            .product-loading-spinner {
                width: 50px;
                height: 50px;
                border: 3px solid transparent;
                border-top-color: var(--taxa-blue);
                border-radius: 50%;
                margin: 0 auto 20px;
                animation: spin 1s linear infinite;
            }
            .product-loading-text {
                font-size: 24px;
                margin-bottom: 10px;
                display: none;
            }
            .product-loading-progress {
                font-size: 18px;
                margin-bottom: 10px;
            }
            .product-loading-status {
                font-size: 14px;
                font-weight: 400;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        this.init().catch(error => console.error('Failed to initialize:', error));
        this.setupEventListeners();
    }

    async initializeProductLoading() {
        try {
            const product = await this.loadProductOnDemand();
            if (product) {
                console.log('Product loaded successfully');
                state.preloadedProduct = product;
                state.productAssetsPreloaded = true;
                
                // If the product is loaded after initialization, ensure it's properly set up
                if (this.isInitialized) {
                    this.setupProduct(product);
                }
            }
        } catch (error) {
            console.warn('Product loading failed:', error);
        }
    }

    // Helper method to batch update materials using the global manager
    batchUpdateMaterials(materials) {
        if (materials && materials.length > 0) {
            materialManager.queueMaterialUpdate(materials);
        }
    }

    setupProduct(product) {
        if (!this.productAnchor) {
            this.productAnchor = new THREE.Object3D();
            this.sceneManager.scene.add(this.productAnchor);
        }
        
        this.productAnchor.add(product);
        
        if (this.sceneManager.directionalContainer) {
            product.add(this.sceneManager.directionalContainer);
        }
        
        const productObj = product.getObject();
        if (productObj) {
            const applicatorGroup = productObj.getObjectByName('applicator');
            if (applicatorGroup) {
                const materialsToUpdate = [];
                applicatorGroup.traverse(child => {
                    if (child.name === 'outer-cap' && child.material) {
                        child.material.ior = 200;
                        materialsToUpdate.push(child.material);
                    }
                });
                
                // Batch update all materials at once
                this.batchUpdateMaterials(materialsToUpdate);
            }
        }
    }

    async init() {
        try {
            window.scrollTo(0, 0);
            this.ambientLight = await this.sceneManager.initLights();
            await this.loadAllComponents();
            await this.initializeStarfield();
            this.resetInitialState();

            const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) && window.innerWidth < 768;
            if (isMobile) {
                console.log('Mobile device detected, initializing smoothScroll to mobile params');
            }

            state.lenis = new window.Lenis({
                duration: isMobile ? 2.0 : 1.8,
                overscroll: false,
                wheelMultiplier: 0.8,
                smoothTouch: true,
                lerp: isMobile ? 8.0 : 2.0,
                friction: 0.2,
                touchMultiplier: 6.2,
                touchInertiaMultiplier: 2,
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
            // Calculate radius based on blobInner's bounding box
            const boundingBox = this.blobInner.getBoundingBox();
            const radius = Math.max(
                boundingBox.max.x - boundingBox.min.x,
                boundingBox.max.y - boundingBox.min.y,
                boundingBox.max.z - boundingBox.min.z
            ) * 0.48;

            this.speckleSystem = new SpeckleSystem(this.sceneManager.scene, radius, this.cellObject);
        }
    }

    async loadProductOnDemand() {
        if (!this.product) {
            try {
                const updateLoadingStatus = (status) => {
                    const statusElement = document.querySelector('.product-loading-status');
                    if (statusElement) {
                        statusElement.textContent = status;
                    }
                };

                const product = await new ProductComponent(this.sceneManager.scene, "swap.glb", 200, (progress) => {
                    // Update loading progress
                    const progressElement = document.querySelector('.product-loading-progress');
                    if (progressElement) {
                        const percentage = Math.round(progress * 100);
                        progressElement.textContent = `${percentage}%`;
                        
                        // Update status based on progress
                        if (percentage < 25) {
                            updateLoadingStatus('Downloading 3D model...');
                        } else if (percentage < 50) {
                            updateLoadingStatus('Processing geometry...');
                        } else if (percentage < 75) {
                            updateLoadingStatus('Preparing materials...');
                        } else {
                            updateLoadingStatus('Finalizing setup...');
                        }
                    }
                });
                this.product = product;

                updateLoadingStatus('Setting up product view...');

                this.productAnchor = new THREE.Object3D();
                this.productAnchor.add(product.getObject());
                this.sceneManager.scene.add(this.productAnchor);

                if (this.sceneManager.directionalContainer) {
                    product.getObject().add(this.sceneManager.directionalContainer);
                }

                return product.getObject();
            } catch (error) {
                console.error('Failed to load product:', error);
                const statusElement = document.querySelector('.product-loading-status');
                if (statusElement) {
                    statusElement.textContent = 'Error loading product. Please try again.';
                    statusElement.style.color = '#ff4444';
                }
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
            const loadingOverlay = document.querySelector('.load-progress');
            if (loadingOverlay) {
                loadingOverlay.remove();
            }
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
        // Process any pending material updates first
        materialManager.processUpdates();
        
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
            const components = {
                blobInner: { file: "blob-inner.glb", material: pearlBlue, order: 0 },
                blobOuter: { file: "blob-outer.glb", material: window.innerWidth < 768 ? dispersionMobile : dispersion, order: 2 },
                ribbons: { file: "ribbons.glb", material: mauve, order: 3 }
            };

            // Track loading progress
            const progress = { total: 0 };
            const preloadOverlay = document.querySelector('.load-progress');
            const progressElement = document.getElementById('loadProgressCount');
            
            // Helper function to calculate average progress
            const getAverageProgress = () => {
                const total = Object.values(progress).reduce((sum, val) => sum + val, 0);
                return total / Object.keys(components).length;
            };
            
            // Set up checks at different time intervals
            setTimeout(() => {
                if (preloadOverlay) {
                    const average = getAverageProgress();
                    if (average < 20) {
                        preloadOverlay.classList.remove('hidden');
                    }
                }
            }, 200);

            setTimeout(() => {
                if (preloadOverlay) {
                    const average = getAverageProgress();
                    if (average < 60) {
                        preloadOverlay.classList.remove('hidden');
                    }
                }
            }, 600);
            
            const updateProgress = (componentName, percent) => {
                progress[componentName] = percent;
                const average = Math.round(getAverageProgress());
                if (progressElement) progressElement.textContent = `${average}%`;
            };

            // Load all components in parallel
            const loaded = await Promise.all(
                Object.entries(components).map(([name, config]) => 
                    new CellComponent(
                        this.sceneManager.scene,
                        config.file,
                        config.material,
                        config.order,
                        progress => updateProgress(name, Math.round((progress.loaded / progress.total) * 100))
                    )
                )
            );

            // Store component references
            [this.blobInner, this.blobOuter, this.ribbons] = loaded;

            // Store bounding boxes
            this.boundingBoxes = loaded.map(component => component.getBoundingBox());

            // Add components to scene
            this.cellObject.add(...loaded.map(component => component.getObject()));
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

        // Clean up loading overlay
        const loadingOverlay = document.querySelector('.product-loading-overlay');
        if (loadingOverlay) {
            //loadingOverlay.remove();
        }
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