import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from './anim.js';

const splashStartFOV = window.innerWidth < 768 ? 90 : 60;
const splashEndFOV = splashStartFOV * 0.55;
const zoomStartFOV = splashEndFOV;
const zoomEndFOV = splashEndFOV * 1.1;
const zoomOutStartFOV = zoomEndFOV;
const zoomOutEndFOV = splashStartFOV;
const pitchStartFOV = zoomOutEndFOV;
const pitchEndFOV = pitchStartFOV * 1.5;

const green = new THREE.Color('#92cb86');
const orange = new THREE.Color('#ff8e00');
const yellow = new THREE.Color('#f1ff00');
const scrollDots = document.querySelectorAll('.scroll-dot');

const fadeInDuration = 500;
const fadeOutDuration = 180;

// Pre-calculate explosion thresholds
const EXPLOSION_PHASES = [
    { threshold: 0.20, index: 0 },
    { threshold: 0.30, index: 1 },
    { threshold: 0.45, index: 2 },
    { threshold: 0.70, index: 3 },
    { threshold: 0.85, index: 4 }
];

let explodedGroups = new Set();
let dotGroupsCache = null;

// Add these at the top with other state variables
let originalInnerColors = new WeakMap();
let originalOuterColor = null;

// ============================

function scrollLogic(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {

    splashBool = isVisibleBetweenTopAndBottom(splashArea);
    zoomBool = isVisibleBetweenTopAndBottom(zoomArea);
    zoomOutBool = isVisibleBetweenTopAndBottom(zoomOutArea);
    pitchBool = isVisibleBetweenTopAndBottom(pitchArea);
    productBool = isVisibleBetweenTopAndBottom(productArea);
    updateScrollIndicator();

    if (splashBool) {
        splashProgress = scrollProgress(splashArea);
        camera.fov = smoothLerp(splashStartFOV, splashEndFOV, splashProgress);

        if (!splashCurrent) {
            activateText(splashArea);

            if (comingFrom == 'zoomAreaFirst' || comingFrom == 'zoomOutArea') {
                dotTweenOpacity(spheres, 1, 0, wavingBlob, fadeOutDuration);
                ribbonTweenOpacity(ribbons, 0, 1);
                cellSheenTween(blobInner);
            }

            if (isBlobMobilized) {
                blobTweenMobilized(blobInner, blobOuter, false);
            }

            // Ensure cell object is visible and product is hidden
            cellObject.visible = true;
            if (product) {
                product.visible = false;
                product.traverse(child => {
                    if (child.material) child.visible = false;
                });
            }
            if (state.starField) state.starField.visible = false;

            comingFrom = 'splash';
            splashCurrent = true;
            zoomCurrent = false;
            zoomFirstCurrent = false;
        }
    }

    else if (zoomBool) {
        if (!zoomCurrent) {
            activateText(zoomArea);
            splashCurrent = false;
            zoomCurrent = true;
            zoomOutCurrent = false;
            if (wavingBlob) {
                restoreDotScale(wavingBlob);
            }

            if (isBlobMobilized) {
                blobTweenMobilized(blobInner, blobOuter, false);
            }

            // Ensure cell object is visible and product is hidden
            cellObject.visible = true;
            if (product) {
                product.visible = false;
                product.traverse(child => {
                    if (child.material) child.visible = false;
                });
            }
            if (state.starField) state.starField.visible = false;
        }

        zoomProgress = scrollProgress(zoomArea);
        camera.fov = smoothLerp(zoomStartFOV, zoomEndFOV, zoomProgress);

        if (zoomFirst && zoomSecond && zoomThird) {
            if (zoomProgress >= 0 && zoomProgress < 1 / 3) {
                if (!zoomFirstCurrent) {
                    activateText__ZoomChild(zoomFirst);
                    cellSheenTween(blobInner, orange);
                    if (comingFrom == 'splash') {
                        ribbonTweenOpacity(ribbons, 1, 0);
                        dotTweenOpacity(spheres, 0, 1, wavingBlob, fadeInDuration);
                    } else if (comingFrom == 'zoomAreaSecond') {
                        dotTweenOpacity(spheres, 1, 0, wavingBlob, fadeOutDuration);
                        setTimeout(() => {
                            if (zoomFirstCurrent) {
                                dotUpdateColors(spheres, orange);
                                dotRandomizePositions(spheres, dotBounds);
                                dotTweenOpacity(spheres, 0, 1, wavingBlob, fadeInDuration);
                            }
                        }, fadeOutDuration);
                    }
                    comingFrom = 'zoomAreaFirst';
                    zoomFirstCurrent = true;
                    zoomSecondCurrent = false;
                }
            }
            else if (zoomProgress >= 1 / 3 && zoomProgress < 2 / 3) {
                if (!zoomSecondCurrent) {
                    activateText__ZoomChild(zoomSecond);
                    dotTweenOpacity(spheres, 1, 0, wavingBlob, fadeOutDuration);
                    setTimeout(() => {
                        if (zoomSecondCurrent) {
                            dotUpdateColors(spheres, yellow);
                            dotRandomizePositions(spheres, dotBounds);
                            dotTweenOpacity(spheres, 0, 1, wavingBlob, fadeInDuration);
                            cellSheenTween(blobInner, yellow);
                        }
                    }, fadeOutDuration);
                }

                zoomFirstCurrent = false;
                zoomSecondCurrent = true;
                zoomThirdCurrent = false;
                comingFrom = 'zoomAreaSecond';
            }
            else if (zoomProgress >= 2 / 3 && zoomProgress <= 1) {
                if (!zoomThirdCurrent) {
                    activateText__ZoomChild(zoomThird);
                    if (comingFrom == 'zoomAreaSecond') {
                        dotTweenOpacity(spheres, 1, 0, wavingBlob, fadeOutDuration);
                        setTimeout(() => {
                            if (zoomThirdCurrent) {
                                dotUpdateColors(spheres, green);
                                dotRandomizePositions(spheres, dotBounds);
                                dotTweenOpacity(spheres, 0, 1, wavingBlob, fadeInDuration);
                                cellSheenTween(blobInner, green);
                            }
                        }, fadeOutDuration);
                    } else {
                        wavingBlob.children.forEach(group => {
                            if (group.isGroup) {
                                group.visible = true;
                            }
                        });
                        dotTweenOpacity(spheres, 0, 1, wavingBlob, fadeInDuration);
                        cellSheenTween(blobInner, green);
                    }
                    zoomSecondCurrent = false;
                    zoomThirdCurrent = true;
                    comingFrom = 'zoomAreaThird';
                }
            }
        }
    }
    else if (zoomOutBool) {
        zoomOutProgress = scrollProgress(zoomOutArea);
        camera.fov = smoothLerp(zoomOutStartFOV, zoomOutEndFOV, zoomOutProgress);

        if (!zoomOutCurrent) {

            textChildren.forEach(child => {
                if (child.classList.contains('active')) {
                    child.classList.remove('active');
                }
            });

            zoomCurrent = false;
            zoomThirdCurrent = false;
            zoomOutCurrent = true;
            pitchCurrent = false;

            // Only setup explosions if coming from zoom area
            if (comingFrom !== 'pitchArea') {
                explodedGroups.clear();

                // Reset visibility and scale of all groups
                if (dotGroupsCache) {
                    dotGroupsCache.forEach(group => {
                        group.visible = true;
                        group.scale.setScalar(1);
                        group.children.forEach(sphere => {
                            sphere.material.opacity = 1;
                            sphere.material.needsUpdate = true;
                        });
                    });
                }
            }

            comingFrom = 'zoomOutArea';
        }

        // Only check for explosions if we're coming from zoom and not pitch
        if (comingFrom === 'zoomOutArea' && !pitchCurrent) {

            const currentPhase = EXPLOSION_PHASES.find(phase =>
                zoomOutProgress >= phase.threshold && !explodedGroups.has(phase.index)
            );

            if (currentPhase) {
                dotsTweenExplosion(wavingBlob, 600, currentPhase.index);
            }
        }
    }
    else if (pitchBool) {
        if (!pitchCurrent) {
            activateText(pitchArea);

            if (state.sceneManager?.spotLight) {
                const { spotLight } = state.sceneManager;
                spotLight.visible = false;
                spotLight.intensity = 0;
            }

            if (comingFrom == 'productArea') {
                controls.autoRotate = true;
                controls.enableRotate = true;
                controls.autoRotateSpeed = 0.2;

                if (isBlobMobilized) {
                    blobTweenMobilized(blobInner, blobOuter, false);
                }

                if (product) {
                    product.traverse(child => {
                        if (child.material) {
                            child.visible = false;
                        }
                    });
                }

                if (state.starField) {
                    state.starField.visible = false;
                }

                if (wavingBlob) {
                    restoreDotScale(wavingBlob);
                }

                comingFrom = 'pitchArea';
            } else if (comingFrom == 'zoomOutArea') {

                if (!isBlobMobilized) {
                    blobTweenMobilized(blobInner, blobOuter, true);
                }

                if (spheres && spheres.length > 0 && spheres[0] && spheres[0].material && spheres[0].material.opacity > 0) {
                    // only trigger explosion if dots are visible
                    dotsTweenExplosion(wavingBlob, 600, 80);
                }
            }

            zoomOutCurrent = false;
            pitchCurrent = true;
            productCurrent = false;
            comingFrom = 'pitchArea';
        }

        pitchProgress = scrollProgress(pitchArea);
        camera.fov = smoothLerp(pitchStartFOV, pitchEndFOV, pitchProgress);
    }
    else if (productBool) {

        if (!productCurrent) {
            resetProductVisibility(product, state.applicatorObject);

            // Disable auto-rotation and manual rotation when entering product area
            controls.autoRotate = false;
            controls.enableRotate = false;

            if (!isBlobMobilized) {
                blobTweenMobilized(blobInner, blobOuter, true);
            }

            // Reset product rotation and position
            if (product) {
                product.rotation.x = Math.PI / 2;
                product.rotation.z = 0;
                const productScale = isMobile ? 16 : 20;
                product.scale.set(productScale, productScale, productScale);
            }

            if (state.applicatorObject) {
                state.applicatorObject.position.y = 1;
                state.applicatorObject.rotation.y = 0;
            }

            // Hide cell object and dots for better performance
            cellObject.visible = false;
            if (wavingBlob && wavingBlob.children) {
                wavingBlob.children.forEach(group => {
                    if (group && group.isGroup) {
                        group.visible = false;
                    }
                });
                state.blobTweenGroup.removeAll();
                state.dotTweenGroup.removeAll();
                restoreDotScale(wavingBlob);
            }

            if (state.starField) {
                state.starField.visible = true;
                state.starField.updateProgress(0); // Reset starfield progress
            }

            pitchCurrent = false;
            productCurrent = true;
            productTextActivated = false;
            productPhase1Active = false;
            productPhase1aActive = false;
            productPhase2Active = false;
            productPhase3Active = false;
            lightingTransitionComplete = false;
            comingFrom = 'productArea';
        }

        if (product && product.children) {
            productProgress = scrollProgress__LastElem(productArea);
            const isInPhase1 = productProgress <= 0.5;

            // ===== PHASE 1: Initial Transition (0 to 0.5) =====
            if (isInPhase1) {
                
                if (!productPhase1Active) {
                    // Fix state updates
                    productPhase2Active = false;
                    productPhase3Active = false;
                    productPhase1aActive = false;
                    productPhase1Active = true;
                    lightingTransitionComplete = false;

                    // Batch visibility updates
                    cellObject.visible = true;
                    if (state.sceneManager?.spotLight) {
                        state.sceneManager.spotLight.visible = false;
                        state.sceneManager.spotLight.intensity = 0;
                    }

                    // Only update product if coming from phase 2
                    if (productPhase2Active) {
                        const productScale = isMobile ? 16 : 20;
                        product.rotation.set(Math.PI / 2, 0, 0);
                        product.position.set(0, 0, 0);
                        product.scale.setScalar(productScale);
                    }

                    // Restore blob color when scrolling back up
                    if (!isBlobMobilized) {
                        blobTweenMobilized(blobInner, blobOuter, true);
                    }

                    // go thru product and set all materials to transparent
                    product.traverse(child => {
                        if (child.material) {
                            child.material.transparent = true;
                            child.material.depthWrite = true;
                            child.material.depthTest = true;
                        }
                    });


                }

                // Cache computed values
                const normalizedProgress = Math.min(productProgress / 0.5, 1);
                
                // Update starfield if visible
                if (state.starField?.visible) {
                    state.starField.updateProgress(productProgress * 2, true);
                }

                // Batch scale updates
                const cellScale = smoothLerp(1, 0.06, normalizedProgress);
                cellObject.scale.setScalar(cellScale);

                const isInPhase1a = productProgress > 0.25;
                if (isInPhase1a && !productPhase1aActive) {
                    // Batch DOM operations
                    const activeChildren = document.querySelectorAll('.child.active');
                    if (activeChildren.length) {
                        activeChildren.forEach(child => child.classList.remove('active'));
                    }

                    // Make product and applicator visible
                    if (state.applicatorObject) {
                        state.applicatorObject.traverse(child => {
                            child.visible = true;
                            if (child.material) {
                                const materials = Array.isArray(child.material) ? child.material : [child.material];
                                materials.forEach(mat => {
                                    mat.visible = true;
                                    mat.transparent = true;
                                    mat.opacity = 0;
                                    mat.needsUpdate = true;
                                });
                            }
                        });
                    }

                    productPhase1aActive = true;
                    lightingTransitionComplete = false;
                }

                // Progressive fade-in during Phase 1a
                if (isInPhase1a) {
                    const fadeProgress = (productProgress - 0.25) / 0.25;

                    // Progressive fade for product elements
                    if (product) {
                        // Handle peel and inner-cap fade-in
                        const targetNames = new Set(['peel', 'inner-cap']);
                        product.traverse(child => {
                            const isTargetElement = targetNames.has(child.name) || 
                                                  (child.parent && targetNames.has(child.parent.name));
                            
                            if (isTargetElement) {
                                child.visible = true;
                                if (child.material) {
                                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                                    const opacity = fadeProgress > 0.5 ? smoothLerp(0, 1, (fadeProgress - 0.5) * 2) : 0;
                                    
                                    materials.forEach(mat => {
                                        mat.transparent = true;
                                        mat.opacity = opacity;
                                        mat.needsUpdate = true;
                                    });
                                }
                            }
                        });

                        // Progressive fade for applicator
                        if (state.applicatorObject) {
                            state.applicatorObject.traverse(child => {
                                child.visible = true;
                                if (child.material) {
                                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                                    materials.forEach(mat => {
                                        mat.transparent = true;
                                        mat.opacity = smoothLerp(0, 1, fadeProgress);
                                        mat.needsUpdate = true;
                                    });
                                }
                            });
                        }
                    }

                    // Update renderer and product scale
                    renderer.toneMappingExposure = smoothLerp(1, 0.35, fadeProgress);
                    
                    const productScale = isMobile
                        ? smoothLerp(16, 6, fadeProgress)  // Mobile
                        : smoothLerp(20, 5, fadeProgress); // Desktop
                    product.scale.setScalar(productScale);

                    if (fadeProgress >= 1) {
                        lightingTransitionComplete = true;
                    }
                }
            }
            // ===== PHASE 2: Product Rotation (0.5 to 0.8) =====
            else if (0.5 <= productProgress && productProgress <= 0.8) {
                // Hide cell object and starfield after transition
                if (!productPhase2Active) {
                    cellObject.visible = false;
                    if (state.starField) state.starField.visible = false;

                    const scrollIndicator = document.querySelector('.scroll-indicator');
                    if (scrollIndicator?.classList.contains('hidden')) {
                        scrollIndicator.classList.remove('hidden');
                    }

                    // Batch product material updates
                    product.traverse(child => {
                        if (child.name === 'overflowMask') {
                            child.visible = false;
                        } else {
                            child.visible = true;
                            if (child.material) {
                                const materials = Array.isArray(child.material) ? child.material : [child.material];
                                materials.forEach(mat => {
                                    mat.transparent = child.name === 'film-cover' || child.name === 'taxa-name';
                                    mat.depthWrite = true;
                                    mat.depthTest = true;
                                    mat.opacity = 1;
                                    mat.needsUpdate = true;
                                });
                            }
                        }
                    });

                    // Initialize spotlight
                    if (state.sceneManager?.spotLight) {
                        state.sceneManager.spotLight.visible = true;
                    }

                    productPhase2Active = true;
                    productPhase1Active = false;
                    productPhase3Active = false;
                }

                const rotationProgress = (productProgress - 0.5) / 0.3;

                // Handle product movement
                if (isMobile) {
                    // MOBILE: Combined rotation and position update
                    if (productProgress >= 0.5) {
                        product.rotation.set(
                            smoothLerp(Math.PI / 2, Math.PI / 5.5, rotationProgress),
                            smoothLerp(0, Math.PI / 5, rotationProgress),
                            smoothLerp(0, -Math.PI / 5, rotationProgress)
                        );
                        product.position.set(
                            smoothLerp(0, -5, rotationProgress),
                            smoothLerp(0, 16, rotationProgress),
                            0
                        );
                        product.scale.setScalar(smoothLerp(6, 7, rotationProgress));
                    }
                } else {
                    // DESKTOP: Two-phase rotation
                    product.rotation.x = smoothLerp(Math.PI / 2, Math.PI / 12, rotationProgress);

                    if (rotationProgress > 0.5) {
                        const zRotationProgress = (rotationProgress - 0.5) / 0.5;
                        product.rotation.z = smoothLerp(0, -Math.PI / 8, zRotationProgress);
                        product.rotation.y = smoothLerp(0, Math.PI / 5, zRotationProgress);
                        
                        product.position.set(
                            smoothLerp(0, -40, zRotationProgress),
                            smoothLerp(0, -24, zRotationProgress),
                            0
                        );
                        product.scale.setScalar(smoothLerp(5, 8, zRotationProgress));
                    }
                }

                // Optimize spotlight intensity animation
                if (state.sceneManager?.spotLight) {
                    const lightProgress = isMobile
                        ? (productProgress >= 0.65 ? (productProgress - 0.65) / 0.15 : 0)
                        : (rotationProgress > 0.5 ? (rotationProgress - 0.5) / 0.5 : 0);

                    state.sceneManager.spotLight.intensity = smoothLerp(0, 20, lightProgress);
                    ambientLight.intensity = smoothLerp(4.6, 2.2, lightProgress);
                }
            }

            // ===== PHASE 3: Applicator Animation (0.8 to 1.0) =====
            else if (productProgress >= 0.8) {
                if (!productPhase3Active) {
                    if (productPhase2Active) {
                        productPhase2Active = false;
                        productPhase1aActive = false;

                        const scrollIndicator = document.querySelector('.scroll-indicator');
                        if (scrollIndicator && !scrollIndicator.classList.contains('hidden')) {
                            scrollIndicator.classList.add('hidden');
                        }
                    }
                    productPhase3Active = true;
                    productTextActivated = false;
                }

                // Keep spotlight at full intensity during applicator animation
                if (state.sceneManager?.spotLight) {
                    state.sceneManager.spotLight.intensity = 20;
                }

                if (state.applicatorObject) {
                    // Cache progress calculations
                    const isInPositionPhase = productProgress <= 0.95;
                    const isInRotationPhase = productProgress > 0.95;

                    if (isInPositionPhase) {
                        // 3a. Applicator Position (0.8 to 0.95)
                        const positionProgress = (productProgress - 0.8) / 0.15;
                        state.applicatorObject.position.y = smoothLerp(1, 0, positionProgress);
                    } else {
                        // 3b. Applicator Rotation (0.95 to 1.0)
                        if (!productTextActivated) {
                            activateText(productArea);
                            productTextActivated = true;
                        }
                        const rotationProgress = (productProgress - 0.95) / 0.05;
                        const maxRotation = isMobile ? Math.PI * 0.3 : Math.PI * 0.4;
                        state.applicatorObject.rotation.y = smoothLerp(0, maxRotation, rotationProgress);
                    }

                    // Ensure applicator is visible
                    state.applicatorObject.traverse(child => {
                        child.visible = true;
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                mat.visible = true;
                                mat.opacity = 1;
                                mat.needsUpdate = true;
                            });
                        }
                    });
                }

                // Handle text activation when progress is past 0.95
                if (productProgress > 0.95 && !productTextActivated) {
                    activateText(productArea, false);
                    productTextActivated = true;
                }
            }

        }
    }
}

