import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from '../core/anim.js';

const isMobile = window.innerWidth < 768;

const MOBILE_CONFIG = {
    count: 140,
    sizeMultiplier: 1.2,
    sizes: [0.14, 0.18, 0.22],
    colors: {
        default: 0xffbb65
    },
    groups: {
        count: 3
    },
    animation: {
        fadeInDuration: 400,
        fadeOutDuration: 150
    },
    boxSize: 40
};

const DESKTOP_CONFIG = {
    count: 200,
    sizeMultiplier: 1,
    sizes: [0.12, 0.14, 0.16, 0.18, 0.22],
    colors: {
        default: 0xffbb65
    },
    groups: {
        count: 5,
        velocityMultipliers: [0.8, 0.9, 1.0, 1.1, 1.2]
    },
    animation: {
        fadeInDuration: 500,
        fadeOutDuration: 180,
        baseVelocity: 0.014
    }
};

const SPECKLE_CONFIG = isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;

class ProgressiveDisposal {
    constructor() {
        this.queue = [];
        this.chunkSize = 50;
        this.isProcessing = false;
        this.currentIndex = 0;
        this.onComplete = null;
        this.startTime = 0;
        this.disposed = new Set();
    }

    addToQueue(items, onComplete) {
        console.log(`🔄 Adding ${items.length} items to disposal queue`);
        this.queue = Array.isArray(items) ? items : [items];
        this.currentIndex = 0;
        this.isProcessing = true;
        this.onComplete = onComplete;
        this.startTime = performance.now();
        this.disposed.clear();
        
        // Start processing
        this.processNextChunk();
    }

    processNextChunk() {
        if (!this.isProcessing) return;

        const chunk = this.queue.slice(
            this.currentIndex,
            this.currentIndex + this.chunkSize
        );

        if (chunk.length === 0) {
            this.complete();
            return;
        }

        console.log(`📦 Processing disposal chunk ${this.currentIndex / this.chunkSize + 1}, items ${this.currentIndex} to ${this.currentIndex + chunk.length}`);
        
        // Process each item in the chunk
        chunk.forEach(item => {
            if (item.material) {
                if (Array.isArray(item.material)) {
                    item.material.forEach(m => {
                        if (!this.disposed.has(m.uuid)) {
                            m.dispose();
                            this.disposed.add(m.uuid);
                        }
                    });
                } else if (!this.disposed.has(item.material.uuid)) {
                    item.material.dispose();
                    this.disposed.add(item.material.uuid);
                }
            }
            
            if (item.geometry && !this.disposed.has(item.geometry.uuid)) {
                item.geometry.dispose();
                this.disposed.add(item.geometry.uuid);
            }
            
            if (item.dispose) {
                item.dispose();
            }
        });

        this.currentIndex += this.chunkSize;

        // Schedule next chunk
        requestAnimationFrame(() => this.processNextChunk());
    }

    complete() {
        const duration = performance.now() - this.startTime;
        console.log(`✨ Progressive disposal complete in ${duration.toFixed(2)}ms`);
        console.log(`📊 Disposed ${this.disposed.size} unique resources`);
        
        this.isProcessing = false;
        if (this.onComplete) {
            this.onComplete();
        }
    }

    cancel() {
        console.log('🛑 Cancelling progressive disposal');
        this.isProcessing = false;
        this.queue = [];
        this.currentIndex = 0;
        this.onComplete = null;
    }
}

class SpecklePool {
    constructor(size) {
        console.log(`🏊 Initializing SpecklePool with size ${size}`);
        this.size = size;
        this.matrices = new Array(size);
        this.vectors = new Array(size);
        this.available = new Set();
        this.inUse = new Set();
        
        // Pre-allocate resources
        for (let i = 0; i < size; i++) {
            this.matrices[i] = new THREE.Matrix4();
            this.vectors[i] = new THREE.Vector3();
            this.available.add(i);
        }
    }

