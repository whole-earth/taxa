import * as THREE from 'three';
import { Group } from 'tween'
import { GLTFLoader } from 'three/GLTFLoader';
import { DRACOLoader } from 'three/DracoLoader';
import { OrbitControls } from 'three/OrbitControls';
import { RGBELoader } from 'three/RGBELoader';
import { PMREMGenerator } from 'three';
import { dispersion, mauve, pearlBlue } from './materials.js';
import { animatePage } from './scroll.js';
import { GUI } from 'dat.gui';

// Lighting controls
const lightingParams = {
    ambientIntensity: 4,
    envMapIntensity: 1,
    exposure: 1,
    toneMapping: 'ACESFilmic',
    enableEnvironment: true
};

document.addEventListener('DOMContentLoaded', async () => initScene());

export function setLastScrollY(value) { lastScrollY = value; }
export let lastScrollY = 0;
export let dotTweenGroup = new Group();
export let ribbonTweenGroup = new Group();
export let blobTweenGroup = new Group();
export let applicatorObject;

function initScene() {
    let scene, camera, renderer, controls;
    let scrollTimeout;
    let cellObject, blobInner, blobOuter, ribbons;
    let dotBounds, wavingBlob;
    let productAnchor, product;
    let ambientLight;
    const spheres = [];

    return new Promise((resolve) => {
        const boundingBoxes = [];
        const loadedObjects = [];
        const globalShaders = {};
        scene = new THREE.Scene();
        camera = initCamera();
        renderer = initRenderer();
        controls = initControls(camera, renderer);
        cellObject = new THREE.Object3D();

        initLights(scene, renderer);
        window.addEventListener('scroll', () => animatePage(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, scrollTimeout, renderer, ambientLight));
        window.addEventListener('resize', () => resizeScene(renderer, camera));

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
            constructor(gltf, shader = null, renderOrder = 1) {
                return new Promise((resolve, reject) => {
                    this.scene = scene;
                    this.position = new THREE.Vector3(0, 0, 0);
                    //this.basePath = 'http://127.0.0.1:5501/assets/product/';
                    this.basePath = 'https://cdn.jsdelivr.net/gh/whole-earth/taxa@main/assets/product/';
                    this.gltfFileName = gltf;

                    // Setup loaders
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
                        this.object.visible = false;

                        // Initialize product with transparency
                        this.object.traverse(child => {
                            if (child.material) {
                                //child.material.transparent = true;
                                //child.material.opacity = 0;
                                child.material.needsUpdate = true;
                            }
                        });

                        // Move applicator up
                        applicatorObject = this.object.getObjectByName('applicator');
                        if (applicatorObject) {
                            applicatorObject.position.y += 12;
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

            new CellComponent("blob-inner.glb", pearlBlue, 0).then((object) => {
                blobInner = object;
                resolve();
            }),

            new CellComponent("blob-outer.glb", dispersion, 2).then((object) => {
                blobOuter = object;
                resolve();
            }),

            new CellComponent("ribbons.glb", mauve, 3).then((object) => {
                ribbons = object;
                resolve();
            })

        ];

        const loadProductObject = [
            new productComponent("hollow.glb", null, 200)
                .then((createdProduct) => {
                    product = createdProduct;
                    
                    // Create anchor and add product to it
                    productAnchor = new THREE.Object3D();
                    productAnchor.add(product);
                    
                    scene.add(productAnchor);
                    resolve();
                })
                .catch((error) => {
                    console.error('Failed to load product:', error);
                })
        ];

        Promise.all(loadCellObjects).then(() => {
            scene.add(cellObject);
            initSpeckles(scene, boundingBoxes);
            //initBlueGUI();
            return Promise.all(loadProductObject);
        }).then(() => {
            resolve();
        }).catch((error) => {
            console.error('Error in loading sequence:', error);
        });
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

        // Add environment toggle to lighting params
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
            
            // Distribute spheres across 5 groups instead of 3
            const groupIndex = i % 5;
            switch(groupIndex) {
                case 0:
                    dotsGroup1.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(0.8); // slowest
                    break;
                case 1:
                    dotsGroup2.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(0.9);
                    break;
                case 2:
                    dotsGroup3.add(sphereMesh);
                    // default speed (1.0)
                    break;
                case 3:
                    dotsGroup4.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(1.1);
                    break;
                case 4:
                    dotsGroup5.add(sphereMesh);
                    sphereMesh.velocity.multiplyScalar(1.2); // fastest
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
            requestAnimationFrame(animate);
    
            dotTweenGroup.update();
            ribbonTweenGroup.update();
            blobTweenGroup.update();
    
            if (productAnchor) { productAnchor.lookAt(camera.position); }
    
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
    
        animate();
    }
    

    function resizeScene(render, camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        render.setSize(window.innerWidth, window.innerHeight);
    }

    function initBlueGUI() {
        const gui = new GUI();
        const pearlBlueFolder = gui.addFolder('Pearl Blue Material');
        
        pearlBlueFolder.addColor({
            color: '#' + pearlBlue.color.getHexString()
        }, 'color')
            .name('Base Color')
            .onChange(value => {
                pearlBlue.color.set(value);
                pearlBlue.sheenColor.set(value);
                pearlBlue.needsUpdate = true;
            });
            
        pearlBlueFolder.add(pearlBlue, 'roughness', 0, 1, 0.01)
            .name('Roughness');
            
        pearlBlueFolder.add(pearlBlue, 'metalness', 0, 1, 0.01)
            .name('Metalness');
            
        pearlBlueFolder.add(pearlBlue, 'sheen', 0, 1, 0.01)
            .name('Sheen');
            
        pearlBlueFolder.add(pearlBlue, 'sheenRoughness', 0, 1, 0.01)
            .name('Sheen Roughness');
            
        pearlBlueFolder.add(pearlBlue, 'opacity', 0, 1, 0.01)
            .name('Opacity');

        pearlBlueFolder.add(pearlBlue, 'transparent')
            .name('Transparent');

        pearlBlueFolder.add({ reset: () => {
            pearlBlue.color.set('#6a81ad');
            pearlBlue.sheenColor.set('#6a81ad');
            pearlBlue.roughness = 0.4;
            pearlBlue.metalness = 0.2;
            pearlBlue.opacity = 1;
            pearlBlue.sheen = 1;
            pearlBlue.sheenRoughness = 1;
            pearlBlue.transparent = true;
            pearlBlue.needsUpdate = true;
            // Force GUI to update
            for (let controller of pearlBlueFolder.controllers) {
                controller.updateDisplay();
            }
        }}, 'reset')
            .name('Reset Values');
            
        pearlBlueFolder.open();
    }

}