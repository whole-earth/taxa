import * as THREE from "three";
import { GLTFLoader } from "three/GLTFLoader";
import { DRACOLoader } from 'three/DracoLoader';
import { OrbitControls } from "three/OrbitControls";
import { RGBELoader } from "three/RGBELoader";
import { PMREMGenerator } from "three";
import { setupGUI } from "./gui.js";
import MeshTransmissionMaterial from "@pmndrs/vanilla";

let boundingBoxes = [];
let loadedObjects = [];

class CellComponent {
    constructor(gltf, shader) {
        return new Promise((resolve, reject) => {
            this.scene = scene;
            this.position = new THREE.Vector3(0, 0, 0);

            this.basePath = 'https://whole-earth.github.io/taxa/assets/cell/obj/'; // PATHCHANGE
            this.loader = new GLTFLoader();
            const dracoLoader = new DRACOLoader()

            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/')
            this.loader.setDRACOLoader(dracoLoader)
            this.loadObject(gltf, shader, resolve);

            this.boundingBox = new THREE.Box3();
            boundingBoxes.push(this.boundingBox);

        });
    }

    loadObject(gltf, shader, resolve) {
        const fullPath = this.basePath + gltf;
        this.loader.load(fullPath, (gltf) => {
            this.object = gltf.scene;
            this.object.position.copy(this.position);
            this.scene.add(this.object);
            this.centerObject(this.object);
            this.applyCustomShader(shader);
            this.boundingBox.setFromObject(this.object);

            loadedObjects.push(this.object);
            resolve(this.object);
        });
    }

    applyCustomShader(shader) {

        if (shader instanceof THREE.MeshBasicMaterial) {
            this.object.traverse((node) => {
                if (node.isMesh) {
                    node.material = shader;
                    node.material.renderOrder = 1;
                }
            });
        }
        else if (shader instanceof THREE.MeshPhysicalMaterial) {
            this.mesh = this.object
            this.blobChild = this.object.getObjectByName('Blob1')
            this.blobChild.material = shader;

            // Comment out to remove GUI
            setupGUI(this.blobChild.material);

        }
        else {
            console.log("Error applying shaders to objects");
        }
    }


    centerObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
    }
}

// Scene
const scene = new THREE.Scene();

// Camera
// changed 1.4 : changed the aspect ratios as the canvas got clipped off on smaller screens
// console.log(window.innerWidth / window.innerHeight);
const splashStartFOV = 75;


const cellElement = document.querySelector('.cell-three');
const cellWidth = cellElement.offsetWidth;
const aspectRatio = cellWidth / window.innerHeight;
console.log(cameraAspectRatio); 

// changed 1.5 : changed aspect ratio 1.0
const camera = new THREE.PerspectiveCamera(splashStartFOV, cameraAspectRatio, 0.5, 2000);
camera.position.set(0, 0, 60);

// changed 1.5 : initial right offset of the cell
camera.setViewOffset(window.innerWidth, window.innerWidth, -80, 0, window.innerWidth, window.innerWidth);

// .setViewOffset ( fullWidth, fullHeight, x , y , width , height)

// fullWidth — full width of multiview setup
// fullHeight — full height of multiview setup
// x — horizontal offset of subcamera
// y — vertical offset of subcamera
// width — width of subcamera
// height — height of subcamera 


// Renderer
const cellRender = new THREE.WebGLRenderer({ antialias: true, alpha: true });
cellRender.toneMapping = THREE.ACESFilmicToneMapping;
// cellRender.setSize(window.innerWidth, window.innerHeight);
// const side = Math.min(window.innerHeight*1.25, window.innerWidth)*1.15;

// cellRender.setSize(side, side);
cellRender.setSize(window.innerHeight, window.innerWidth); // 11.7 ONDRA
cellRender.setPixelRatio(window.devicePixelRatio);
if (window.innerWidth <= window.innerHeight) {
    const cellWrapper = document.querySelector('.cell-three');
    cellWrapper.style.bottom = "20vh";
}

// cellRender.domElement.classList.add("cell-three");
// document.querySelector(".cell").appendChild(cellRender.domElement);

document.querySelector(".cell-three").appendChild(cellRender.domElement);