    acquireMatrix() {
        if (this.available.size === 0) {
            console.warn('⚠️ SpecklePool: No available matrices');
            return new THREE.Matrix4();
        }
        
        const index = Array.from(this.available)[0];
        this.available.delete(index);
        this.inUse.add(index);
        return this.matrices[index];
    }

    acquireVector() {
        if (this.available.size === 0) {
            console.warn('⚠️ SpecklePool: No available vectors');
            return new THREE.Vector3();
        }
        
        const index = Array.from(this.available)[0];
        this.available.delete(index);
        this.inUse.add(index);
        return this.vectors[index];
    }

    release(object) {
        const index = this.matrices.indexOf(object) !== -1 ? 
            this.matrices.indexOf(object) : 
            this.vectors.indexOf(object);
            
        if (index !== -1) {
            this.inUse.delete(index);
            this.available.add(index);
        }
    }

    clear() {
        this.available = new Set(Array.from({ length: this.size }, (_, i) => i));
        this.inUse.clear();
    }
}

export class SpeckleSystem {
    constructor(scene, dotBounds, cellObject) {
        this.scene = scene;
        this.dotBounds = dotBounds;
        this.isMobile = window.innerWidth < 768;
        this.wavingBlob = this.createWavingBlob();
        
        if (cellObject) {
            cellObject.add(this.wavingBlob);
        }
        
        // Create a simpler geometry for instances - just 4x4 segments is enough for dots
        this.sharedGeometry = new THREE.SphereGeometry(1, 4, 4);
        
        // Create materials for each group
        this.materials = SPECKLE_CONFIG.sizes.map(() => new THREE.MeshBasicMaterial({ 
            color: SPECKLE_CONFIG.colors.default, 
            opacity: 0, 
            transparent: true, 
            depthWrite: true,
            depthTest: true,
            precision: this.isMobile ? 'lowp' : 'mediump'
        }));

        // Create instanced meshes for each size group
        this.instancedMeshes = [];
        this.instanceMatrices = []; // Store matrices for updates
        this.velocities = []; // Store velocities for desktop
        
        const countPerSize = Math.ceil(SPECKLE_CONFIG.count / SPECKLE_CONFIG.sizes.length);
        
        SPECKLE_CONFIG.sizes.forEach((size, sizeIndex) => {
            const instancedMesh = new THREE.InstancedMesh(
                this.sharedGeometry,
                this.materials[sizeIndex],  // Use group-specific material
                countPerSize
            );
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            instancedMesh.renderOrder = 2; // Set to render after blobs (which should be 0 and 1) but before ribbons
            
            const matrices = new Array(countPerSize);
            const velocities = !this.isMobile ? new Array(countPerSize) : null;
            
            // Initialize positions and matrices
            for (let i = 0; i < countPerSize; i++) {
                const matrix = new THREE.Matrix4();
                const position = this.getRandomPositionWithinBounds();
                const scale = size * SPECKLE_CONFIG.sizeMultiplier;
                
                matrix.makeScale(scale, scale, scale);
                matrix.setPosition(position);
                instancedMesh.setMatrixAt(i, matrix);
                matrices[i] = matrix;
                
                if (!this.isMobile) {
                    const randomDirection = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                    velocities[i] = randomDirection.multiplyScalar(
                        DESKTOP_CONFIG.animation.baseVelocity
                    );
                }
            }
            
            this.instancedMeshes.push(instancedMesh);
            this.instanceMatrices.push(matrices);
            if (!this.isMobile) this.velocities.push(velocities);
            
            this.wavingBlob.add(instancedMesh);
        });
        
        // Update function for desktop
        if (!this.isMobile) {
            this.updatePositions = this.createUpdatePositionsFunction();
        } else {
            this.updatePositions = () => {};
        }

        this.disposalManager = new ProgressiveDisposal();
        this.pool = new SpecklePool(this.isMobile ? MOBILE_CONFIG.count : DESKTOP_CONFIG.count);
    }

    createWavingBlob() {
        const wavingBlob = new THREE.Group();
        wavingBlob.renderOrder = 2; // Match the instancedMesh renderOrder
        return wavingBlob;
    }

