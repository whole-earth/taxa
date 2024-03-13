import * as THREE from 'three';
declare type UniformValue = THREE.CubeTexture | THREE.Texture | Int32Array | Float32Array | THREE.Matrix4 | THREE.Matrix3 | THREE.Quaternion | THREE.Vector4 | THREE.Vector3 | THREE.Vector2 | THREE.Color | number | boolean | Array<any> | null;
declare type UniformProps = {
    [name: string]: UniformValue;
};
declare type ShaderMaterialInstance<TProps extends UniformProps> = THREE.ShaderMaterial & TProps;
declare type ShaderMaterialParameters<TProps extends UniformProps> = THREE.ShaderMaterialParameters & Partial<TProps>;
declare type ShaderMaterial<TProps extends UniformProps> = (new (parameters?: ShaderMaterialParameters<TProps>) => ShaderMaterialInstance<TProps>) & {
    key: string;
};
export declare function shaderMaterial<TProps extends UniformProps>(uniforms: TProps, vertexShader: string, fragmentShader: string, onInit?: (material: ShaderMaterialInstance<TProps>) => void): ShaderMaterial<TProps>;
export {};