// =====================================================================================

const splashArea = document.querySelector('.splash');
const zoomArea = document.querySelector('.zoom');
const zoomOutArea = document.querySelector('.zoom-out');
const pitchArea = document.querySelector('.pitch');
const productArea = document.querySelector('.product');

const textChildren = document.querySelectorAll('.child');
const zoomFirst = document.querySelector('#zoomFirst');
const zoomSecond = document.querySelector('#zoomSecond');
const zoomThird = document.querySelector('#zoomThird');
const zoomElements = [zoomFirst, zoomSecond, zoomThird];

let splashBool, zoomBool, zoomOutBool, pitchBool, productBool;
let splashProgress, zoomProgress, zoomOutProgress, pitchProgress, productProgress;

let comingFrom = "splash";
let activeTextTimeout;

let splashCurrent = false;
let zoomCurrent = false;
let zoomOutCurrent = false;
let pitchCurrent = false;
let productCurrent = false;

let zoomFirstCurrent = false;
let zoomSecondCurrent = false;
let zoomThirdCurrent = false;

let productPhase1Active = false;
let productPhase1aActive = false;
let productPhase2Active = false;
let productPhase3Active = false;
let lightingTransitionComplete = false;
let isBlobMobilized = false;

let productTextActivated = false;

let isClickScroll = false;
let scrollTimeout;

