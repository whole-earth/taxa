import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(new URL("assets/draco/", document.baseURI).href);
dracoLoader.setWorkerLimit(2);
const loader = new GLTFLoader().setDRACOLoader(dracoLoader);

let pendingLoads = 0;
let disposed = false;

// One decoder pool serves every model; loading is explicit, never a constructor side effect.
export async function loadModel(path, { renderOrder = 1, onProgress } = {}) {
  if (disposed) throw new Error("The model loader has been disposed.");
  pendingLoads++;
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.load(path, resolve, onProgress, reject);
    });
  } finally {
    pendingLoads--;
    if (disposed && pendingLoads === 0) dracoLoader.dispose();
  }
  const root = gltf.scene;
  root.position.set(0, 0, 0);
  root.name = path.split("/").pop();
  const center = new THREE.Box3()
    .setFromObject(root)
    .getCenter(new THREE.Vector3());
  root.position.sub(center);
  root.renderOrder = renderOrder;
  return root;
}

export function disposeModelLoader() {
  disposed = true;
  // Let in-flight decodes settle so callers can release their results.
  if (pendingLoads === 0) dracoLoader.dispose();
}
