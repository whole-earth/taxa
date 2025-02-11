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
        
        const directionalContainer = new THREE.Object3D();
        directionalContainer.matrixAutoUpdate = true;
        
        const spotLight = new THREE.SpotLight(0xfff9f0, 20);
        spotLight.position.set(36, -50, 75);
        spotLight.visible = false;
        spotLight.angle = Math.PI/4;
        spotLight.penumbra = 0.5;
        spotLight.decay = 0;
        spotLight.distance = 1000;

        // Add target that will move with the container
        const target = new THREE.Object3D();
        target.position.set(-44, 15, -20);
        directionalContainer.add(target);
        spotLight.target = target;

        // Add spotlight to container
        directionalContainer.add(spotLight);

        // Enable and configure shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 512;
        spotLight.shadow.mapSize.height = 512;
        spotLight.shadow.camera.near = 0.5;
        spotLight.shadow.camera.far = 500;
        spotLight.shadow.bias = -0.0005;
        spotLight.shadow.radius = 4;

        // Store references
        this.directionalLight = spotLight; // Keep the same property name for compatibility
        this.directionalContainer = directionalContainer;
        this.directionalTarget = target;

        // Method to update light position (now relative to product)
        this.setLightPosition = (position, targetPosition) => {
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