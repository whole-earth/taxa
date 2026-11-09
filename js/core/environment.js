import * as THREE from "three";
import { loadBinary } from "../utils/loadBinary.js";

// TXRF v1: 16-byte little-endian header followed by linear RGBA16F texels.
// The CubeUV atlas layout is tied to the pinned Three revision, not a display
// image format: no tone mapping, sRGB conversion or mip generation on upload.
export async function loadEnvironment(url, signal) {
  const buffer = await loadBinary(url, signal);
  if (buffer.byteLength < 16) throw new Error("Incomplete reflection map");
  const header = new DataView(buffer);
  if (
    header.getUint32(0, false) !== 0x54585246 ||
    header.getUint16(4, true) !== 1
  )
    throw new Error("Unsupported reflection map format");
  if (header.getUint16(6, true) !== Number(THREE.REVISION))
    throw new Error("Rebake the reflection map for this Three.js revision");
  const width = header.getUint32(8, true),
    height = header.getUint32(12, true);
  if (!width || !height || buffer.byteLength !== 16 + width * height * 8)
    throw new Error("Invalid reflection map dimensions");
  const texture = new THREE.DataTexture(
    new Uint16Array(buffer, 16),
    width,
    height,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  texture.mapping = THREE.CubeUVReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
