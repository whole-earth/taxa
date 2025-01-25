import * as THREE from 'three';

let meshLineModule = null;

// Wait for both Three.js and MeshLine to be available
function waitForDependencies() {
    return new Promise((resolve) => {
        function check() {
            if (window.THREE && window.MeshLine) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    });
}

async function initMeshLine() {
    await waitForDependencies();
    return {
        MeshLine: window.MeshLine,
        MeshLineMaterial: window.MeshLineMaterial,
        MeshLineRaycast: window.MeshLineRaycast
    };
}

export async function getMeshLineComponents() {
    if (!meshLineModule) {
        meshLineModule = await initMeshLine();
    }
    return meshLineModule;
}

// Initialize immediately but don't block
const modulePromise = getMeshLineComponents();

// Export a way to wait for the module to be ready
export function waitForMeshLine() {
    return modulePromise;
}

// Export the components (they'll be undefined until initialized)
export const MeshLine = window.MeshLine;
export const MeshLineMaterial = window.MeshLineMaterial;
export const MeshLineRaycast = window.MeshLineRaycast; 