import { Group, Tween, Easing } from 'tween';
import * as THREE from 'three';
import { state } from '../core/anim.js';
import { materialManager } from '../utils/materialManager.js';

// Define product colors as a single source of truth
export const PRODUCT_COLORS = {
    orange: '#bf541e',
    green: '#00a86b',
    yellow: '#ffd700'
};

// Product type text mapping
const PRODUCT_TYPES = {
    [PRODUCT_COLORS.orange]: 'deodorant',
    [PRODUCT_COLORS.yellow]: 'sunscreen',
    [PRODUCT_COLORS.green]: 'anti-attractant'
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

        // Disable scrolling with Lenis
        if (state && state.lenis) {
            state.lenis.stop();
        }

        // Disable pod buttons during animation
        ['podOrange', 'podGreen', 'podYellow'].forEach(podId => {
            const pod = document.getElementById(podId);
            if (pod) {
                pod.style.pointerEvents = 'none';
            }
        });

        // Fade out the labels immediately
        const showingLabel = document.getElementById('showingLabel');
        const productType = document.getElementById('productType');
        const productTypeSubtitle = document.getElementById('productTypeSubtitle');
        const waitlistLabel = document.getElementById('waitlistLabel');

        if (showingLabel) {
            showingLabel.style.opacity = '0';
        }
        if (productType) {
            productType.style.transition = 'opacity 0.3s ease-out';
            productType.style.opacity = '0';
        }
        if (productTypeSubtitle && window.innerWidth > 480) {
            productTypeSubtitle.style.transition = 'opacity 0.3s ease-out';
            productTypeSubtitle.style.opacity = '0';
        }
        if (waitlistLabel) {
            waitlistLabel.style.transition = 'opacity 0.3s ease-out';
            waitlistLabel.style.opacity = '0';
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
                }, 100);

                // Re-enable pod buttons after animation
                ['podOrange', 'podGreen', 'podYellow'].forEach(podId => {
                    const pod = document.getElementById(podId);
                    if (pod) {
                        pod.style.pointerEvents = 'auto';
                    }
                });

                // Re-enable scrolling with Lenis
                if (state && state.lenis) {
                    state.lenis.start();
                }

                this.isAnimating = false;

                // Update radio button selection based on pod color
                const radioMapping = {
                    [PRODUCT_COLORS.orange]: 'odorRadio',
                    [PRODUCT_COLORS.green]: 'mosquitoRadio',
                    [PRODUCT_COLORS.yellow]: 'uvRadio'
                };
                
                const radioId = radioMapping[this.targetColor];
                if (radioId) {
                    const radio = document.getElementById(radioId);
                    if (radio) {
                        radio.checked = true;
                    }
                }
            });

        rotateDownTween.start();
    }

    createRotationDownTween() {
        return new Tween(this.applicator.rotation, this.tweenGroup)
            .to({ y: -Math.PI * 0.26 }, 500)
            .easing(Easing.Cubic.InOut)
    }

    createMoveUpTween() {
        const targetY = this.initialY + 1;
        return new Tween(this.applicator.position, this.tweenGroup)
            .to({ y: targetY }, 500)
            .easing(Easing.Cubic.InOut)
    }

    // Helper method to batch update materials using the global manager
    batchUpdateMaterials(materials) {
        if (materials && materials.length > 0) {
            materialManager.queueMaterialUpdate(materials);
        }
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

                // Update product type text after fade out
                const productType = document.getElementById('productType');
                const productTypeSubtitle = document.getElementById('productTypeSubtitle');
                const showingLabel = document.getElementById('showingLabel');
                const waitlistLabel = document.getElementById('waitlistLabel');
                const productText = PRODUCT_TYPES[this.targetColor];

                setTimeout(() => {

                    // Update all text content while still invisible
                    if (productType && productText) {
                        productType.textContent = productText;
                    }

                    if (waitlistLabel && productText) {
                        // Create a temporary span to measure new text width for waitlistLabel
                        const tempSpanWaitlist = document.createElement('span');
                        tempSpanWaitlist.style.visibility = 'hidden';
                        tempSpanWaitlist.style.position = 'absolute';
                        tempSpanWaitlist.style.whiteSpace = 'nowrap';
                        tempSpanWaitlist.style.fontSize = window.getComputedStyle(waitlistLabel).fontSize;
                        tempSpanWaitlist.textContent = productText;
                        document.body.appendChild(tempSpanWaitlist);

                        const newWaitlistWidth = tempSpanWaitlist.offsetWidth;
                        document.body.removeChild(tempSpanWaitlist);

                        // Capture current width before any changes
                        const currentWaitlistWidth = waitlistLabel.offsetWidth;

                        // Set up initial styles
                        waitlistLabel.style.display = 'inline-block';
                        waitlistLabel.style.width = currentWaitlistWidth + 'px';
                        waitlistLabel.style.whiteSpace = 'nowrap';
                        waitlistLabel.style.overflow = 'hidden';
                        waitlistLabel.style.verticalAlign = 'top';

                        // Update the text content
                        waitlistLabel.textContent = productText;

                        // Start the width transition
                        requestAnimationFrame(() => {
                            waitlistLabel.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                            waitlistLabel.style.width = newWaitlistWidth + 'px';

                            waitlistLabel.addEventListener('transitionend', function widthChange(e) {
                                if (e.propertyName === 'width') {
                                    waitlistLabel.removeEventListener('transitionend', widthChange);

                                    // Reset styles after width animation
                                    waitlistLabel.style.display = 'inline';
                                    waitlistLabel.style.width = 'auto';
                                    waitlistLabel.style.verticalAlign = '';
                                }
                            });
                        });
                    }

                    // Existing code for updating #productTypeSubtitle
                    if (productTypeSubtitle && productText && window.innerWidth > 480) {
                        // Create a temporary span to measure new text width
                        const tempSpan = document.createElement('span');
                        tempSpan.style.visibility = 'hidden';
                        tempSpan.style.position = 'absolute';
                        tempSpan.style.whiteSpace = 'nowrap';
                        tempSpan.style.fontSize = window.getComputedStyle(productTypeSubtitle).fontSize;
                        tempSpan.textContent = productText;
                        document.body.appendChild(tempSpan);

                        const newWidth = tempSpan.offsetWidth;
                        document.body.removeChild(tempSpan);

                        // Capture current width before any changes
                        const currentWidth = productTypeSubtitle.offsetWidth;

                        // Set up initial styles
                        productTypeSubtitle.style.display = 'inline-block';
                        productTypeSubtitle.style.width = currentWidth + 'px';
                        productTypeSubtitle.style.whiteSpace = 'nowrap';
                        productTypeSubtitle.style.overflow = 'hidden';
                        productTypeSubtitle.style.verticalAlign = 'top';

                        // Update the text content
                        productTypeSubtitle.textContent = productText;

                        // Start the width transition
                        requestAnimationFrame(() => {
                            productTypeSubtitle.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                            productTypeSubtitle.style.width = newWidth + 'px';

                            productTypeSubtitle.addEventListener('transitionend', function widthChange(e) {
                                if (e.propertyName === 'width') {
                                    productTypeSubtitle.removeEventListener('transitionend', widthChange);

                                    // Reset styles after width animation
                                    productTypeSubtitle.style.display = 'inline';
                                    productTypeSubtitle.style.width = 'auto';
                                    productTypeSubtitle.style.verticalAlign = '';
                                }
                            });
                        });
                    }

                    setTimeout(() => {
                    // Fade in all elements
                    const elements = [productType, productTypeSubtitle, showingLabel, waitlistLabel];
                    elements.forEach(el => {
                        if (el) {
                            el.style.transition = 'opacity 0.3s ease-out';
                            el.style.opacity = '1';
                            }
                        });
                    }, 500);

                    // Update showing label text while still invisible
                    if (showingLabel) {
                        const labelText = {
                            [PRODUCT_COLORS.orange]: 'Body odor',
                            [PRODUCT_COLORS.yellow]: 'Sunscreen',
                            [PRODUCT_COLORS.green]: 'Mosquito'
                        }[this.targetColor];

                        if (labelText) {
                            showingLabel.textContent = labelText;
                        }
                    }
                }, 300); // Wait for fade out to complete

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
            })
            .onUpdate(() => {
                const color = new THREE.Color(currentColor.r, currentColor.g, currentColor.b);
                const materialsToUpdate = [];
                
                innerCapMeshes.forEach(mesh => {
                    if (mesh.material) {
                        mesh.material.color.copy(color);
                        mesh.material.emissive.copy(color);
                        materialsToUpdate.push(mesh.material);
                    }
                });
                
                // Batch update all materials at once
                this.batchUpdateMaterials(materialsToUpdate);
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