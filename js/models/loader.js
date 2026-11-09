import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { compactIndices } from "./geometry.js";
import { loadBinary } from "../utils/loadBinary.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(new URL("assets/draco/", document.baseURI).href);
dracoLoader.setWorkerLimit(2);
const loader = new GLTFLoader().setDRACOLoader(dracoLoader);

let pendingLoads = 0;
let disposed = false;

// One decoder pool serves every model; loading is explicit, never a constructor side effect.
export async function loadModel(
  path,
  {
    renderOrder = 1,
    onProgress,
    compressed = false,
    parseAfter,
    signal,
    decoderPath,
  } = {},
) {
  if (disposed) throw new Error("The model loader has been disposed.");
  if (decoderPath) dracoLoader.setDecoderPath(decoderPath);
  pendingLoads++;
  let gltf;
  try {
    if (compressed) {
      const data = await loadBinary(path, signal);
      await parseAfter;
      if (disposed || signal?.aborted)
        throw new Error("Model loading cancelled.");
      gltf = await loader.parseAsync(
        data,
        THREE.LoaderUtils.extractUrlBase(path),
      );
    } else {
      gltf = await new Promise((resolve, reject) => {
        loader.load(path, resolve, onProgress, reject);
      });
    }
  } finally {
    pendingLoads--;
    if (disposed && pendingLoads === 0) dracoLoader.dispose();
  }
  const root = gltf.scene;
  root.traverse((node) => {
    if (node.isMesh) compactIndices(node.geometry);
  });
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