export function animatePage(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {
    // Get current scroll position and calculate difference from last frame
    let scrollY = window.scrollY;
    let scrollDiff = scrollY - state.lastScrollY;

    // Mobile-optimized scroll speed calculation with reduced sensitivity
    if (isMobile) {
        const speedFactor = Math.min(Math.abs(scrollDiff) / 30, 2); // Reduced from 20 to 30, max from 3 to 2
        const direction = Math.sign(scrollDiff);
        controls.autoRotateSpeed = direction * (0.3 + (speedFactor * 3)); // Reduced from 0.5 to 0.3 and 5 to 3
        
        clearTimeout(state.scrollTimeout);
        state.scrollTimeout = setTimeout(() => {
            controls.autoRotateSpeed = 0.1;
        }, 300); // Increased from 200 to 300ms for smoother deceleration
    } else {
        const acceleration = Math.min(Math.pow(Math.abs(scrollDiff) / 15, 2), 4);
        const direction = Math.sign(scrollDiff);
        controls.autoRotateSpeed = direction * (1.0 + (acceleration * 6));

        clearTimeout(state.scrollTimeout);
        state.scrollTimeout = setTimeout(() => {
            controls.autoRotateSpeed = 0.2;
        }, 100);
    }

    // Use a longer throttle duration for mobile
    const throttleDuration = isMobile ? 80 : 40; // Increased from 60 to 80ms for mobile
    throttle(() => scrollLogic(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight), throttleDuration)();

    camera.updateProjectionMatrix();
    state.lastScrollY = scrollY;
}

function blobTweenMobilized(blobInner, blobOuter, mobilize = true) {
    if ((!blobInner && !blobOuter) || mobilize === isBlobMobilized) return;

    const greenColor = new THREE.Color('#9abe8b');
    const blueColor = new THREE.Color('#a9c3e7');


    isBlobMobilized = mobilize;

    setTimeout(() => {

        if (blobInner) {
            blobInner.traverse(child => {
                if (child.isMesh && child.material) {
                    if (!originalInnerColors.has(child.material)) {
                        originalInnerColors.set(child.material, child.material.color.clone());
                    }

                    const initialColor = new THREE.Color(child.material.color);
                    const targetColor = mobilize ? 
                        greenColor : 
                        originalInnerColors.get(child.material);

                    const innerBlobTween = new Tween({ r: initialColor.r, g: initialColor.g, b: initialColor.b })
                        .to({ r: targetColor.r, g: targetColor.g, b: targetColor.b }, mobilize ? 800 : 500)
                        .easing(Easing.Quadratic.InOut)
                        .onUpdate(({ r, g, b }) => {
                            child.material.color.setRGB(r, g, b);
                            child.material.needsUpdate = true;
                        })
                        .onComplete(() => {
                            state.blobTweenGroup.remove(innerBlobTween);
                        });

                    state.blobTweenGroup.add(innerBlobTween);
                    innerBlobTween.start();
                }
            });
        }

        if (blobOuter && blobOuter.children && blobOuter.children[0]) {
            const blobChild = blobOuter.children[0];
            if (blobChild.material) {
                // Store original material properties if not already stored
                if (originalOuterColor === null) {
                    originalOuterColor = {
                        color: blobChild.material.color.clone(),
                        roughness: blobChild.material.roughness,
                        metalness: blobChild.material.metalness,
                        envMapIntensity: blobChild.material.envMapIntensity
                    };
                }

                const initialColor = new THREE.Color(blobChild.material.color);
                const targetColor = mobilize ? blueColor : originalOuterColor.color;

                // Color transition
                const outerBlobTween = new Tween({ 
                    r: initialColor.r, 
                    g: initialColor.g, 
                    b: initialColor.b,
                    roughness: blobChild.material.roughness,
                    metalness: blobChild.material.metalness,
                    envMapIntensity: blobChild.material.envMapIntensity
                })
                .to({ 
                    r: targetColor.r, 
                    g: targetColor.g, 
                    b: targetColor.b,
                    roughness: mobilize ? 0.4 : originalOuterColor.roughness,
                    metalness: mobilize ? 0.12 : originalOuterColor.metalness
                }, mobilize ? 1000 : 500)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(({ r, g, b, roughness, metalness, envMapIntensity }) => {
                    blobChild.material.color.setRGB(r, g, b);
                    blobChild.material.roughness = roughness;
                    blobChild.material.metalness = metalness;
                    blobChild.material.envMapIntensity = envMapIntensity;
                    blobChild.material.needsUpdate = true;
                })
                .onComplete(() => {
                    state.blobTweenGroup.remove(outerBlobTween);
                });

                state.blobTweenGroup.add(outerBlobTween);
                outerBlobTween.start();
            }
        }
    }, mobilize ? 250 : 0); // 250ms delay if activating mobile color, 0ms if restoring og color
}

/**
 * Checks if an element is currently visible in the viewport between top and bottom
 * Used for determining which section is currently active
 * @param {HTMLElement} element - DOM element to check visibility
 * @returns {boolean} - True if element is visible between top and bottom of viewport
 */
function isVisibleBetweenTopAndBottom(element) {
    const rect = element.getBoundingClientRect();
    return rect.top <= 0 && rect.bottom > 0;
}

/**
 * Calculates scroll progress through a standard element
 * Progress is normalized between 0 and 1
 * @param {HTMLElement} element - DOM element to calculate progress for
 * @returns {string} - Progress value formatted to 4 decimal places
 */
function scrollProgress(element) {
    const rect = element.getBoundingClientRect();
    // Total scrollable distance is the element's height
    const scrollableDistance = rect.height;
    // How far we've scrolled into the element
    const scrolledDistance = Math.max(0, -rect.top);
    // Normalize between 0 and 1
    const progress = Math.max(0, Math.min(1, scrolledDistance / scrollableDistance));
    return parseFloat(progress).toFixed(4); // Truncate to 4 decimal places for precision
}

/**
 * Special scroll progress calculation for the last element
 * Accounts for viewport height in the calculation
 * @param {HTMLElement} element - Last DOM element to calculate progress for
 * @returns {string} - Progress value formatted to 4 decimal places
 */
function scrollProgress__LastElem(element) {
    const rect = element.getBoundingClientRect();
    // For last element, subtract viewport height from total scrollable distance
    const scrollableDistance = rect.height - window.innerHeight;
    // How far we've scrolled into the element
    const scrolledDistance = Math.max(0, -rect.top);
    // Normalize between 0 and 1
    const progress = Math.max(0, Math.min(1, scrolledDistance / scrollableDistance));
    return parseFloat(progress).toFixed(4);
}

function activateText(parentElement, timeout = true) {
    let activeText = parentElement.querySelector('.child');

    if (activeText) {
        if (!activeText.classList.contains('active')) {
            textChildren.forEach(child => {
                if (child !== activeText && child.classList.contains('active')) {
                    child.classList.remove('active');
                }
            });

            if (activeText && !activeText.classList.contains('active')) {
                if (activeTextTimeout) {
                    clearTimeout(activeTextTimeout);
                }

                if (timeout) {
                    activeTextTimeout = setTimeout(() => {
                        activeText.classList.add('active');
                    }, 400);
                } else {
                    activeText.classList.add('active');
                }
            }
        }
    }
}

function ribbonTweenOpacity(ribbons, initOpacity, targetOpacity, duration = (fadeInDuration * 1.4)) {
    state.ribbonTweenGroup.removeAll();
    if (!ribbons) return;

    if (ribbons.children) {
        ribbons.children.forEach(mesh => {
            if (mesh.material) {
                const currentState = { opacity: initOpacity };
                const targetState = { opacity: targetOpacity };

                const ribbonTween = new Tween(currentState)
                    .to(targetState, duration)
                    .easing(Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        mesh.material.opacity = currentState.opacity;
                        mesh.material.needsUpdate = true;
                    })
                    .onComplete(() => {
                        state.ribbonTweenGroup.remove(ribbonTween);
                    });

                state.ribbonTweenGroup.add(ribbonTween);
                ribbonTween.start();
            }
        });
    }
}

