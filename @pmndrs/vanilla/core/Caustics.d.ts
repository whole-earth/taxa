import * as THREE from 'three';
declare type CausticsProps = {
    frames?: number;
    causticsOnly?: boolean;
    backside?: boolean;
    ior?: number;
    backsideIOR?: number;
    worldRadius?: number;
    intensity?: number;
    color?: THREE.Color;
    resolution?: number;
    lightSource?: THREE.Vector3 | THREE.Object3D;
    near?: number;
    far?: number;
};
export declare type CausticsType = {
    scene: THREE.Scene;
    group: THREE.Group;
    helper: THREE.CameraHelper;
    params: CausticsProps;
    update: () => void;
    normalTarget: THREE.WebGLRenderTarget;
    normalTargetB: THREE.WebGLRenderTarget;
    causticsTarget: THREE.WebGLRenderTarget;
    causticsTargetB: THREE.WebGLRenderTarget;
};
export declare const Caustics: (renderer: THREE.WebGLRenderer, { frames, causticsOnly, ior, backside, backsideIOR, worldRadius, color, intensity, resolution, lightSource, near, far, }?: CausticsProps) => CausticsType;
export {};
