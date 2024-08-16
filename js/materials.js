import * as THREE from 'three';

export const iridescent = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#849ed0'),
    roughness: 0.55,
    metalness: 0.2,
    iridescence: 0.85,
    iridescenceIOR: 1.44,
    transmission: 0.6,
    ior: 1.4,
    thickness: 1,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: true
});

export const grayPurple = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e7cbef'),
    roughness: 0.55,
    metalness: 0.2,
    iridescence: 0.85,
    iridescenceIOR: 1.44,
    transmission: 0.6,
    ior: 1.4,
    thickness: 1,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
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
    dispersion: 5
});