function cellSheenTween(blobInner, color = null) {
    state.blobTweenGroup.removeAll();
    if (!blobInner) return;

    blobInner.traverse(child => {
        if (child.isMesh && child.material) {
            const initialColor = new THREE.Color(child.material.sheenColor);
            const targetColor = color ? new THREE.Color(color) : new THREE.Color(child.material.color);

            const blobTween = new Tween({ r: initialColor.r, g: initialColor.g, b: initialColor.b })
                .to({ r: targetColor.r, g: targetColor.g, b: targetColor.b }, 400)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(({ r, g, b }) => {
                    child.material.sheenColor.setRGB(r, g, b);
                    child.material.needsUpdate = true;
                })
                .onComplete(() => {
                    state.blobTweenGroup.remove(blobTween);
                });

            state.blobTweenGroup.add(blobTween);
            blobTween.start();
        }
    });
}

function activateText__ZoomChild(activeElement) {
    if (activeElement) {
        zoomElements.forEach(element => {
            if (element === activeElement) {
                element.classList.add("active");
            } else {
                element.classList.remove("active");
            }
        });
    }
}

function dotTweenOpacity(spheres, initialOpacity, targetOpacity, wavingBlob, duration = 300) {
    state.dotTweenGroup.removeAll();
    spheres.forEach(sphere => {
        const currentState = { opacity: initialOpacity };
        const targetState = { opacity: targetOpacity };

        const sphereTween = new Tween(currentState)
            .to(targetState, duration)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                sphere.material.opacity = currentState.opacity;
                sphere.material.needsUpdate = true;
            })
            .onComplete(() => {
                state.dotTweenGroup.remove(sphereTween);
            });

        state.dotTweenGroup.add(sphereTween);
        sphereTween.start();
    });

    if (initialOpacity === 0 && targetOpacity === 1) {
        const initialScale = { scale: 0.96 };
        const targetScale = { scale: 1.0 };

        const scaleTween = new Tween(initialScale)
            .to(targetScale, (duration))
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                wavingBlob.scale.set(initialScale.scale, initialScale.scale, initialScale.scale);
            })
            .onComplete(() => {
                state.dotTweenGroup.remove(scaleTween);
            });

        state.dotTweenGroup.add(scaleTween);
        scaleTween.start();
    }

}

