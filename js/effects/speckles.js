import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from './anim.js';

/**
 * Configuration for the speckle system
 */
const SPECKLE_CONFIG = {
    count: 200,
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
        const scale = 0.65;
        return new THREE.Vector3(
            (Math.random() * 2 - 1) * (this.dotBounds * scale),
            (Math.random() * 2 - 1) * (this.dotBounds * scale),
            (Math.random() * 2 - 1) * (this.dotBounds * scale)
        );
    }

    createSpeckle(size, groupIndex) {
        const sphereGeometry = new THREE.SphereGeometry(size, 6, 6);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: SPECKLE_CONFIG.colors.default, 
            opacity: 0, 
            transparent: true, 
            depthWrite: false 
        });
        
        const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
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

        this.dotGroups.forEach(group => {
            if (group.visible) {
                group.children.forEach(sphere => {
                    sphere.position.add(sphere.velocity);
                    if (sphere.position.length() > this.dotBounds) {
                        sphere.velocity.negate();
                    }
                });
            }
        });
    }

    tweenOpacity(targetOpacity, duration) {
        const tweenState = { opacity: this.spheres[0].material.opacity };
        
        const opacityTween = new Tween(tweenState)
            .to({ opacity: targetOpacity }, duration)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                this.spheres.forEach(sphere => {
                    sphere.material.opacity = tweenState.opacity;
                    sphere.material.needsUpdate = true;
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
                group.children.forEach(sphere => {
                    sphere.material.opacity = Math.max(0, tweenState.opacity);
                    sphere.material.needsUpdate = true;
                });
            })
            .onComplete(() => {
                state.blobTweenGroup.remove(explosionTween);
                group.visible = false;
            });

        state.blobTweenGroup.add(explosionTween);
        explosionTween.start();
    }

    updateColors(color) {
        this.spheres.forEach(sphere => {
            sphere.material.color = new THREE.Color(color);
            sphere.material.needsUpdate = true;
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
        this.spheres.forEach(sphere => {
            sphere.geometry.dispose();
            sphere.material.dispose();
        });
        this.wavingBlob.geometry.dispose();
        this.wavingBlob.material.dispose();
    }
} 