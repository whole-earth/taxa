import * as THREE from 'three';
declare type SoftShadowsProps = {
    size?: number;
    samples?: number;
    focus?: number;
};
export declare const pcss: ({ focus, size, samples }?: SoftShadowsProps) => (gl: THREE.Renderer, scene: THREE.Scene, camera: THREE.Camera) => void;
export {};
