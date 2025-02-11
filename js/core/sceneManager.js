import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { PMREMGenerator } from 'three';

/**
 * Manages the Three.js scene, camera, renderer, and controls
 */
export class SceneManager {
    constructor(config) {
        this.config = config;
        this.scene = new THREE.Scene();
        this.camera = this.initCamera();
        this.renderer = this.initRenderer();
        this.controls = this.initControls();
        
        this.setupEventListeners();
    }

    createSpotlightControls() {
        // Create container
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            color: white;
            font-family: monospace;
            z-index: 100000000;
            display: block;
        `;
        container.id = 'spotlight-controls';

        // Add controls
        const controls = [
            { name: 'posX', label: 'Position X', min: -100, max: 160, step: 1, default: 145 },
            { name: 'posY', label: 'Position Y', min: -100, max: 100, step: 1, default: -78 },
            { name: 'posZ', label: 'Position Z', min: -100, max: 100, step: 1, default: 85 },
            { name: 'targetX', label: 'Target X', min: -100, max: 100, step: 1, default: -44 },
            { name: 'targetY', label: 'Target Y', min: -100, max: 100, step: 1, default: 15 },
            { name: 'targetZ', label: 'Target Z', min: -100, max: 100, step: 1, default: -20 },
            { name: 'intensity', label: 'Intensity', min: 0, max: 20, step: 0.5, default: 20 },
            { name: 'angle', label: 'Angle', min: 0, max: Math.PI/2, step: 0.01, default: 4 * Math.PI / 180 },
            { name: 'penumbra', label: 'Penumbra', min: 0, max: 1, step: 0.01, default: 1 },
            { name: 'decay', label: 'Decay', min: 0, max: 2, step: 0.1, default: 0 }
        ];

        controls.forEach(control => {
            const div = document.createElement('div');
            div.style.marginBottom = '5px';
            
            const label = document.createElement('label');
            label.textContent = control.label + ': ';
            label.style.display = 'inline-block';
            label.style.width = '100px';
            
            const input = document.createElement('input');
            input.type = 'range';
            input.min = control.min;
            input.max = control.max;
            input.step = control.step;
            input.value = control.default;
            input.style.width = '100px';
            input.style.marginRight = '10px';
            
            const value = document.createElement('span');
            value.textContent = control.default;
            
            div.appendChild(label);
            div.appendChild(input);
            div.appendChild(value);
            container.appendChild(div);

            // Store reference
            this[control.name + 'Input'] = input;
            this[control.name + 'Value'] = value;
        });

        // Add toggle helpers button
        const toggleHelpers = document.createElement('button');
        toggleHelpers.textContent = 'Toggle Helpers';
        toggleHelpers.style.marginTop = '10px';
        toggleHelpers.style.padding = '5px';
        container.appendChild(toggleHelpers);

        document.body.appendChild(container);

        // Store container reference
        this.spotlightControlsGUI = container;

        // Add keyboard shortcut (Alt + S) to toggle GUI
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                this.spotlightControlsGUI.style.display = 
                    this.spotlightControlsGUI.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    initCamera() {
        const { fov, near, far, position } = this.config.camera;
        const camera = new THREE.PerspectiveCamera(
            fov,
            window.innerWidth / window.innerHeight,
            near,
            far
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
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.autoRotate = true;
        controls.autoRotateSpeed = this.config.controls.autoRotateSpeed;
        controls.target.set(0, 0, 0);
        controls.minPolarAngle = Math.PI / 2;
        controls.maxPolarAngle = Math.PI / 2;

        // Disable all touch interactions on mobile devices
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) {
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
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(
            0xffffff,
            this.config.lighting.ambientIntensity
        );
        this.scene.add(ambientLight);

        //=========================================================================
        
        const spotlightContainer = new THREE.Object3D();
        spotlightContainer.matrixAutoUpdate = true;
        
        const spotLight = new THREE.SpotLight(0xffffff, 20);
        spotLight.angle = 4 * Math.PI / 180; // 4 degrees
        spotLight.penumbra = 1;
        spotLight.decay = 0;
        spotLight.position.set(145, -78, 85);
        spotLight.visible = false;

        // Add target that will move with the container
        const target = new THREE.Object3D();
        target.position.set(-44, 15, -20);
        spotlightContainer.add(target);
        spotLight.target = target;

        // Add spotlight to container
        spotlightContainer.add(spotLight);

        // Enable and configure shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 512;
        spotLight.shadow.mapSize.height = 512;
        spotLight.shadow.camera.near = 0.5;
        spotLight.shadow.camera.far = 500;

        // Store references
        this.spotLight = spotLight;
        this.spotlightContainer = spotlightContainer;
        this.spotlightTarget = target;

        // Method to update spotlight position (now relative to product)
        this.setSpotlightPosition = (position, targetPosition) => {
            spotLight.position.set(position.x, position.y, position.z);
            target.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
            
        };

        //=========================================================================

        // Load environment map
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load(
            this.config.assets.envMap,
            (texture) => {
                const pmremGenerator = new PMREMGenerator(this.renderer);
                pmremGenerator.compileEquirectangularShader();
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                this.scene.environment = envMap;
                this.scene.environment.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.environment.intensity = this.config.lighting.envMapIntensity;

                // Clean up resources
                texture.dispose();
                pmremGenerator.dispose();
            }
        );

        return ambientLight;
    }

    update() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        // Clean up resources
        this.renderer.dispose();
        this.scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }
} 