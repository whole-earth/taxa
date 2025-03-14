import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { PRODUCT_COLORS } from '../effects/podColors.js';
import { setApplicatorObject } from '../core/anim.js';
import { materialManager } from '../utils/materialManager.js';

/**
 * Base class for 3D components with common loading functionality
 */
class BaseComponent {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
        this.loader.setDRACOLoader(dracoLoader);
        this.position = new THREE.Vector3(0, 0, 0);
        
        // Pre-allocate reusable objects for matrix operations
        this._tempVector = new THREE.Vector3();
        this._tempMatrix = new THREE.Matrix4();
    }

    centerObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(this._tempVector);
        object.position.sub(center);
    }
    
    // Helper method to batch update materials using the global manager
    batchUpdateMaterials(materials) {
        if (materials && materials.length > 0) {
            materialManager.queueMaterialUpdate(materials);
        }
    }
    
    // Helper method to collect all materials from an object
    collectMaterials(object) {
        const materials = [];
        if (!object) return materials;
        
        object.traverse(node => {
            if (node.isMesh && node.material) {
                if (Array.isArray(node.material)) {
                    materials.push(...node.material);
                } else {
                    materials.push(node.material);
                }
            }
        });
        
        return materials;
    }
}

/**
 * Handles loading and setup of cell-related 3D components
 */
export class CellComponent extends BaseComponent {
    constructor(scene, gltf, shader = null, renderOrder = 1, onProgress = null) {
        super(scene);
        this.gltfFileName = gltf;
        this.shader = shader;
        this.renderOrder = renderOrder;
        this.boundingBox = new THREE.Box3();
        this.object = null;
        this.onProgress = onProgress;
        
        // Return a promise that resolves to this instance
        return (async () => {
            await this.loadObject();
            return this;
        })();
    }

    async loadObject() {
        return new Promise((resolve, reject) => {
            const fullPath = 'https://cdn.jsdelivr.net/gh/whole-earth/taxa@main/assets/cell/' + this.gltfFileName;
            
            this.loader.load(
                fullPath, 
                (gltf) => {
                    this.object = gltf.scene;
                    this.object.position.copy(this.position);
                    this.object.name = this.gltfFileName.split('/').pop();
                    this.centerObject(this.object);
                    
                    if (this.shader) {
                        this.applyCustomShader(this.shader);
                    }
                    
                    this.object.renderOrder = this.renderOrder;
                    this.boundingBox.setFromObject(this.object);
                    resolve();
                },
                (progress) => {
                    if (this.onProgress) {
                        this.onProgress(progress);
                    }
                },
                reject
            );
        });
    }

    applyCustomShader(shader) {
        if (!shader) return;
        const materialsToUpdate = [];
        
        this.object.traverse((node) => {
            if (node.isMesh) {
                node.material = shader;
                materialsToUpdate.push(node.material);
            }
        });
        
        // Batch update all materials at once
        this.batchUpdateMaterials(materialsToUpdate);
    }

    getBoundingBox() {
        return this.boundingBox;
    }

    // Add method to get the Three.js object
    getObject() {
        return this.object;
    }
}

/**
 * Handles loading and setup of product-related 3D components
 */
export class ProductComponent extends BaseComponent {
    constructor(scene, gltf, renderOrder = 1, onProgress) {
        super(scene);
        this.gltfFileName = gltf;
        this.renderOrder = renderOrder;
        this.object = null;
        this.onProgress = onProgress;
        
        // Return a promise that resolves to this instance
        return (async () => {
            await this.loadObject();
            return this;
        })();
    }