function dotUpdateColors(spheres, color) {
    spheres.forEach(sphere => {
        sphere.material.color = new THREE.Color(color);
        sphere.material.needsUpdate = true;
    });
}

function dotRandomizePositions(spheres, dotBounds) {
    spheres.forEach(sphere => {
        const randomPosition = getRandomPositionWithinBounds(dotBounds);
        sphere.position.copy(randomPosition);
        const randomDirection = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        sphere.velocity = randomDirection.multiplyScalar(0.014);
        sphere.position.needsUpdate = true;
        sphere.velocity.needsUpdate = true;
    });

    function getRandomPositionWithinBounds(bounds) {
        const x = (Math.random() * 2 - 1) * (bounds * 0.65);
        const y = (Math.random() * 2 - 1) * (bounds * 0.65);
        const z = (Math.random() * 2 - 1) * (bounds * 0.65);
        return new THREE.Vector3(x, y, z);
    }
}

function dotsTweenExplosion(wavingBlob, duration, groupIndex) {
    // Initialize cache if not exists and wavingBlob exists
    if (!dotGroupsCache && wavingBlob && wavingBlob.children) {
        dotGroupsCache = wavingBlob.children.filter(group => group && group.isGroup);
    }

    if (!dotGroupsCache) return;

    const group = dotGroupsCache[groupIndex];
    if (!group || explodedGroups.has(groupIndex)) return;

    explodedGroups.add(groupIndex);

    // Single combined tween for better performance
    const tweenState = { scale: 1, opacity: 1 };
    const scaleTween = new Tween(tweenState)
        .to({ scale: 3, opacity: 0 }, duration)
        .easing(Easing.Quadratic.InOut)
        .onUpdate(() => {
            group.scale.setScalar(tweenState.scale);
            if (group.children) {
                group.children.forEach(sphere => {
                    if (sphere && sphere.material) {
                        sphere.material.opacity = Math.max(0, tweenState.opacity);
                        sphere.material.needsUpdate = true;
                    }
                });
            }
        })
        .onComplete(() => {
            state.blobTweenGroup.remove(scaleTween);
            group.visible = false; // Hide group after explosion for better performance
        });

    state.blobTweenGroup.add(scaleTween);
    scaleTween.start();
}

