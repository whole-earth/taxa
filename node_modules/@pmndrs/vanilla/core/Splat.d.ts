import * as THREE from 'three';
export declare type SplatMaterialType = {
    alphaTest?: number;
    alphaHash?: boolean;
    centerAndScaleTexture?: THREE.DataTexture;
    covAndColorTexture?: THREE.DataTexture;
    viewport?: THREE.Vector2;
    focal?: number;
};
export declare type TargetMesh = THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial & SplatMaterialType> & {
    ready: boolean;
    sorted: boolean;
    pm: THREE.Matrix4;
    vm1: THREE.Matrix4;
    vm2: THREE.Matrix4;
    viewport: THREE.Vector4;
};
export declare type SharedState = {
    url: string;
    gl: THREE.WebGLRenderer;
    worker: Worker;
    manager: THREE.LoadingManager;
    stream: ReadableStreamDefaultReader<Uint8Array>;
    loading: boolean;
    loaded: boolean;
    loadedVertexCount: number;
    rowLength: number;
    maxVertexes: number;
    chunkSize: number;
    totalDownloadBytes: number;
    numVertices: number;
    bufferTextureWidth: number;
    bufferTextureHeight: number;
    centerAndScaleData: Float32Array;
    covAndColorData: Uint32Array;
    covAndColorTexture: THREE.DataTexture;
    centerAndScaleTexture: THREE.DataTexture;
    connect(target: TargetMesh): () => void;
    update(target: TargetMesh, camera: THREE.Camera, hashed: boolean): void;
    onProgress?: (event: ProgressEvent) => void;
};
export declare class SplatLoader extends THREE.Loader {
    gl: THREE.WebGLRenderer;
    chunkSize: number;
    constructor(gl: THREE.WebGLRenderer, chunkSize?: number);
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<unknown>;
    load(url: string, onLoad: (data: SharedState) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): void;
}
export declare class Splat extends THREE.Mesh {
    constructor(shared: any, camera: THREE.Camera, { toneMapped, alphaTest, alphaHash }?: {
        toneMapped?: boolean | undefined;
        alphaTest?: number | undefined;
        alphaHash?: boolean | undefined;
    });
}
