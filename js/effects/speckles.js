import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from '../core/anim.js';

const SPECKLE_CONFIG = {
    count: window.innerWidth < 768 ? 140 : 200,
    sizeMultiplier: window.innerWidth < 768 ? 1.2 : 1,
    sizes: window.innerWidth < 768 ? 
        [0.14, 0.18, 0.22] :  // Fewer size variations on mobile
        [0.12, 0.14, 0.16, 0.18, 0.22],
    colors: {
        default: 0xffbb65
    },
    groups: {
        count: window.innerWidth < 768 ? 3 : 5,
        velocityMultipliers: window.innerWidth < 768 ? 
            [0.8, 1.0, 1.2] :  // Mobile: 3 groups
            [0.8, 0.9, 1.0, 1.1, 1.2]  // Desktop: 5 groups
    },
    animation: {
        fadeInDuration: window.innerWidth < 768 ? 400 : 500,
        fadeOutDuration: window.innerWidth < 768 ? 150 : 180,
        baseVelocity: window.innerWidth < 768 ? 0.018 : 0.014
    }
};

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
                depthWrite: false,
                precision: window.innerWidth < 768 ? 'lowp' : 'mediump'  // Lower precision on mobile
            })
        );
        
        this.dotGroups = this.createDotGroups();
        this.initializeSpeckles();
    }

    createWavingBlob() {
        const wavingBlob = new THREE.Group();
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
        const scale = window.innerWidth < 768 ? 1 : 0.65;
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

        const isMobile = window.innerWidth < 768;
        
        if (isMobile && (Date.now() % 2 !== 0)) return;  // Update every 2nd frame on mobile

        // Update positions in batches for better performance
        this.dotGroups.forEach(group => {
            if (!group.visible) return;
            
            const children = group.children;
            const length = children.length;
            const dotBoundsSquared = this.dotBounds * this.dotBounds;
            
            // Larger batches on mobile for better performance
            const batchSize = isMobile ? 15 : 50;  // Even smaller batches on mobile
            
            for (let i = 0; i < length; i += batchSize) {
                const endIdx = Math.min(i + batchSize, length);
                for (let j = i; j < endIdx; j++) {
                    const sphere = children[j];
                    sphere.position.add(sphere.velocity);
                    
                    // Use squared distance for better performance
                    if (sphere.position.lengthSq() > dotBoundsSquared) {
                        sphere.velocity.negate();
                        // On mobile, slightly randomize the velocity when bouncing to avoid patterns
                        if (isMobile) {
                            sphere.velocity.x *= 0.95 + Math.random() * 0.1;
                            sphere.velocity.y *= 0.95 + Math.random() * 0.1;
                            sphere.velocity.z *= 0.95 + Math.random() * 0.1;
                        }
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

        const isMobile = window.innerWidth < 768;
        const tweenState = { scale: 1, opacity: 1 };
        const explosionTween = new Tween(tweenState)
            .to({ 
                scale: 1.4,  // Smaller scale on mobile
                opacity: 0 
            }, isMobile ? duration * 0.8 : duration)  // Faster duration on mobile MAYBE NOT
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                group.scale.setScalar(tweenState.scale);
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
        this.wavingBlob.children.forEach(child => child.geometry.dispose());
    }
} 