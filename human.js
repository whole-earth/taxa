import * as THREE from 'three';
import { GLTFLoader } from 'three/GLTFLoader';
import { OrbitControls } from 'three/OrbitControls';

/* --- Scene --- */
const scene = new THREE.Scene();
scene.background = new THREE.Color('#FFF5E6');

/* --- Camera --- */
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 40, 120);

/* --- Renderer --- */
const humanRender = new THREE.WebGLRenderer({ antialias: true, alpha: true });
humanRender.setSize(window.innerWidth, window.innerHeight);
humanRender.setPixelRatio(window.devicePixelRatio);
document.querySelector('.human-three').appendChild(humanRender.domElement);

/* --- OrbitControls --- */
const controls = new OrbitControls(camera, humanRender.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
// controls.enableZoom = false;
//controls.minPolarAngle = (Math.PI / 2) - (15 * Math.PI / 180);
//controls.maxPolarAngle = (Math.PI / 2) - (5 * Math.PI / 180);
// controls.minAzimuthAngle = -Math.PI / 4;
// controls.maxAzimuthAngle = Math.PI / 6;

/* --- Lights --- */

function loadLights() {

    const backlightTop = new THREE.DirectionalLight(0x849ED0, 2);
    backlightTop.target.position.set(0, 20, 0);
    backlightTop.position.set(0, 120, -60);
    scene.add(backlightTop);

    const backlightLeft = new THREE.DirectionalLight(0x849ED0, 2);
    backlightLeft.target.position.set(0, 20, 0);
    backlightLeft.position.set(-100, 0, -40);
    scene.add(backlightLeft);

    const backlightRight = new THREE.DirectionalLight(0x849ED0, 2);
    backlightRight.target.position.set(0, 20, 0);
    backlightRight.position.set(100, 0, -40);
    scene.add(backlightRight);

    const directionalFront = new THREE.DirectionalLight(0x849ED0, 3);
    directionalFront.target.position.set(0, 20, 0);
    directionalFront.position.set(0, 60, 120);
    scene.add(directionalFront);

    const directionalUpward = new THREE.DirectionalLight(0x849ED0, 3);
    directionalUpward.target.position.set(0, 50, 0);
    directionalUpward.position.set(0, 0, 40);
    scene.add(directionalUpward);

    const ambientLight = new THREE.AmbientLight(0x849ED0, 10);
    scene.add(ambientLight);

}

//const materialFlat = new THREE.MeshBasicMaterial({ color: 0x849ED0 });
const materialMap = new THREE.TextureLoader().load('./obj/blue.jpg');
const material = new THREE.MeshStandardMaterial({
    map: materialMap,
    roughness: 1,
    metalness: 0.75,
    side: THREE.DoubleSide
});

let mixer, action;

function modelInit() {

    const loader = new GLTFLoader();
    let modelHeight;
    const modelHeights = [];

    loader.load('./obj/model.glb', function (gltf) {

        const model = gltf.scene;

        model.traverse(function (child) {
            if (child.isMesh) {
                const bbox = new THREE.Box3().setFromObject(child);
                const height = bbox.max.y - bbox.min.y;
                modelHeights.push(height);
                child.material = material; // TOGGLE 2D/3D HERE
            }
        });

        model.scale.set(100, 100, 100);
        modelHeight = Math.max(...modelHeights);
        model.position.y = - modelHeight * 2;

        scene.add(model);

        mixer = new THREE.AnimationMixer(model);
        action = mixer.clipAction(gltf.animations[0]);
        action.play();

    });

    loadLights();
}

modelInit();


const human = document.querySelector('.human');

function humanScroll() {
    const humanRect = human.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
  
    const animationStartOffset = 0;
    let scrollProgress = 0;
  
    // Define animation range
    if (humanRect.top && humanRect.bottom >= animationStartOffset) {
      const animationRange = humanRect.height - viewportHeight;
      const elementPosition = Math.max(0, animationStartOffset - humanRect.top);
      scrollProgress = Math.min(1, Math.max(0, elementPosition / animationRange));
      console.log(scrollProgress)
    } else if (humanRect.bottom < animationStartOffset) {
      // Element is above the animation range
      scrollProgress = 0;
    } else {
      // Element is below the animation range
      scrollProgress = 1;
    }


  // Set the animation time based on the scroll progress
  const animationTime = scrollProgress * 4; // arbitrary multiplier... seems to work
  mixer.setTime(animationTime);
}


human.addEventListener('scroll', humanScroll);




function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (mixer) {
        mixer.update(0.01); // Update mixer in the animation loop
        humanScroll(); // Update animation based on scroll position
    }

    humanRender.render(scene, camera);

}

animate();