    async loadObject() {
        return new Promise((resolve, reject) => {
            const fullPath = 'https://cdn.jsdelivr.net/gh/whole-earth/taxa@main/assets/product/' + this.gltfFileName;

            this.loader.load(
                fullPath,
                (gltf) => {
                    this.object = gltf.scene;
                    // Make entire object invisible initially
                    this.object.visible = false;
                    this.object.position.copy(this.position);
                    this.object.name = this.gltfFileName.split('/').pop();
                    this.centerObject(this.object);
                    this.object.rotation.x = Math.PI / 2;
                    this.object.renderOrder = this.renderOrder;

                    this.initializeMaterials();
                    
                    // Set applicator object in state
                    const applicator = this.object.getObjectByName('applicator');
                    if (applicator) {
                        setApplicatorObject(applicator);
                        this.setupApplicator(applicator);
                    }

                    resolve();
                },
                (progress) => {
                    if (this.onProgress) {
                        this.onProgress(progress.loaded / progress.total);
                    }
                },
                reject
            );
        });
    }

    getObject() {
        return this.object;
    }

    initializeMaterials() {
        // Set all meshes invisible initially
        const materialsToUpdate = [];
        const innerCapMaterials = [];
        
        this.object.traverse(child => {
            if (child.isMesh) {
                child.visible = false;
                if (!child.material) {
                    child.material = new THREE.MeshStandardMaterial();
                }
                child.material.transparent = true;
                child.material.opacity = 0;
                materialsToUpdate.push(child.material);
            }

            // Special handling for inner-cap object
            if (child.name === 'inner-cap') {
                child.traverse(innerChild => {
                    if (innerChild.isMesh) {
                        innerChild.material = new THREE.MeshStandardMaterial({
                            color: new THREE.Color(PRODUCT_COLORS.orange),
                            emissive: new THREE.Color(PRODUCT_COLORS.orange),
                            transparent: true,
                            opacity: 0,
                            metalness: 0.5,
                            roughness: 0.2
                        });
                        innerCapMaterials.push(innerChild.material);
                    }
                });
            }
        });
        
        // Batch update all materials at once
        this.batchUpdateMaterials(materialsToUpdate);
        this.batchUpdateMaterials(innerCapMaterials);
    }

    setupApplicator(applicator) {
        applicator.position.y = 0;

        const maskMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(255/255, 251/255, 244/255) }
            },
            vertexShader: `
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                void main() {
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            depthWrite: true,
            depthTest: true,
            transparent: true,
            opacity: 1,
            toneMapped: false
        });

        const shape = new THREE.Shape();
        const planeSize = 10;
        shape.moveTo(-planeSize / 2, -planeSize / 2);
        shape.lineTo(planeSize / 2, -planeSize / 2);
        shape.lineTo(planeSize / 2, planeSize / 2);
        shape.lineTo(-planeSize / 2, planeSize / 2);
        shape.lineTo(-planeSize / 2, -planeSize / 2);

        // Add the circular hole
        const holePath = new THREE.Path();
        const holeRadius = 1.04;
        holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
        shape.holes.push(holePath);

        const planeGeometry = new THREE.ShapeGeometry(shape);

        const planeMesh = new THREE.Mesh(planeGeometry, maskMaterial);
        planeMesh.visible = true;
        planeMesh.renderOrder = -1;
        planeMesh.rotation.x = Math.PI / 2;

        // Create cylinder geometry
        const cylinderGeometry = new THREE.CylinderGeometry(
            holeRadius * 4,  // end radius
            holeRadius * 2,  // start radius
            10,              // height
            8,               // radial segments
            1,               // height segments
            true             // open ended
        );

        const cylinderMesh = new THREE.Mesh(cylinderGeometry, maskMaterial);
        cylinderMesh.position.y = 6;
        cylinderMesh.renderOrder = -1;

        // Create a parent group for the overflow mask
        const overflowMaskGroup = new THREE.Group();
        overflowMaskGroup.name = 'overflowMask';
        overflowMaskGroup.position.y = 2.75;

        // Add both meshes to the group
        overflowMaskGroup.add(planeMesh);
        overflowMaskGroup.add(cylinderMesh);
        applicator.add(overflowMaskGroup);

        const materialsToUpdate = [];
        applicator.traverse(child => {
            if (child.isMesh) {
                child.visible = false;
                child.material.transparent = true;
                child.material.opacity = 0;
                materialsToUpdate.push(child.material);
            }
        });
        
        // Batch update all materials at once
        this.batchUpdateMaterials(materialsToUpdate);
    }
} 