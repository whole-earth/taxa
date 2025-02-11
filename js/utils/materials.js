import * as THREE from 'three';

export const pearlBlue = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#6175aa'),
  roughness: 0.4,
  metalness: 0.2,
  opacity: 1,
  side: THREE.FrontSide,
  sheen: 1,
  sheenRoughness: 1,
  sheenColor: new THREE.Color('#6a81ad')
});

export const mauve = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#e7cbef'),
  opacity: 1,
  transparent: true,
  side: THREE.FrontSide,
  depthWrite: true
});

export const dispersion = new THREE.MeshPhysicalMaterial({
  color: 0xe4e4e4,
  roughness: 0.16,
  metalness: 0.17,
  emissive: 0x000000,
  iridescence: 0.82,
  iridescenceIOR: 1,
  iridescenceThicknessRange: [100, 400],
  envMapIntensity: 1,
  reflectivity: 0.25,
  transmission: 0.9,
  attenuationColor: 0xffffff,
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: true
});

export const dispersionMobile = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#8f9897'),
  transparent: true,
  roughness: 0.2,
  metalness: 0.4,
  opacity: 0.65,
  envMapIntensity: 4,
  reflectivity: 1,
  side: THREE.DoubleSide,
  depthWrite: true
});