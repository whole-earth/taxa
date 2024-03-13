import * as THREE from 'three';
interface Uniform<T> {
    value: T;
}
export declare class MeshTransmissionMaterial extends THREE.MeshPhysicalMaterial {
    uniforms: {
        chromaticAberration: Uniform<number>;
        transmission: Uniform<number>;
        transmissionMap: Uniform<THREE.Texture | null>;
        _transmission: Uniform<number>;
        thickness: Uniform<number>;
        roughness: Uniform<number>;
        thicknessMap: Uniform<THREE.Texture | null>;
        attenuationDistance: Uniform<number>;
        attenuationColor: Uniform<THREE.Color>;
        anisotropicBlur: Uniform<number>;
        time: Uniform<number>;
        distortion: Uniform<number>;
        distortionScale: Uniform<number>;
        temporalDistortion: Uniform<number>;
        buffer: Uniform<THREE.Texture | null>;
    };
    constructor({ samples, transmissionSampler, chromaticAberration, transmission, _transmission, transmissionMap, roughness, thickness, thicknessMap, attenuationDistance, attenuationColor, anisotropicBlur, time, distortion, distortionScale, temporalDistortion, buffer, }?: {
        samples?: number | undefined;
        transmissionSampler?: boolean | undefined;
        chromaticAberration?: number | undefined;
        transmission?: number | undefined;
        _transmission?: number | undefined;
        transmissionMap?: null | undefined;
        roughness?: number | undefined;
        thickness?: number | undefined;
        thicknessMap?: null | undefined;
        attenuationDistance?: number | undefined;
        attenuationColor?: THREE.Color | undefined;
        anisotropicBlur?: number | undefined;
        time?: number | undefined;
        distortion?: number | undefined;
        distortionScale?: number | undefined;
        temporalDistortion?: number | undefined;
        buffer?: null | undefined;
    });
}
export {};