// OrbitControls
const controls = new OrbitControls(camera, cellRender.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;
controls.enableZoom = false;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.target.set(0, 0, 0);
controls.minPolarAngle = Math.PI / 2 - (22 * Math.PI) / 180;
controls.maxPolarAngle = Math.PI / 2 + (22 * Math.PI) / 180;


// changed 1.3 : added scroll multipliers, rotation Degree and zoomMultiplier below

// const sections = [
//   { name: 'splash', startFOV: 75, endFOV: 75 * 0.9 },
//   { name: 'dive', startFOV: 75 * 0.9, endFOV: 50 },
//   { name: 'zoom-out', startFOV: 50, endFOV: 75 },
// ];

// Variables for Zoom
const splashEndFOV = splashStartFOV * 0.80; // 1.2x increase
const diveStartFOV = splashEndFOV;
const diveEndFOV = 50; // 2.5x zoom
const zoomOutStartFOV = diveEndFOV;
const zoomOutEndFOV = 85;

const multiplierDistanceControl = 10;
const multiplierValue = 10.05;
const rotationDegree = 180;

let lastScrollY = window.pageYOffset;
let scrollTimeout;

const splashArea = document.querySelector('.splash');
const diveArea = document.querySelector('.dive');
const zoomOutArea = document.querySelector('.zoom-out');
const cellThreeDiv = document.querySelector('.cell-three');
const splashAreaRect = splashArea.getBoundingClientRect();
const diveAreaRect = diveArea.getBoundingClientRect();
const zoomOutAreaRect = zoomOutArea.getBoundingClientRect();


function smoothLerp(start, end, progress) {
    return start + (end - start) * smoothstep(progress);
}

function smoothstep(x) {
    return x * x * (3 - 2 * x);
}

window.addEventListener('scroll', function () {

    let scrollY = window.pageYOffset;
    let scrollDiff = scrollY - lastScrollY;
    let diveBool = scrollY < diveAreaRect.bottom;
    let splashBool = scrollY < splashAreaRect.bottom;
    const diveHeight = diveAreaRect.height;
    const splashHeight = splashAreaRect.height;
    let multiplier = Math.floor(scrollDiff / multiplierDistanceControl);

    // changed 1.5 : Fixed the autoRotatespeed multiplier, for proper scroll accelerant

    controls.autoRotateSpeed = 1.0 + multiplier * multiplierValue;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function () {
        controls.autoRotateSpeed = 0.5;
    }, 100);

    if (scrollY > zoomOutAreaRect.bottom) {
        lastScrollY = scrollY;
        return;
    }

    let height;

    if (splashBool) {
        let rotation = (rotationDegree / (splashHeight * 1.000));
        camera.position.y = rotation * 0.10;
        const splashProgress = (scrollY - splashAreaRect.top) / (splashHeight * 1.00000);

        // changed 1.5 : started using offsetView instead of transform css, was creating an jittery start to scroll
        const offsetView = -80 + window.innerWidth * splashProgress * 0.1;
        camera.setViewOffset(window.innerWidth, window.innerWidth, offsetView, 0, window.innerWidth, window.innerWidth);
        camera.fov = smoothLerp(splashStartFOV, splashEndFOV, splashProgress);
    } else if (diveBool) {
        controls.autoRotate = !(diveHeight * 0.8 + splashHeight < scrollY);
        const diveProgress = (scrollY - (splashAreaRect.top + splashAreaRect.height)) / diveAreaRect.height;
        camera.fov = smoothLerp(diveStartFOV, diveEndFOV, diveProgress);
    } else {
        controls.autoRotate = true;
        const zoomOutProgress = (scrollY - (splashAreaRect.top + splashHeight + diveHeight)) / (zoomOutAreaRect.height * 1.00000);
        camera.fov = smoothLerp(zoomOutStartFOV, zoomOutEndFOV, zoomOutProgress);
    }

    camera.updateProjectionMatrix();
    lastScrollY = scrollY;
});

// Light

const pointLight = new THREE.PointLight(0xe1ff55)
scene.add(pointLight)
pointLight.position.set(10, 10, 10)


const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// CHANGES : Played a little bit with the intensity and color of directionalLight (previous was 60)

const directionalLight = new THREE.DirectionalLight(0xe1ff55, 60); // Color, Intensity
// const directionalLight = new THREE.DirectionalLight(0xffffff, 60); // Color, Intensity
directionalLight.position.set(-0.4, 1, 0.6);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xe1ff55, 30); // Color, Intensity
directionalLight2.position.set(0.4, -1, -0.6);
scene.add(directionalLight2);

const rgbeLoader = new RGBELoader();

rgbeLoader.load("https://whole-earth.github.io/taxa/assets/cell/environments/aloe.hdr", function (texture) { // PATHCHANGE
    const pmremGenerator = new PMREMGenerator(cellRender);
    pmremGenerator.compileEquirectangularShader();
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    scene.environment.mapping = THREE.EquirectangularReflectionMapping;
    texture.dispose();
    pmremGenerator.dispose();
});

//===================================================================

// GLASS TEXTURE

const glassColor = new THREE.Color(0xDCF2E4);

