import * as THREE from 'three';
import { Group } from 'tween';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { PMREMGenerator } from 'three';
import { dispersion, mauve, pearlBlue } from './materials.js';
import { animatePage } from './scroll.js';
import { StarField, starfieldParams } from './starfield.js';
import { initActivityTracking, setAnimationFrameId } from './activity.js';

window.THREE = window.THREE || {};
Object.assign(window.THREE, THREE)
const meshLineScript = document.createElement('script');
meshLineScript.src = "https://unpkg.com/three.meshline@1.4.0/src/THREE.MeshLine.js";
document.head.appendChild(meshLineScript);

const lightingParams = {
    ambientIntensity: 4,
    envMapIntensity: 1,
    exposure: 1,
    toneMapping: 'ACESFilmic',
    enableEnvironment: true
};

export function setLastScrollY(value) { lastScrollY = value; }
export let lastScrollY = 0;
export let dotTweenGroup = new Group();
export let ribbonTweenGroup = new Group();
export let blobTweenGroup = new Group();
export let applicatorObject;
export let starField;

document.addEventListener('DOMContentLoaded', () => {
    initScene();
});

function initScene() {
    let scene, camera, renderer, controls;
    let scrollTimeout;
    let cellObject, blobInner, blobOuter, ribbons;
    let dotBounds, wavingBlob;
    let productAnchor, product;
    let ambientLight;
    const spheres = [];

    const boundingBoxes = [];
    const loadedObjects = [];
    const globalShaders = {};
    scene = new THREE.Scene();
    camera = initCamera();
    renderer = initRenderer();
    controls = initControls(camera, renderer);
    cellObject = new THREE.Object3D();

    starField = new StarField(starfieldParams);
    starField.visible = false;
    scene.add(starField);

    initLights(scene, renderer);

    window.addEventListener('resize', () => resizeScene(renderer, camera));
    window.addEventListener('scroll', () => animatePage(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, scrollTimeout, renderer, ambientLight));

    class CellComponent {
        constructor(gltf, shader = null, renderOrder = 1) {
            return new Promise((resolve) => {
                this.scene = scene;
                this.position = new THREE.Vector3(0, 0, 0);
                this.basePath = 'https://cdn.jsdelivr.net/gh/whole-earth/taxa@main/assets/cell/';
                // this.basePath = './assets/cell/';
                this.loader = new GLTFLoader();
                this.gltfFileName = gltf;
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
                this.loader.setDRACOLoader(dracoLoader);
                this.loadObject(gltf, shader, renderOrder, resolve);
                this.boundingBox = new THREE.Box3();
                boundingBoxes.push(this.boundingBox);
                if (shader) globalShaders[gltf] = shader;
            });
        }

        loadObject(gltf, shader, renderOrder, resolve) {
            const fullPath = this.basePath + gltf;
            this.loader.load(fullPath, (gltf) => {
                this.object = gltf.scene;
                this.object.position.copy(this.position);
                this.object.name = this.gltfFileName.split('/').pop();
                cellObject.add(this.object);
                this.centerObject(this.object);
                if (shader) this.applyCustomShader(shader);
                this.object.renderOrder = renderOrder;
                this.boundingBox.setFromObject(this.object);
                loadedObjects.push(this.object);
                resolve(this.object);
            });
        }

        applyCustomShader(shader) {
            if (!shader) return;
            this.object.traverse((node) => {
                if (node.isMesh) {
                    node.material = shader;
                    node.material.needsUpdate = true;
                }
            });
        }

        centerObject(object) {
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);
        }
    }

    class productComponent {
        constructor(gltf, renderOrder = 1) {
            return new Promise((resolve, reject) => {
                this.scene = scene;
                this.position = new THREE.Vector3(0, 0, 0);
                this.basePath = 'https://cdn.jsdelivr.net/gh/whole-earth/taxa@main/assets/product/';
                this.gltfFileName = gltf;

                this.loader = new GLTFLoader();
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
                this.loader.setDRACOLoader(dracoLoader);

                this.loadObject(gltf, renderOrder, resolve, reject);
            });
        }

        loadObject(gltf, renderOrder, resolve, reject) {
            const fullPath = this.basePath + gltf;

            this.loader.load(
                fullPath,
                (gltf) => {
                    this.object = gltf.scene;
                    this.object.position.copy(this.position);
                    this.object.name = this.gltfFileName.split('/').pop();
                    scene.add(this.object);
                    this.centerObject(this.object);
                    this.object.rotation.x = Math.PI / 2;
                    this.object.renderOrder = renderOrder;
                    
                    // Set all meshes invisible initially
                    this.object.traverse(child => {
                        if (child.isMesh) {
                            child.visible = false;
                            child.material.transparent = true;
                            child.material.opacity = 0;
                            child.material.needsUpdate = true;
                        }
                    });

                    applicatorObject = this.object.getObjectByName('applicator');
                    if (applicatorObject) {
                        applicatorObject.position.y += 24;
                        // Create plane with hole for overflow masking
                        const planeSize = window.innerWidth > 1600 ? 300 : 200;
                        const holeRadius = 31.65 / 2 * 0.99;

                        const shape = new THREE.Shape();
                        shape.moveTo(-planeSize/2, -planeSize/2);
                        shape.lineTo(planeSize/2, -planeSize/2);
                        shape.lineTo(planeSize/2, planeSize/2);
                        shape.lineTo(-planeSize/2, planeSize/2);
                        shape.lineTo(-planeSize/2, -planeSize/2);

                        // Add the circular hole
                        const holePath = new THREE.Path();
                        holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
                        shape.holes.push(holePath);

                        const geometry = new THREE.ShapeGeometry(shape);
                        const material = new THREE.ShaderMaterial({
                            uniforms: {
                                color: { value: new THREE.Color('#fffbf4') }
                            },
                            vertexShader: `
                                void main() {
                                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                }
                            `,
                            fragmentShader: `
                                uniform vec3 color;
                                void main() {
                                    gl_FragColor = vec4(color, 1.0);
                                }
                            `,
                            side: THREE.DoubleSide,
                            depthWrite: true,
                            depthTest: true
                        });

                        const planeMesh = new THREE.Mesh(geometry, material);
                        planeMesh.name = 'overflowMask';
                        planeMesh.visible = false;
                        planeMesh.renderOrder = 199;
                        
                        // Position at top of applicator
                        const box = new THREE.Box3().setFromObject(applicatorObject);
                        planeMesh.position.y = 100; // not elegant, but works
                        
                        // Rotate the plane to be horizontal
                        planeMesh.rotation.x = Math.PI / 2;
                        
                        applicatorObject.add(planeMesh);

                        // Ensure applicator is also invisible initially
                        applicatorObject.traverse(child => {
                            if (child.isMesh) {
                                child.visible = false;
                                child.material.transparent = true;
                                child.material.opacity = 0;
                                child.material.needsUpdate = true;
                            }
                        });
                    }

                    resolve(this.object);
                },
                undefined,
                (error) => {
                    console.error('Error loading product:', error);
                    reject(error);
                }
            );
        }

        centerObject(object) {
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);
        }
    }

    const loadCellObjects = [
        new CellComponent("blob-inner.glb", pearlBlue, 0).then((object) => { blobInner = object; }),
        new CellComponent("blob-outer.glb", dispersion, 2).then((object) => { blobOuter = object; }),
        new CellComponent("ribbons.glb", mauve, 3).then((object) => { ribbons = object; })
    ];

    const loadProductObject = [
        new productComponent("hollow.glb", 200)
            .then((createdProduct) => {
                product = createdProduct;
                productAnchor = new THREE.Object3D();
                productAnchor.add(product);
                scene.add(productAnchor);
            })
            .catch((error) => {
                console.error('Failed to load product:', error);
            })
    ];

    // Ensure both classes are present at start
    document.body.classList.add('loading');
    document.body.classList.add('completing');

    Promise.all(loadCellObjects).then(() => {
        scene.add(cellObject);
        initSpeckles(scene, boundingBoxes);
        
        // Signal loading complete
        document.body.classList.remove('loading');
        
        // Remove completed class after transition
        setTimeout(() => {
            document.body.classList.remove('completing');
        }, 810);
        
        // Load product separately after page is ready
        return Promise.all(loadProductObject);
    }).then(() => {
    }).catch((error) => {
        console.error('Error in loading sequence:', error);
    });

    function initRenderer() {
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.querySelector("#three").appendChild(renderer.domElement);
        return renderer;
    }

    function initCamera() {
        const splashStartFOV = window.innerWidth < 768 ? 90 : 60;
        const aspectRatio = window.innerWidth / window.innerHeight;
        const camera = new THREE.PerspectiveCamera(splashStartFOV, aspectRatio, 0.5, 2000);
        camera.position.set(0, 0, 60);
        return camera;
    }

    function initLights(scene, renderer) {
        ambientLight = new THREE.AmbientLight(0xffffff, lightingParams.ambientIntensity);
        scene.add(ambientLight);
        const rgbeLoader = new RGBELoader();
        lightingParams.enableEnvironment = true;

        rgbeLoader.load("https://cdn.jsdelivr.net/gh/whole-earth/taxa-v3@main/assets/cell/aloe.hdr", function (texture) {
            const pmremGenerator = new PMREMGenerator(renderer);
            pmremGenerator.compileEquirectangularShader();
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            scene.environment = envMap;
            scene.environment.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment.intensity = lightingParams.envMapIntensity;
            texture.dispose();
            pmremGenerator.dispose();
        });
    }

    function initControls(camera, renderer) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.03;
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.1;
        controls.target.set(0, 0, 0);
        controls.minPolarAngle = Math.PI / 2;
        controls.maxPolarAngle = Math.PI / 2;
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) {
            controls.enableRotate = false;
        }
        return controls;
    }

    function initSpeckles(scene, boundingBoxes) {
        dotBounds = boundingBoxes[1].max.z * 0.85;
        const waveGeom = new THREE.SphereGeometry(dotBounds, 32, 32);
        const waveMaterial = new THREE.MeshBasicMaterial({ color: 0x92cb86, opacity: 0, transparent: true, depthWrite: false, depthTest: false });
        wavingBlob = new THREE.Mesh(waveGeom, waveMaterial);
        wavingBlob.renderOrder = 5;

        const dotsGroup1 = new THREE.Group();
        const dotsGroup2 = new THREE.Group();
        const dotsGroup3 = new THREE.Group();
        const dotsGroup4 = new THREE.Group();
        const dotsGroup5 = new THREE.Group();
        wavingBlob.add(dotsGroup1, dotsGroup2, dotsGroup3, dotsGroup4, dotsGroup5);
        scene.add(wavingBlob);

        const sizes = [0.12, 0.14, 0.16, 0.18, 0.22];

        for (let i = 0; i < 200; i++) {
            const randomPosition = getRandomPositionWithinBounds(dotBounds);
            const sizeIndex = i % sizes.length;
            const sphereGeometry = new THREE.SphereGeometry(sizes[sizeIndex], 6, 6);
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff8e00, opacity: 0, transparent: true, depthWrite: false });
            const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphereMesh.position.copy(randomPosition);
            spheres.push(sphereMesh);
            const randomDirection = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            sphereMesh.velocity = randomDirection.multiplyScalar(0.014);

            const groupIndex = i % 5;
            switch (groupIndex) {
                case 0:
                    dotsGroup1.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(0.8);
                    break;
                case 1:
                    dotsGroup2.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(0.9);
                    break;
                case 2:
                    dotsGroup3.add(sphereMesh);
                    break;
                case 3:
                    dotsGroup4.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(1.1);
                    break;
                case 4:
                    dotsGroup5.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(1.2);
                    break;
            }
        }

        function getRandomPositionWithinBounds(bounds) {
            const x = (Math.random() * 2 - 1) * (bounds * 0.65);
            const y = (Math.random() * 2 - 1) * (bounds * 0.65);
            const z = (Math.random() * 2 - 1) * (bounds * 0.65);
            return new THREE.Vector3(x, y, z);
        }

        function animate() {
            const frameId = requestAnimationFrame(animate);
            setAnimationFrameId(frameId);
            
            dotTweenGroup.update();
            ribbonTweenGroup.update();
            blobTweenGroup.update();

            if (productAnchor) { productAnchor.lookAt(camera.position); }
            if (starField && starField.visible) { starField.updateFacing(camera); }

            renderer.render(scene, camera);
            controls.update();

            [dotsGroup1, dotsGroup2, dotsGroup3, dotsGroup4, dotsGroup5].forEach(group => {
                group.children.forEach(sphere => {
                    sphere.position.add(sphere.velocity);
                    if (sphere.position.length() > dotBounds) {
                        sphere.velocity.negate();
                    }
                });
            });
        }

        initActivityTracking(animate);
        animate();
    }

    function resizeScene(render, camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        render.setSize(window.innerWidth, window.innerHeight);
    }

}