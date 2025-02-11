import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from '../core/anim.js';

/**
 * Configuration for the speckle system
 */
const SPECKLE_CONFIG = {
    count: window.innerWidth < 768 ? 140 : 200,
    sizeMultiplier: window.innerWidth < 768 ? 1.4 : 1,
    sizes: [0.12, 0.14, 0.16, 0.18, 0.22],
    colors: {
        default: 0xff8e00
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

/**
 * Manages the speckle/dot animation system
 */
export class SpeckleSystem {
    constructor(scene, dotBounds) {
        this.scene = scene;
        this.dotBounds = dotBounds;
        this.spheres = [];
        this.wavingBlob = this.createWavingBlob();
        
        // Create shared geometries for instancing
        this.sharedGeometries = SPECKLE_CONFIG.sizes.map(size => 
            new THREE.SphereGeometry(size * SPECKLE_CONFIG.sizeMultiplier, 6, 6)
        );
        
        // Create one material per group
        this.groupMaterials = Array(SPECKLE_CONFIG.groups.count).fill(null).map(() => 
            new THREE.MeshBasicMaterial({ 
                color: SPECKLE_CONFIG.colors.default, 
                opacity: 0, 
                transparent: true, 
                depthWrite: false 
            })
        );
        
        this.dotGroups = this.createDotGroups();
        this.initializeSpeckles();
    }

    createWavingBlob() {
        const waveGeom = new THREE.SphereGeometry(this.dotBounds, 32, 32);
        const waveMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x92cb86, 
            opacity: 0, 
            transparent: true, 
            depthWrite: false, 
            depthTest: false 
        });
        const wavingBlob = new THREE.Mesh(waveGeom, waveMaterial);
        wavingBlob.renderOrder = 5;
        this.scene.add(wavingBlob);
        return wavingBlob;
    }

    createDotGroups() {
        const groups = [];
        for (let i = 0; i < SPECKLE_CONFIG.groups.count; i++) {
            const group = new THREE.Group();
            this.wavingBlob.add(group);
            groups.push(group);
        }
        return groups;
    }

    getRandomPositionWithinBounds() {
        const scale = window.innerWidth < 768 ? 0.8 : 0.65;
        return new THREE.Vector3(
            (Math.random() * 2 - 1) * (this.dotBounds * scale),
            (Math.random() * 2 - 1) * (this.dotBounds * scale),
            (Math.random() * 2 - 1) * (this.dotBounds * scale)
        );
    }

    createSpeckle(size, groupIndex) {
        const sizeIndex = SPECKLE_CONFIG.sizes.indexOf(size);
        const geometry = this.sharedGeometries[sizeIndex];
        
        // Use the group's shared material
        const sphereMesh = new THREE.Mesh(geometry, this.groupMaterials[groupIndex]);
        sphereMesh.position.copy(this.getRandomPositionWithinBounds());
        
        const randomDirection = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();
        
        sphereMesh.velocity = randomDirection.multiplyScalar(
            SPECKLE_CONFIG.animation.baseVelocity * 
            SPECKLE_CONFIG.groups.velocityMultipliers[groupIndex]
        );
        
        return sphereMesh;
    }

    initializeSpeckles() {
        for (let i = 0; i < SPECKLE_CONFIG.count; i++) {
            const sizeIndex = i % SPECKLE_CONFIG.sizes.length;
            const groupIndex = i % SPECKLE_CONFIG.groups.count;
            
            const sphereMesh = this.createSpeckle(
                SPECKLE_CONFIG.sizes[sizeIndex],
                groupIndex
            );
            
            this.spheres.push(sphereMesh);
            this.dotGroups[groupIndex].add(sphereMesh);
        }
    }

    updatePositions() {
        if (!this.wavingBlob.visible) return;

        // Skip position updates on mobile
        if (window.innerWidth < 768) return;

        // Update positions in batches for better performance
        this.dotGroups.forEach(group => {
            if (!group.visible) return;
            
            const children = group.children;
            const length = children.length;
            const dotBoundsSquared = this.dotBounds * this.dotBounds;
            
            // Process in batches of 50 for better performance
            for (let i = 0; i < length; i += 50) {
                const endIdx = Math.min(i + 50, length);
                for (let j = i; j < endIdx; j++) {
                    const sphere = children[j];
                    sphere.position.add(sphere.velocity);
                    
                    // Use squared distance for better performance
                    if (sphere.position.lengthSq() > dotBoundsSquared) {
                        sphere.velocity.negate();
                    }
                }
            }
        });
    }

    tweenOpacity(targetOpacity, duration) {
        // Skip if already at target opacity
        if (this.groupMaterials[0].opacity === targetOpacity) return;
        
        const tweenState = { opacity: this.groupMaterials[0].opacity };
        
        const opacityTween = new Tween(tweenState)
            .to({ opacity: targetOpacity }, duration)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                this.groupMaterials.forEach(material => {
                    material.opacity = tweenState.opacity;
                    material.needsUpdate = true;
                });
            })
            .onComplete(() => {
                state.dotTweenGroup.remove(opacityTween);
            });

        state.dotTweenGroup.add(opacityTween);
        opacityTween.start();
    }

    tweenExplosion(duration, groupIndex) {
        const group = this.dotGroups[groupIndex];
        if (!group) return;

        const tweenState = { scale: 1, opacity: 1 };
        const explosionTween = new Tween(tweenState)
            .to({ scale: 3, opacity: 0 }, duration)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                group.scale.setScalar(tweenState.scale);
                // Update only this group's material opacity
                this.groupMaterials[groupIndex].opacity = Math.max(0, tweenState.opacity);
                this.groupMaterials[groupIndex].needsUpdate = true;
            })
            .onComplete(() => {
                state.blobTweenGroup.remove(explosionTween);
                group.visible = false;
            });

        state.blobTweenGroup.add(explosionTween);
        explosionTween.start();
    }

    updateColors(color) {
        // Update each group's material color
        this.groupMaterials.forEach(material => {
            material.color = new THREE.Color(color);
            material.needsUpdate = true;
        });
    }

    randomizePositions() {
        this.spheres.forEach(sphere => {
            sphere.position.copy(this.getRandomPositionWithinBounds());
            const randomDirection = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize();
            sphere.velocity = randomDirection.multiplyScalar(SPECKLE_CONFIG.animation.baseVelocity);
        });
    }

    dispose() {
        // Dispose shared geometries
        this.sharedGeometries.forEach(geometry => geometry.dispose());
        
        // Dispose group materials
        this.groupMaterials.forEach(material => material.dispose());
        
        this.spheres.length = 0; // Clear array
        this.wavingBlob.geometry.dispose();
        this.wavingBlob.material.dispose();
    }
} 