const glass = Object.assign(new MeshTransmissionMaterial(10), {

    side: THREE.DoubleSide,
    opacity: 0.9,
    clearcoat: 1.01,
    clearcoatRoughness: 0.8,
    transmission: 1.001,
    chromaticAberration: 0.32,
    anisotrophicBlur: 1.6,
    // attenuationColor: '#ecf2c0',
    roughness: 0.0081,
    thickness: 23,
    ior: 3.53,
    distortion: 4.9,
    distortionScale: 0.25,
    temporalDistortion: 0.44,
    transparent: true,
    color: glassColor,
});

// SPONGE TEXTURE
const sponge = new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load("https://whole-earth.github.io/taxa/assets/cell/textures/sponge.jpg"), // PATHCHANGE
    transparent: true,
    opacity: 0.85,
});

// RIBBON TEXTURE
const orange = new THREE.MeshBasicMaterial({
    color: 0xB26DC3,
});

const loadPromises = [
    new CellComponent("blob-outer.glb", glass, { z: -1 }),
    new CellComponent("ribbons.glb", orange, { z: -0.5 }),
    new CellComponent("blob-inner.glb", sponge),
];

//===================================================================

Promise.all(loadPromises).then(() => {
    initInteract();
});

function initInteract() {

    const bounds = boundingBoxes[1].max.z * 0.8;
    const sceneCenter = new THREE.Vector3(0, 0, 0);

    // Create the outer blob
    const waveGeom = new THREE.SphereGeometry(bounds + 2, 32, 32);
    const waveShader = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
        },
        vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        uniform float time;

        // Perlin noise function
        float noise(vec3 p) {
            return sin(p.x * 0.5 + time) * 0.5 + sin(p.y * 0.5 + time) * 0.5 + sin(p.z * 0.5 + time) * 0.5;
        }

        void main() {
            vUv = uv;
            vNormal = normal;

            // Define the amount of deformation
            float deformationStrength = 0.6; // Adjust the deformation strength

            // Add Perlin noise to the vertex position
            vec3 newPosition = position + vNormal * noise(position * deformationStrength);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `,
        fragmentShader: `
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
            // Apply some color to the blob
            gl_FragColor = vec4(vNormal * 0.5 + 0.5, 0.0); // Opacity set to 0
        }
    `,
        transparent: true, // Enable transparency
        blending: THREE.NormalBlending, // Specify blending equation
    });
    const wavingBlob = new THREE.Mesh(waveGeom, waveShader);
    scene.add(wavingBlob);

    const numSpheresInside = 40;
    const spheres = [];

    // Create spheres inside the outer sphere and randomize their initial positions and directions
    for (let i = 0; i < numSpheresInside; i++) {
        const randomPosition = getRandomPositionWithinBounds();

        // Create sphere
        const sphereGeometry = new THREE.SphereGeometry(0.25, 6, 6); // Adjust radius and segments as needed
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);

        // Set sphere position
        sphereMesh.position.copy(randomPosition);

        // Randomize initial direction
        const randomDirection = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
        ).normalize();
        sphereMesh.velocity = randomDirection;

        wavingBlob.add(sphereMesh);

        spheres.push(sphereMesh);
    }

    // Helper function to get a random position within bounds. 0.65 prevents freezing at perim
    function getRandomPositionWithinBounds() {
        const x = (Math.random() * 2 - 1) * (bounds * 0.65);
        const y = (Math.random() * 2 - 1) * (bounds * 0.65);
        const z = (Math.random() * 2 - 1) * (bounds * 0.65);

        return new THREE.Vector3(x, y, z);
    }

    /*
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function onClick(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(spheres, true); // Check for intersections with spheres
  
      if (intersects.length > 0) {
        const clickedSphere = intersects[0].object;
        console.log("Sphere clicked:", clickedSphere);
      }
    }
    cellRender.domElement.addEventListener("click", onClick);
  
    */

    // Animation loop
    const speedFactor = 0.03;

    function animate(t) {
        requestAnimationFrame(animate);

        spheres.forEach((sphere) => {
            sphere.position.add(sphere.velocity.clone().multiplyScalar(speedFactor));

            // Check if the sphere is beyond the max distance
            const distance = sphere.position.distanceTo(sceneCenter);
            if (distance >= bounds) {
                const reverseDirection = sphere.velocity.clone().negate();
                const randomAngle = (Math.random() * Math.PI) / 6 - Math.PI / 12; // +/- 30 degrees in radians
                reverseDirection.applyAxisAngle(
                    sphere.position.clone().normalize(),
                    randomAngle,
                );
                sphere.velocity.copy(reverseDirection);
            }
        });

        waveShader.uniforms.time.value += 0.01;

        // CHANGED 1.2 : loadedObject[0] is actually the outer blob mesh
        if (loadedObjects[0] && loadedObjects[0].children.length > 0) {
            loadedObjects[0].children.forEach(child => {
                if (child.material) {
                    child.material.time = t / 1000;
                    // console.log(t / 1000)
                }
            });
        }

        controls.update();
        cellRender.render(scene, camera);
    }

    animate();
}