function resetProductVisibility(product, applicatorObject) {
    if (!product) return;
    product.rotation.x = Math.PI / 2;

    // First handle the overflowMask
    product.traverse(child => {
        if (child.name === 'overflowMask') {
            child.visible = true;
            if (child.material) {
                child.material.transparent = false;
                child.material.depthWrite = true;
                child.material.depthTest = true;
                child.material.opacity = 1;
                child.renderOrder = 1;  // Render after starfield, before other objects
                child.material.needsUpdate = true;
            }
        }
    });

    // Then handle all other objects
    product.traverse(child => {
        if (child.name !== 'overflowMask') {
            child.visible = false;
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    mat.transparent = true;
                    mat.opacity = 0;
                    mat.renderOrder = 2;  // Render after the mask
                    mat.needsUpdate = true;
                });
            }
        }
    });

    // Handle applicator object
    if (applicatorObject) {
        applicatorObject.traverse(child => {
            child.visible = true;
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    mat.visible = true;
                    mat.opacity = 1;
                    mat.renderOrder = 2;  // Render after the mask
                    mat.needsUpdate = true;
                });
            }
        });
    }
}

function restoreDotScale(wavingBlob) {
    if (!wavingBlob || !wavingBlob.scale) return;

    wavingBlob.scale.set(1, 1, 1);
    if (wavingBlob.children) {
        wavingBlob.children.forEach(group => {
            if (group && group.isGroup && group.scale) {
                group.scale.set(1, 1, 1);
            }
        });
    }
}

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

