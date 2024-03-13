import * as THREE from 'three';
declare type FBOSettings = {
    samples?: number;
    depth?: boolean;
} & THREE.WebGLRenderTargetOptions;
declare function useFBO(width?: number, height?: number, settings?: FBOSettings): THREE.WebGLRenderTarget;
export { useFBO };
