import * as THREE from 'three';
declare type SoftShadowMaterialProps = {
    map: THREE.Texture | null;
    color: THREE.Color;
    alphaTest: number;
    opacity: number;
    blend: number;
};
declare const SoftShadowMaterial: (new (parameters?: (THREE.ShaderMaterialParameters & Partial<SoftShadowMaterialProps>) | undefined) => THREE.ShaderMaterial & SoftShadowMaterialProps) & {
    key: string;
};
declare class ProgressiveLightMap {
    renderer: THREE.WebGLRenderer;
    res: number;
    scene: THREE.Scene;
    object: THREE.Mesh | null;
    buffer1Active: boolean;
    progressiveLightMap1: THREE.WebGLRenderTarget;
    progressiveLightMap2: THREE.WebGLRenderTarget;
    discardMat: THREE.ShaderMaterial;
    targetMat: THREE.MeshLambertMaterial;
    previousShadowMap: {
        value: THREE.Texture;
    };
    averagingWindow: {
        value: number;
    };
    clearColor: THREE.Color;
    clearAlpha: number;
    lights: {
        object: THREE.Light;
        intensity: number;
    }[];
    meshes: {
        object: THREE.Mesh;
        material: THREE.Material | THREE.Material[];
    }[];
    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, res?: number);
    clear(): void;
    prepare(): void;
    finish(): void;
    configure(object: THREE.Mesh): void;
    update(camera: THREE.Camera, blendWindow?: number): void;
}
export { SoftShadowMaterial, ProgressiveLightMap };
