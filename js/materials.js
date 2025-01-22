import * as THREE from 'three';

export const pearlBlue = new THREE.MeshPhysicalMaterial({
  //color: new THREE.Color('#6a81ad'),
  color: new THREE.Color('#6175aa'),
  roughness: 0.4,
  metalness: 0.2,
  opacity: 1,
  //transparent: true, TODO: check if needed to reinstate 
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
  roughness: 0.2,
  metalness: 0.2,
  sheen: 0,
  sheenColor: 0x000000,
  sheenRoughness: 0,
  emissive: 0x000000,
  specularIntensity: 1,
  specularColor: 0xffffff,
  clearcoat: 0.78,
  clearcoatRoughness: 0.84,
  iridescence: 0.82,
  iridescenceIOR: 1,
  iridescenceThicknessRange: [100, 400],
  anisotropy: 0,
  anisotropyRotation: 0,
  envMapIntensity: 1,
  reflectivity: 0.25,
  transmission: 0.9,
  attenuationColor: 0xffffff,
  side: THREE.DoubleSide,
  transparent: true,
  dispersion: 5,
  transparent: true,
  depthWrite: true
});