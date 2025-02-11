/**
 * Disposes of a Three.js object and all its children recursively
 * @param {Object3D} object - The Three.js object to dispose
 */
export function disposeHierarchy(object) {
    if (!object) return;
    
    object.traverse(node => {
        disposeNode(node);
    });
}

/**
 * Disposes of a single Three.js node's resources
 * @param {Object3D} node - The Three.js node to dispose
 */
export function disposeNode(node) {
    if (!node) return;

    // Dispose geometries
    if (node.geometry) {
        node.geometry.dispose();
    }

    // Dispose materials
    if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(material => {
            Object.keys(material).forEach(prop => {
                if (!material[prop]) return;
                
                // Dispose textures
                if (material[prop].isTexture) {
                    material[prop].dispose();
                }
                // Dispose render targets
                if (material[prop].isWebGLRenderTarget) {
                    material[prop].dispose();
                }
            });
            material.dispose();
        });
    }

    // Remove from parent
    if (node.parent) {
        node.parent.remove(node);
    }

    // Clear any references
    node.clear();
} 