    getRandomPositionWithinBounds() {
        if (this.isMobile) {
            return new THREE.Vector3(
                (Math.random() - 0.5) * MOBILE_CONFIG.boxSize,
                (Math.random() - 0.5) * MOBILE_CONFIG.boxSize,
                (Math.random() - 0.5) * MOBILE_CONFIG.boxSize
            );
        }
        
        const scale = 0.65;
        return new THREE.Vector3(
            (Math.random() * 2 - 1) * (this.dotBounds * scale),
            (Math.random() * 2 - 1) * (this.dotBounds * scale),
            (Math.random() * 2 - 1) * (this.dotBounds * scale)
        );
    }

    createUpdatePositionsFunction() {
        const tempMatrix = new THREE.Matrix4();
        const tempPosition = new THREE.Vector3();
        const tempQuaternion = new THREE.Quaternion();  // Add quaternion for decompose
        const tempScale = new THREE.Vector3();
        
        return function() {
            if (!this.wavingBlob.visible) return;
            
            this.instancedMeshes.forEach((instancedMesh, meshIndex) => {
                if (!instancedMesh.visible) return;
                
                const matrices = this.instanceMatrices[meshIndex];
                const velocities = this.velocities[meshIndex];
                const dotBoundsSquared = this.dotBounds * this.dotBounds;
                let needsUpdate = false;
                
                for (let i = 0; i < matrices.length; i++) {
                    const matrix = matrices[i];
                    matrix.decompose(tempPosition, tempQuaternion, tempScale);
                    
                    tempPosition.add(velocities[i]);
                    
                    if (tempPosition.lengthSq() > dotBoundsSquared) {
                        velocities[i].negate();
                    }
                    
                    // Optimize by composing directly without recreating scale matrix
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    instancedMesh.setMatrixAt(i, tempMatrix);
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    instancedMesh.instanceMatrix.needsUpdate = true;
                }
            });
        };
    }

    tweenExplosion(duration, startingGroupIndex = 0) {
        const DELAY_BETWEEN_GROUPS = 400; // 0.4 seconds delay between groups
        
        const startExplosionForGroup = (groupIndex) => {
            const instancedMesh = this.instancedMeshes[groupIndex];
            if (!instancedMesh) return;
            
            const material = this.materials[groupIndex];
            const isMobile = window.innerWidth < 768;
            
            // Create a group to handle scaling
            const group = new THREE.Group();
            this.wavingBlob.add(group);
            group.add(instancedMesh);
            
            const tweenState = { scale: 1, opacity: material.opacity };
            
            const explosionTween = new Tween(tweenState)
                .to({ 
                    scale: 1.8,
                    opacity: 0 
                }, isMobile ? duration * 0.8 : duration)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(() => {
                    // Update group scale
                    group.scale.setScalar(tweenState.scale);
                    
                    // Update material opacity
                    material.opacity = Math.max(0, tweenState.opacity);
                    material.needsUpdate = true;
                })
                .onComplete(() => {
                    state.blobTweenGroup.remove(explosionTween);
                    // Move the mesh back to wavingBlob and remove the temporary group
                    this.wavingBlob.add(instancedMesh);
                    this.wavingBlob.remove(group);
                    group.remove(instancedMesh);
                    
                    // Start next group if there is one
                    const nextGroupIndex = groupIndex + 1;
                    if (nextGroupIndex < this.instancedMeshes.length) {
                        setTimeout(() => {
                            startExplosionForGroup(nextGroupIndex);
                        }, DELAY_BETWEEN_GROUPS);
                    }
                });

            state.blobTweenGroup.add(explosionTween);
            explosionTween.start();
        };
        
        // Start with the first group
        startExplosionForGroup(startingGroupIndex);
    }

