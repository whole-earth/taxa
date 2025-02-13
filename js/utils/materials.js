import * as THREE from 'three';

export const MOBILIZE_GREEN = new THREE.Color('#9abe8b');
export const DESKTOP_BLUE = new THREE.Color('#7592c3');
export const MOBILE_BLUE = new THREE.Color('#4e6291');
export const PEARL_BLUE_PROPS = {
  roughness: 0.4,
  metalness: 0,
  envMapIntensity: 0.6,
  transmission: 0.6,
  reflectivity: 0.4
};

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

export const dispersion = Object.assign(
  new THREE.MeshPhysicalMaterial({
    color: 0xe4e4e4,
    roughness: 0.16,
    metalness: 0.17,
    iridescence: 0.82,
    iridescenceIOR: 1,
    iridescenceThicknessRange: [100, 400],
    envMapIntensity: 1,
    reflectivity: 0.25,
    transmission: 0.9,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true
  }),
  {
    isPreset: true,
    baseOpacity: 0.9
  }
);

export const dispersionMobile = Object.assign(
  new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8f9897'),
    roughness: 0.2,
    metalness: 0.4,
    opacity: 0.65,
    envMapIntensity: 4,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true
  }),
  {
    isPreset: true,
    baseOpacity: 0.65
  }
);