const smoothLerp = isMobile
    ? (start, end, progress) => start + (end - start) * progress
    : (start, end, progress) => start + (end - start) * smoothstep(progress);

function smoothstep(x) {
    return x * x * (3 - 2 * x);
}

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function updateScrollIndicator() {
    if (!isClickScroll) { // Only update if not initiated by a click
        scrollDots.forEach(dot => {
            const section = dot.dataset.section;
            if ((section === 'splash' && splashBool) ||
                (section === 'zoom' && (zoomBool || zoomOutBool)) ||
                (section === 'pitch' && pitchBool) ||
                (section === 'product' && productBool)) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
}

scrollDots.forEach(dot => {
    dot.addEventListener('click', () => {
        const section = dot.dataset.section;
        const targetElement = document.querySelector(`.${section}`);

        scrollDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');

        isClickScroll = true;

        if (targetElement) {
            let targetPosition;
            if (section === 'product') {
                targetPosition = targetElement.offsetTop + targetElement.offsetHeight;
            } else {
                targetPosition = targetElement.offsetTop;
            }
            smoothScrollTo(targetPosition);
        } else {
            console.error(`Target section "${section}" not found.`);
        }
    });
});

function smoothScrollTo(targetPosition) {
    if (state.lenis) {
        const sections = ['splash', 'zoom', 'pitch', 'product'];
        const currentSection = sections.find(section => {
            const elem = document.querySelector(`.${section}`);
            return elem && isVisibleBetweenTopAndBottom(elem);
        }) || 'splash';

        const targetSection = sections.find(section => {
            const elem = document.querySelector(`.${section}`);
            return elem && elem.offsetTop === targetPosition;
        });

        const currentIndex = sections.indexOf(currentSection);
        const targetIndex = sections.indexOf(targetSection);
        const numberOfSections = Math.abs(targetIndex - currentIndex);

        let duration;
        if (numberOfSections === 1) {
            duration = isMobile ? 1500 : 1200; // Longer duration on mobile
        } else if (numberOfSections === 2) {
            duration = isMobile ? 3200 : 2800;
        } else if (numberOfSections >= 3) {
            duration = isMobile ? 4000 : 3600;
        } else {
            duration = 0;
        }

        // Use Lenis smooth scroll with easing
        state.lenis.scrollTo(targetPosition, {
            duration: duration,
            easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, // Custom easing function
            force: isMobile // Force smooth scroll on mobile
        });
        
        // Reset scroll indicator after animation
        setTimeout(() => {
            isClickScroll = false;
        }, duration + 100);
    } else {
        // Fallback to default smooth scroll if Lenis is not available
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        updateScrollIndicator();
    }, 100);
});