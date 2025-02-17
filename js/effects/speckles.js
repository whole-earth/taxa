import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from '../core/anim.js';

const isMobile = window.innerWidth < 768;

const MOBILE_CONFIG = {
    count: 140,
    size: 0.3,
    colors: {
        default: 0xffbb65
    },
    animation: {
        fadeInDuration: 400,
        fadeOutDuration: 150
    },
    boxSize: 24
};

const DESKTOP_CONFIG = {
    count: 600,
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

const PERFORMANCE_CONFIG = {
    frameSkip: isMobile ? 2 : 1,  // Update every N frames
    batchSize: isMobile ? 16 : 32, // Smaller batches for mobile
    cullingDistance: 100,  // Distance for frustum culling
    poolSize: isMobile ? 
        MOBILE_CONFIG.count : 
        DESKTOP_CONFIG.count * DESKTOP_CONFIG.sizes.length
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
        
        // Pre-calculate values used frequently
        this.boxSizeHalf = (this.isMobile ? MOBILE_CONFIG.boxSize : this.dotBounds) * 0.5;
        
        this.wavingBlob = this.createWavingBlob();
        
        if (cellObject) {
            cellObject.add(this.wavingBlob);
        }
        
        // Use simpler geometry for mobile
        this.sharedGeometry = new THREE.SphereGeometry(1, 4, 4);
        
        // Cache frequently used values
        this.dotBoundsSquared = this.dotBounds * this.dotBounds;
        this.boundsBuffer = Math.sqrt(this.dotBoundsSquared) * 0.98;
        
        // Optimize material creation
        const materialConfig = {
            color: SPECKLE_CONFIG.colors.default,
            opacity: 0,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            precision: 'lowp',
            fog: false,
            flatShading: true,
            side: THREE.FrontSide
        };

        // Create materials - single material for mobile, multiple for desktop
        if (this.isMobile) {
            this.materials = [new THREE.MeshBasicMaterial(materialConfig)];
        } else {
            this.materials = DESKTOP_CONFIG.sizes.map(() => new THREE.MeshBasicMaterial(materialConfig));
        }

        // Add frame counter for update throttling
        this.frameCount = 0;
        
        // Add frustum culling support
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), PERFORMANCE_CONFIG.cullingDistance);
        
        // Pre-allocate more reusable objects
        this.tempMatrix = new THREE.Matrix4();
        this.tempPosition = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3();
        this.tempVector = new THREE.Vector3();
        this.noRotation = new THREE.Quaternion();
        this.tempColor = new THREE.Color();
        
        // Initialize instanced meshes
        if (this.isMobile) {
            this.initializeMobileInstancedMesh();
        } else {
            const countPerSize = Math.ceil(DESKTOP_CONFIG.count / DESKTOP_CONFIG.sizes.length);
            this.initializeInstancedMeshes(countPerSize);
        }
        
        // Optimize update function
        if (!this.isMobile) {
            this.updatePositions = this.createUpdatePositionsFunction();
        } else {
            this.updatePositions = () => {};
        }

        // Initialize object pool with optimized size
        this.disposalManager = new ProgressiveDisposal();
        this.pool = new SpecklePool(PERFORMANCE_CONFIG.poolSize);
    }

    initializeMobileInstancedMesh() {
        this.instancedMeshes = [];
        this.instanceMatrices = [];
        
        const instancedMesh = new THREE.InstancedMesh(
            this.sharedGeometry,
            this.materials[0],
            MOBILE_CONFIG.count
        );
        
        instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        instancedMesh.renderOrder = 2;
        
        const matrices = new Array(MOBILE_CONFIG.count);
        const scale = MOBILE_CONFIG.size;
        this.tempScale.set(scale, scale, scale);
        
        // Batch matrix updates
        for (let i = 0; i < MOBILE_CONFIG.count; i++) {
            const matrix = new THREE.Matrix4();
            this.getRandomPositionWithinBounds();
            
            // Use pre-allocated objects
            matrix.compose(this.tempPosition, this.noRotation, this.tempScale);
            instancedMesh.setMatrixAt(i, matrix);
            matrices[i] = matrix;
        }
        
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        this.instancedMeshes.push(instancedMesh);
        this.instanceMatrices.push(matrices);
        
        this.wavingBlob.add(instancedMesh);
    }

    initializeInstancedMeshes(countPerSize) {
        this.instancedMeshes = [];
        this.instanceMatrices = [];
        this.velocities = !this.isMobile ? [] : null;
        
        SPECKLE_CONFIG.sizes.forEach((size, sizeIndex) => {
            const instancedMesh = new THREE.InstancedMesh(
                this.sharedGeometry,
                this.materials[sizeIndex],
                countPerSize
            );
            
            instancedMesh.instanceMatrix.setUsage(this.isMobile ? THREE.StaticDrawUsage : THREE.DynamicDrawUsage);
            instancedMesh.renderOrder = 2;
            
            const matrices = new Array(countPerSize);
            const velocities = !this.isMobile ? new Array(countPerSize) : null;
            const scale = size;
            
            // Batch matrix updates
            for (let i = 0; i < countPerSize; i++) {
                const matrix = new THREE.Matrix4();
                const position = this.getRandomPositionWithinBounds();
                
                matrix.makeScale(scale, scale, scale);
                matrix.setPosition(position);
                instancedMesh.setMatrixAt(i, matrix);
                matrices[i] = matrix;
                
                // Initialize velocities for desktop only
                if (!this.isMobile && velocities) {
                    const randomDirection = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                    velocities[i] = randomDirection.multiplyScalar(DESKTOP_CONFIG.animation.baseVelocity);
                }
            }
            
            // Single update after all matrices are set
            instancedMesh.instanceMatrix.needsUpdate = true;
            
            this.instancedMeshes.push(instancedMesh);
            this.instanceMatrices.push(matrices);
            if (!this.isMobile && velocities) {
                this.velocities.push(velocities);
            }
            
            this.wavingBlob.add(instancedMesh);
        });
    }

    createWavingBlob() {
        const wavingBlob = new THREE.Group();
        wavingBlob.renderOrder = 2; // Match the instancedMesh renderOrder
        return wavingBlob;
    }

    getRandomPositionWithinBounds() {
        if (this.isMobile) {
            return this.tempPosition.set(
                (Math.random() - 0.5) * this.boxSizeHalf * 2,
                (Math.random() - 0.5) * this.boxSizeHalf * 2,
                (Math.random() - 0.5) * this.boxSizeHalf * 2
            );
        }
        
        const scaledBounds = this.dotBounds * 0.65;
        return this.tempPosition.set(
            (Math.random() * 2 - 1) * scaledBounds,
            (Math.random() * 2 - 1) * scaledBounds,
            (Math.random() * 2 - 1) * scaledBounds
        );
    }

    createUpdatePositionsFunction() {
        return function(camera) {
            // Skip frames based on config
            if (this.frameCount++ % PERFORMANCE_CONFIG.frameSkip !== 0) return;
            
            // Early exit conditions
            if (!this.wavingBlob?.visible || !this.velocities?.length) return;
            
            // Only do frustum culling if camera is provided
            let isVisible = true;
            if (camera?.projectionMatrix) {
                // Update frustum culling
                this.projScreenMatrix.multiplyMatrices(
                    camera.projectionMatrix,
                    camera.matrixWorldInverse
                );
                this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
                
                // Update bounding sphere position to match wavingBlob
                this.boundingSphere.center.copy(this.wavingBlob.position);
                
                // Check visibility
                isVisible = this.frustum.intersectsSphere(this.boundingSphere);
            }
            
            // Skip updates if not visible
            if (!isVisible) return;
            
            this.instancedMeshes.forEach((instancedMesh, meshIndex) => {
                if (!instancedMesh?.visible) return;
                
                const matrices = this.instanceMatrices?.[meshIndex];
                const velocities = this.velocities?.[meshIndex];
                if (!matrices?.length || !velocities?.length) return;
                
                let needsUpdate = false;
                const count = matrices.length;
                
                // Process in optimized batches
                const batchSize = PERFORMANCE_CONFIG.batchSize;
                for (let batch = 0; batch < count; batch += batchSize) {
                    const end = Math.min(batch + batchSize, count);
                    
                    for (let i = batch; i < end; i++) {
                        const matrix = matrices[i];
                        const velocity = velocities[i];
                        if (!matrix || !velocity) continue;
                        
                        matrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);
                        this.tempPosition.add(velocity);
                        
                        if (this.tempPosition.lengthSq() > this.dotBoundsSquared) {
                            velocity.negate();
                            this.tempPosition.normalize().multiplyScalar(this.boundsBuffer);
                        }
                        
                        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
                        instancedMesh.setMatrixAt(i, this.tempMatrix);
                        needsUpdate = true;
                    }
                }
                
                if (needsUpdate) {
                    instancedMesh.instanceMatrix.needsUpdate = true;
                }
            });
        };
    }

    tweenExplosion(duration, startingGroupIndex = 0) {
        if (this.isMobile) {
            // Single explosion for all dots on mobile - ignore startingGroupIndex
            const material = this.materials[0];
            const mesh = this.instancedMeshes[0];
            
            if (!material || !mesh) return;
            
            // Ensure any previous explosion is cleaned up
            state.blobTweenGroup.removeAll();
            
            const tweenState = { scale: 1, opacity: material.opacity };
            
            const explosionTween = new Tween(tweenState)
                .to({ scale: 1.5, opacity: 0 }, duration * 0.6)
                .easing(Easing.Quadratic.Out)
                .onUpdate(() => {
                    mesh.scale.setScalar(tweenState.scale);
                    material.opacity = Math.max(0, tweenState.opacity);
                    material.needsUpdate = true;
                })
                .onComplete(() => {
                    state.blobTweenGroup.remove(explosionTween);
                    // Ensure mesh is hidden after explosion
                    mesh.visible = false;
                });

            state.blobTweenGroup.add(explosionTween);
            explosionTween.start();
            return;
        }

        // Existing desktop implementation
        const DELAY_BETWEEN_GROUPS = 400;
        
        const startExplosionForGroup = (groupIndex) => {
            const instancedMesh = this.instancedMeshes[groupIndex];
            if (!instancedMesh) return;
            
            const material = this.materials[groupIndex];
            
            // Create a group to handle scaling
            const group = new THREE.Group();
            this.wavingBlob.add(group);
            group.add(instancedMesh);
            
            const tweenState = { scale: 1, opacity: material.opacity };
            
            const explosionTween = new Tween(tweenState)
                .to({ 
                    scale: 1.8,
                    opacity: 0 
                }, duration)
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
                    instancedMesh.visible = false;
                    
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
        if (this.isMobile) {
            // Single tween for the only material on mobile
            const material = this.materials[0];
            const tweenState = { opacity: material.opacity };
            
            const tween = new Tween(tweenState)
                .to({ opacity: targetOpacity }, duration)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(() => {
                    material.opacity = tweenState.opacity;
                    material.needsUpdate = true;
                });
            
            state.dotTweenGroup.add(tween);
            tween.start();
            return;
        }

        // Existing desktop implementation
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
        // Clear any ongoing tweens first
        state.blobTweenGroup.removeAll();
        state.dotTweenGroup.removeAll();
        
        this.wavingBlob.visible = true;
        
        if (this.isMobile) {
            // Reinitialize mobile mesh with original configuration
            const instancedMesh = this.instancedMeshes[0];
            const material = this.materials[0];
            
            if (!instancedMesh || !material) return;
            
            // Force visibility and reset material
            instancedMesh.visible = true;
            material.opacity = 0;
            material.transparent = true;
            material.needsUpdate = true;
            
            if (instancedMesh.parent !== this.wavingBlob) {
                this.wavingBlob.add(instancedMesh);
            }
            
            // Reset scale to original configuration
            instancedMesh.scale.setScalar(1);
            this.wavingBlob.scale.setScalar(1);
            
            // Use original mobile configuration
            const scale = MOBILE_CONFIG.size;
            
            // Reset all instances using original count
            for (let i = 0; i < MOBILE_CONFIG.count; i++) {
                this.getRandomPositionWithinBounds();
                this.tempScale.set(scale, scale, scale);
                this.tempMatrix.compose(this.tempPosition, this.noRotation, this.tempScale);
                
                instancedMesh.setMatrixAt(i, this.tempMatrix);
                if (this.instanceMatrices[0][i]) {
                    this.instanceMatrices[0][i].copy(this.tempMatrix);
                }
            }
            
            instancedMesh.instanceMatrix.needsUpdate = true;
            console.log(`🔄 Reset ${MOBILE_CONFIG.count} mobile speckles`);
            return;
        }

        // Desktop implementation
        const countPerSize = Math.ceil(DESKTOP_CONFIG.count / DESKTOP_CONFIG.sizes.length);
        let totalSpeckles = 0;
        
        this.instancedMeshes.forEach((instancedMesh, meshIndex) => {
            // Force visibility and reset material
            instancedMesh.visible = true;
            const material = this.materials[meshIndex];
            material.opacity = 0;
            material.transparent = true;
            material.needsUpdate = true;
            
            // Ensure proper parent-child relationship
            if (instancedMesh.parent !== this.wavingBlob) {
                this.wavingBlob.add(instancedMesh);
            }
            
            // Reset scales to original configuration
            instancedMesh.scale.setScalar(1);
            this.wavingBlob.scale.setScalar(1);
            
            // Use original desktop configuration
            const size = DESKTOP_CONFIG.sizes[meshIndex];
            const scale = size;
            
            // Reset all instances using original count per size
            for (let i = 0; i < countPerSize; i++) {
                this.getRandomPositionWithinBounds();
                this.tempScale.set(scale, scale, scale);
                this.tempMatrix.compose(this.tempPosition, this.noRotation, this.tempScale);
                
                instancedMesh.setMatrixAt(i, this.tempMatrix);
                if (this.instanceMatrices[meshIndex][i]) {
                    this.instanceMatrices[meshIndex][i].copy(this.tempMatrix);
                }
                
                // Reset velocity for desktop
                if (this.velocities?.[meshIndex]?.[i]) {
                    this.tempVector.set(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize().multiplyScalar(DESKTOP_CONFIG.animation.baseVelocity);
                    this.velocities[meshIndex][i].copy(this.tempVector);
                }
            }
            
            totalSpeckles += countPerSize;
            instancedMesh.instanceMatrix.needsUpdate = true;
        });
        
        console.log(`🔄 Reset ${totalSpeckles} desktop speckles in ${this.instancedMeshes.length} groups (${countPerSize} per group)`);
    }

    updateColors(color) {
        // Reuse temp color object
        this.tempColor.set(color);
        this.materials.forEach(material => {
            material.color.copy(this.tempColor);
            material.needsUpdate = true;
        });
    }

    randomizePositions() {
        if (this.isMobile) {
            const instancedMesh = this.instancedMeshes[0];
            const matrices = this.instanceMatrices[0];
            
            if (!instancedMesh || !matrices) return;
            
            const noRotation = new THREE.Quaternion();
            const scale = MOBILE_CONFIG.size;
            const scaleVec = new THREE.Vector3(scale, scale, scale);
            
            for (let i = 0; i < matrices.length; i++) {
                this.getRandomPositionWithinBounds();
                this.tempMatrix.compose(this.tempPosition, noRotation, scaleVec);
                
                instancedMesh.setMatrixAt(i, this.tempMatrix);
                matrices[i].copy(this.tempMatrix);
            }
            
            instancedMesh.instanceMatrix.needsUpdate = true;
            return;
        }

        // Existing desktop implementation
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

        // Cancel any ongoing tweens
        state.blobTweenGroup.removeAll();
        state.dotTweenGroup.removeAll();

        // First dispose shared geometry
        if (this.sharedGeometry) {
            this.sharedGeometry.dispose();
            console.log('✅ Disposed shared geometry');
        }

        // Clear all temporary objects
        this.tempPosition.set(0, 0, 0);
        this.tempQuaternion.set(0, 0, 0, 1);
        this.tempScale.set(1, 1, 1);
        this.tempVector.set(0, 0, 0);
        this.tempMatrix.identity();
        this.tempColor.set(0xffffff);

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