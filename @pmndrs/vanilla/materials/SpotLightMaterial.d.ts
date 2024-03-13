import { Color, Vector2, Vector3, type Texture } from 'three';
declare type SpotLightMaterialProps = {
    depth: Texture | null;
    opacity: number;
    attenuation: number;
    anglePower: number;
    spotPosition: Vector3;
    lightColor: Color;
    cameraNear: number;
    cameraFar: number;
    resolution: Vector2;
    transparent: boolean;
    depthWrite: boolean;
};
export declare const SpotLightMaterial: (new (parameters?: (import("three").ShaderMaterialParameters & Partial<SpotLightMaterialProps>) | undefined) => import("three").ShaderMaterial & SpotLightMaterialProps) & {
    key: string;
};
export {};
