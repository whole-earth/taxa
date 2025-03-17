import * as THREE from 'three';
import { performanceMonitor } from './performance.js';

/**
 * MaterialUpdateManager - Centralized manager for batching material updates
 * This improves performance by collecting all material updates and applying them once per frame
 */
export class MaterialUpdateManager {
    constructor() {
        this.pendingMaterials = new Set();
        this.pendingInstanceMatrices = new Set();
        this.pendingAttributes = new Map();
        this.isUpdateScheduled = false;
        this.frameSkipCount = 0;
        this.frameSkipThreshold = 1; // Update every N frames
        
        // Set different thresholds for mobile devices
        if (window.innerWidth < 768) {
            this.frameSkipThreshold = 2; // More aggressive skipping on mobile
        }
    }

    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!MaterialUpdateManager.instance) {
            MaterialUpdateManager.instance = new MaterialUpdateManager();
        }
        return MaterialUpdateManager.instance;
    }

    /**
     * Queue materials for update
     * @param {THREE.Material|Array<THREE.Material>} materials - Material(s) to update
     */
    queueMaterialUpdate(materials) {
        if (!materials) return;
        
        if (Array.isArray(materials)) {
            materials.forEach(mat => {
                if (mat) this.pendingMaterials.add(mat);
            });
        } else if (materials) {
            this.pendingMaterials.add(materials);
        }
        
        this.scheduleUpdate();
    }

    /**
     * Queue instance matrix for update
     * @param {THREE.InstancedBufferAttribute} instanceMatrix - Instance matrix to update
     */
    queueInstanceMatrixUpdate(instanceMatrix) {
        if (instanceMatrix) {
            this.pendingInstanceMatrices.add(instanceMatrix);
            this.scheduleUpdate();
        }
    }

    /**
     * Queue buffer attribute for update
     * @param {THREE.BufferAttribute} attribute - Buffer attribute to update
     * @param {string} name - Identifier for the attribute
     */
    queueAttributeUpdate(attribute, name) {
        if (attribute) {
            this.pendingAttributes.set(name || attribute.uuid, attribute);
            this.scheduleUpdate();
        }
    }

    /**
     * Schedule an update to occur on the next animation frame
     */
    scheduleUpdate() {
        if (!this.isUpdateScheduled) {
            this.isUpdateScheduled = true;
            requestAnimationFrame(() => this.processUpdates());
        }
    }

    /**
     * Process all queued updates
     */
    processUpdates() {
        this.frameSkipCount++;
        
        // Only process updates every N frames for non-critical updates
        if (this.frameSkipCount >= this.frameSkipThreshold) {
            this.frameSkipCount = 0;
            
            // Update all materials
            if (this.pendingMaterials.size > 0) {
                performanceMonitor.recordMaterialUpdate(this.pendingMaterials.size);
                this.pendingMaterials.forEach(material => {
                    material.needsUpdate = true;
                });
                this.pendingMaterials.clear();
            }
            
            // Update all instance matrices
            if (this.pendingInstanceMatrices.size > 0) {
                performanceMonitor.recordInstanceMatrixUpdate(this.pendingInstanceMatrices.size);
                this.pendingInstanceMatrices.forEach(instanceMatrix => {
                    instanceMatrix.needsUpdate = true;
                });
                this.pendingInstanceMatrices.clear();
            }
            
            // Update all buffer attributes
            if (this.pendingAttributes.size > 0) {
                performanceMonitor.recordAttributeUpdate(this.pendingAttributes.size);
                this.pendingAttributes.forEach(attribute => {
                    attribute.needsUpdate = true;
                });
                this.pendingAttributes.clear();
            }
        }
        
        this.isUpdateScheduled = false;
    }

    /**
     * Set the frame skip threshold
     * @param {number} threshold - Number of frames to skip between updates
     */
    setFrameSkipThreshold(threshold) {
        this.frameSkipThreshold = Math.max(1, threshold);
    }
}

// Export singleton instance
export const materialManager = MaterialUpdateManager.getInstance(); 