    tweenOpacity(targetOpacity, duration) {
        const tweens = this.materials.map((material, index) => {
            const tweenState = { opacity: material.opacity };
            
            return new Tween(tweenState)
                .to({ opacity: targetOpacity }, duration)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(() => {
                    material.opacity = tweenState.opacity;
                    material.needsUpdate = true;
                })
                .onComplete(() => {
                    state.dotTweenGroup.remove(tweens[index]);
                });
        });

        tweens.forEach(tween => {
            state.dotTweenGroup.add(tween);
            tween.start();
        });
    }

    reset() {
        // Make sure wavingBlob is visible first
        this.wavingBlob.visible = true;
        
        // Reset visibility and opacity
        this.instancedMeshes.forEach((instancedMesh, meshIndex) => {
            instancedMesh.visible = true;
            this.materials[meshIndex].opacity = 0;
            this.materials[meshIndex].needsUpdate = true;
            
            // Ensure mesh is directly under wavingBlob
            if (instancedMesh.parent !== this.wavingBlob) {
                this.wavingBlob.add(instancedMesh);
            }
            
            // Reset scale
            instancedMesh.scale.setScalar(1);
            
            // Reset positions and scales
            const matrices = this.instanceMatrices[meshIndex];
            const velocities = this.velocities[meshIndex];
            const size = SPECKLE_CONFIG.sizes[meshIndex];
            
            const tempMatrix = new THREE.Matrix4();
            
            for (let i = 0; i < matrices.length; i++) {
                const matrix = matrices[i];
                const position = this.getRandomPositionWithinBounds();
                const scale = size * SPECKLE_CONFIG.sizeMultiplier;
                
                // Reset matrix with original scale and new position
                tempMatrix.makeScale(scale, scale, scale);
                tempMatrix.setPosition(position);
                
                instancedMesh.setMatrixAt(i, tempMatrix);
                matrix.copy(tempMatrix);
                
                // Reset velocity for desktop
                if (!this.isMobile && velocities) {
                    const randomDirection = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                    velocities[i] = randomDirection.multiplyScalar(DESKTOP_CONFIG.animation.baseVelocity);
                }
            }
            
            instancedMesh.instanceMatrix.needsUpdate = true;
        });
    }

    updateColors(color) {
        this.materials.forEach((material, index) => {
            material.color = new THREE.Color(color);
            material.needsUpdate = true;
        });
    }

    randomizePositions() {
        this.instancedMeshes.forEach((instancedMesh, meshIndex) => {
            const matrices = this.instanceMatrices[meshIndex];
            const velocities = this.velocities[meshIndex];
            
            for (let i = 0; i < matrices.length; i++) {
                const matrix = matrices[i];
                const position = this.getRandomPositionWithinBounds();
                
                // Create a temporary matrix for the new transform
                const tempMatrix = new THREE.Matrix4();
                matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3());
                tempMatrix.makeScale(matrix.elements[0], matrix.elements[5], matrix.elements[10]); // Extract scale from diagonal
                tempMatrix.setPosition(position);
                
                // Update the instance matrix
                instancedMesh.setMatrixAt(i, tempMatrix);
                matrix.copy(tempMatrix);
                
                if (!this.isMobile && velocities) {
                    const randomDirection = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                    velocities[i] = randomDirection.multiplyScalar(DESKTOP_CONFIG.animation.baseVelocity);
                }
            }
            instancedMesh.instanceMatrix.needsUpdate = true;
        });
    }

    dispose() {
        console.time('SpeckleSystem.dispose');
        console.log('🔥 Starting SpeckleSystem progressive disposal');

        // First dispose shared geometry
        if (this.sharedGeometry) {
            this.sharedGeometry.dispose();
            console.log('✅ Disposed shared geometry');
        }

        // Queue materials and meshes for progressive disposal
        const itemsToDispose = [
            ...this.materials,
            ...this.instancedMeshes
        ];

        this.disposalManager.addToQueue(itemsToDispose, () => {
            console.timeEnd('SpeckleSystem.dispose');
            console.log('✨ SpeckleSystem disposal complete');
            
            // Clear the object pool
            this.pool.clear();
            console.log('🏊 Object pool cleared');
        });
    }
} 