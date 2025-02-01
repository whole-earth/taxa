import { Group, Tween, Easing } from 'tween';
import * as THREE from 'three';

// Define product colors as a single source of truth
export const PRODUCT_COLORS = {
    orange: '#bf541e',
    green: '#00a86b',
    yellow: '#ffd700'
};

// Keep track of current color
export let currentColorState = PRODUCT_COLORS.orange;

// Create a tween group for color animations
export const colorTweenGroup = new Group();

// Helper function to get color name from hex value
function getColorName(hexColor) {
    return Object.entries(PRODUCT_COLORS).find(([name, hex]) => hex === hexColor)?.[0];
}

// Animation sequence manager
export class ColorChangeAnimationSequence {
    constructor(applicator, product, targetColor) {
        this.applicator = applicator;
        this.product = product;
        this.targetColor = targetColor;
        this.initialY = 0;
        this.initialRotY = 0;
        this.tweenGroup = colorTweenGroup;
        // Total duration of all tweens
        this.totalDuration = 2700; // 500 + 500 + 700 + 500 + 500 ms
        this.isAnimating = false;  // Add flag to track animation state
    }

    start() {
        // Check if we're already at the target color or if animation is in progress
        if (currentColorState === this.targetColor || this.isAnimating) {
            return;
        }

        this.isAnimating = true;  // Set flag when animation starts

        // Fade out the label immediately
        const showingLabel = document.getElementById('showingLabel');
        if (showingLabel) {
            showingLabel.style.opacity = '0';
        }

        // Remove current class from all pods first
        const selectedPodId = `pod${getColorName(this.targetColor)?.charAt(0).toUpperCase()}${getColorName(this.targetColor)?.slice(1)}`;
        const allPodButtons = ['podOrange', 'podGreen', 'podYellow'];
        allPodButtons.forEach(podId => {
            const pod = document.getElementById(podId);
            if (pod) {
                pod.classList.remove('current');
                // Only remove progress-loading from pods that aren't the target
                if (podId !== selectedPodId) {
                    pod.classList.remove('progress-loading');
                }
            }
        });

        // Start the progress animation on the target pod if it's not already animating
        const selectedPod = document.getElementById(selectedPodId);
        if (selectedPod && !selectedPod.classList.contains('progress-loading')) {
            selectedPod.classList.add('progress-loading');
        }

        // Store initial state
        this.initialY = this.applicator.position.y;
        this.initialRotY = this.applicator.rotation.y;

        // Create all tweens first
        const rotateDownTween = this.createRotationDownTween();
        const moveUpTween = this.createMoveUpTween();
        const colorTween = this.createColorTween();
        const moveDownTween = this.createMoveDownTween();
        const rotateUpTween = this.createRotationUpTween();

        // Chain them together with explicit onComplete handlers
        rotateDownTween
            .onComplete(() => {
                moveUpTween.start();
            });

        moveUpTween
            .onComplete(() => {
                colorTween.start();
            });

        colorTween
            .onComplete(() => {
                moveDownTween.start();
            });

        moveDownTween
            .onComplete(() => {
                rotateUpTween.start();
            });

        rotateUpTween
            .onComplete(() => {
                this.tweenGroup.removeAll();
                selectedPod.classList.remove('progress-loading');
                setTimeout(() => {
                    if (selectedPod) {
                        selectedPod.classList.add('current');
                    }
                }, 200);
                this.isAnimating = false;
            });

        rotateDownTween.start();
    }

    createRotationDownTween() {
        return new Tween(this.applicator.rotation, this.tweenGroup)
            .to({ y: -Math.PI * 0.4 }, 500)
            .easing(Easing.Cubic.InOut)
    }

    createMoveUpTween() {
        const targetY = this.initialY + 1;
        return new Tween(this.applicator.position, this.tweenGroup)
            .to({ y: targetY }, 500)
            .easing(Easing.Cubic.InOut)
    }

    createColorTween() {
        const innerCapObject = this.product.getObjectByName('inner-cap');
        if (!innerCapObject) {
            return new Tween({}, this.tweenGroup).to({}, 1);
        }

        const innerCapMeshes = [];
        innerCapObject.traverse(child => {
            if (child.isMesh) {
                innerCapMeshes.push(child);
            }
        });

        // Get the current color from the actual material of the first mesh
        const firstMesh = innerCapMeshes[0];
        const startColor = firstMesh?.material?.color || new THREE.Color(currentColorState);
        
        // Create our tween object with the current RGB values
        const currentColor = { r: startColor.r, g: startColor.g, b: startColor.b };
        
        // Convert target hex color to RGB
        const targetThreeColor = new THREE.Color(this.targetColor);
        const targetColor = { r: targetThreeColor.r, g: targetThreeColor.g, b: targetThreeColor.b };

        // Update currentColorState immediately when we start the color change
        currentColorState = this.targetColor;

        return new Tween(currentColor, this.tweenGroup)
            .to(targetColor, 700)
            .easing(Easing.Cubic.InOut)
            .onStart(() => {
                // Remove all color classes first
                const productCard = document.querySelector('.product-card-section.module');
                if (productCard) {
                    ['orange', 'green', 'yellow'].forEach(color => {
                        productCard.classList.remove(color);
                    });
                    // Add the new color class
                    const newColorName = getColorName(this.targetColor);
                    if (newColorName) {
                        productCard.classList.add(newColorName);
                    }
                }

                // Remove 'current' class from all pods
                const allPodButtons = ['podOrange', 'podGreen', 'podYellow'];
                allPodButtons.forEach(podId => {
                    const pod = document.getElementById(podId);
                    if (pod) {
                        pod.classList.remove('current');
                    }
                });

                // Update and fade in the showing label text
                const showingLabel = document.getElementById('showingLabel');
                if (showingLabel) {
                    const labelText = {
                        [PRODUCT_COLORS.orange]: 'Body odor',
                        [PRODUCT_COLORS.yellow]: 'Mosquito',
                        [PRODUCT_COLORS.green]: 'Eczema'
                    }[this.targetColor];
                    
                    if (labelText) {
                        showingLabel.textContent = labelText;
                        requestAnimationFrame(() => {
                            showingLabel.style.opacity = '1';
                        });
                    }
                }
            })
            .onUpdate(() => {
                const color = new THREE.Color(currentColor.r, currentColor.g, currentColor.b);
                innerCapMeshes.forEach(mesh => {
                    if (mesh.material) {
                        mesh.material.color.copy(color);
                        mesh.material.emissive.copy(color);
                        mesh.material.needsUpdate = true;
                    }
                });
            });
    }

    createMoveDownTween() {
        return new Tween(this.applicator.position, this.tweenGroup)
            .to({ y: this.initialY }, 500)
            .easing(Easing.Cubic.InOut)
    }

    createRotationUpTween() {
        return new Tween(this.applicator.rotation, this.tweenGroup)
            .to({ y: this.initialRotY }, 500)
            .easing(Easing.Cubic.InOut)
    }
} 