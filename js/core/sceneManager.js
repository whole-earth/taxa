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

        // Disable rotation on touch devices
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) {
            controls.enableRotate = false;
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

        // Create a fixed container for spotlight that won't rotate with controls
        const spotlightContainer = new THREE.Object3D();
        spotlightContainer.matrixAutoUpdate = false; // Prevent auto-updates
        this.scene.add(spotlightContainer);

        // Add spotlight for product highlighting
        const spotLight = new THREE.SpotLight(0xffffff, 0);
        spotLight.angle = Math.PI / 4; // 45 degrees
        spotLight.penumbra = 0.2;
        spotLight.decay = 1;
        
        // Add fixed target that won't move
        const target = new THREE.Object3D();
        target.matrixAutoUpdate = false; // Prevent auto-updates
        spotlightContainer.add(target);
        spotLight.target = target;
        
        // Add spotlight to fixed container
        spotlightContainer.add(spotLight);
        
        // Enable and configure shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 512;
        spotLight.shadow.mapSize.height = 512;
        spotLight.shadow.camera.near = 0.5;
        spotLight.shadow.camera.far = 500;

        // Create enhanced debug helpers in the fixed container
        // 1. SpotLight Helper (shows the cone)
        const spotHelper = new THREE.SpotLightHelper(spotLight, 0xff0000);
        spotHelper.visible = false;
        spotlightContainer.add(spotHelper);

        // 2. Point Helper (shows the light position)
        const pointGeometry = new THREE.SphereGeometry(2, 16, 16);
        const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const pointHelper = new THREE.Mesh(pointGeometry, pointMaterial);
        pointHelper.visible = false;
        spotlightContainer.add(pointHelper);

        // 3. Line Helper (shows the direction)
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
        const lineHelper = new THREE.Line(lineGeometry, lineMaterial);
        lineHelper.visible = false;
        spotlightContainer.add(lineHelper);

        // Store references
        this.spotLight = spotLight;
        this.spotHelper = spotHelper;
        this.pointHelper = pointHelper;
        this.lineHelper = lineHelper;
        this.spotlightContainer = spotlightContainer;
        
        // Method to update spotlight position
        this.setSpotlightPosition = (position, targetPosition) => {
            spotLight.position.set(position.x, position.y, position.z);
            target.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
            spotlightContainer.updateMatrix(); // Update the fixed matrix
            this.updateSpotlightHelpers();
        };
        
        // Method to update all helpers
        this.updateSpotlightHelpers = () => {
            if (spotHelper.visible) {
                spotHelper.update();
                pointHelper.position.copy(spotLight.position);
                
                // Update line helper to show direction
                const positions = new Float32Array([
                    spotLight.position.x, spotLight.position.y, spotLight.position.z,
                    spotLight.target.position.x, spotLight.target.position.y, spotLight.target.position.z
                ]);
                lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                lineGeometry.attributes.position.needsUpdate = true;
            }
        };

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