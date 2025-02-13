import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from './anim.js';
import { cleanupManager } from '../utils/dispose.js';
import { MOBILIZE_GREEN, DESKTOP_BLUE, MOBILE_BLUE } from '../utils/materials.js';

const isMobile = window.innerWidth < 768;

const green = new THREE.Color('#92cb86');
const orange = new THREE.Color('#ffbb65');
const yellow = new THREE.Color('#f1ff00');

// =====================================================================================

function scrollLogic(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {

    splashBool = isVisibleBetweenTopAndBottom(splashArea);
    zoomBool = isVisibleBetweenTopAndBottom(zoomArea);
    pitchBool = isVisibleBetweenTopAndBottom(pitchArea);
    productBool = isVisibleBetweenTopAndBottom(productArea);
    updateScrollIndicator();

    // Get speckleSystem from state
    const speckleSystem = state.app?.speckleSystem;
    if (!speckleSystem) return;

    // Determine previous section from boolean flags
    const previousSection =
        splashCurrent ? 'splash' :
            zoomCurrent ? 'zoom' :
                pitchCurrent ? 'pitch' :
                    productCurrent ? 'product' : null;

    splashBool = isVisibleBetweenTopAndBottom(splashArea);
    zoomBool = isVisibleBetweenTopAndBottom(zoomArea);
    pitchBool = isVisibleBetweenTopAndBottom(pitchArea);
    productBool = isVisibleBetweenTopAndBottom(productArea);
    updateScrollIndicator();

    if (splashBool) {
        splashProgress = scrollProgress(splashArea);
        const scale = smoothLerp(1, 1.6, splashProgress);
        cellObject.scale.setScalar(scale);

        if (!splashCurrent) {
            if (!cellObject.visible) {
                cellObject.visible = true;
            }

            activateText(splashArea);

            if (zoomCurrent) {
                speckleSystem.tweenOpacity(0, 0);
                ribbonTweenOpacity(ribbons, 0, 1);
                cellSheenTween(blobInner);
                zoomCurrent = false;
            }

            if (isBlobMobilized) {
                blobTweenMobilized(blobInner, blobOuter, false);
            }

            if (product) {
                if (!cleanupManager.disposedProduct) {
                    //Manager.disposeProduct(product);
                }
            }
            if (state.starField) state.starField.visible = false;

            splashCurrent = true;
            zoomCurrent = false;
            zoomFirstCurrent = false;
            pitchTextActivated = false;
        }
    }

    else if (zoomBool) {
        if (!zoomCurrent) {
            speckleSystem.tweenOpacity(1, fadeInDuration);

            if (splashCurrent) {
                ribbonTweenOpacity(ribbons, 1, 0);
                splashCurrent = false;
            } else if (pitchCurrent) {
                if (wavingBlob) {
                    restoreDotScale(wavingBlob);
                    wavingBlob.children.forEach(group => {
                        if (group.isGroup) {
                            group.visible = true;
                        }
                    });
                }

                if (isBlobMobilized) {
                    const duration = window.innerWidth < 768 ? 500 : 800;
                    blobTweenMobilized(blobInner, blobOuter, false, duration);
                }

                cellSheenTween(blobInner);

                if (!cellObject.visible) {
                    cellObject.visible = true;
                }

                if (product) {
                    if (!cleanupManager.disposedProduct) {
                        //cleanupManager.disposeProduct(product);
                    }
                }
                if (state.starField) state.starField.visible = false;

                pitchCurrent = false;
                pitchTextActivated = false;
            }

            zoomCurrent = true;
            activateText(zoomArea);
        }

        // Debounced section detection
        const now = performance.now();
        if (now - lastZoomUpdate > ZOOM_UPDATE_INTERVAL) {
            zoomProgress = scrollProgress(zoomArea);
            cachedZoomSection = Math.floor(zoomProgress * 3);
            lastZoomUpdate = now;
        }

        if (zoomFirst && zoomSecond && zoomThird) {
            if (cachedZoomSection === 0) {
                if (!zoomFirstCurrent) {
                    activateText__ZoomChild(zoomFirst);
                    if (zoomCurrent && !zoomSecondCurrent) {
                        cellSheenTween(blobInner, orange);
                    } else if (zoomSecondCurrent) {
                        speckleSystem.tweenOpacity(0, fadeOutDuration);
                        setTimeout(() => {
                            if (zoomFirstCurrent) {
                                speckleSystem.updateColors(orange);
                                speckleSystem.randomizePositions();
                                speckleSystem.tweenOpacity(1, fadeInDuration);
                            }
                        }, fadeOutDuration);
                    }
                    zoomFirstCurrent = true;
                    zoomSecondCurrent = false;
                }
            }
            else if (cachedZoomSection === 1) {
                if (!zoomSecondCurrent) {
                    activateText__ZoomChild(zoomSecond);
                    speckleSystem.tweenOpacity(0, fadeOutDuration);
                    setTimeout(() => {
                        if (zoomSecondCurrent) {
                            speckleSystem.updateColors(yellow);
                            speckleSystem.randomizePositions();
                            speckleSystem.tweenOpacity(1, fadeInDuration);
                            cellSheenTween(blobInner, yellow);
                        }
                    }, fadeOutDuration);
                    zoomFirstCurrent = false;
                    zoomSecondCurrent = true;
                    zoomThirdCurrent = false;
                }
            }
            else if (cachedZoomSection === 2) {
                if (!zoomThirdCurrent) {
                    activateText__ZoomChild(zoomThird);
                    if (zoomSecondCurrent) {
                        speckleSystem.tweenOpacity(0, fadeOutDuration);
                        setTimeout(() => {
                            if (zoomThirdCurrent) {
                                speckleSystem.updateColors(green);
                                speckleSystem.randomizePositions();
                                speckleSystem.tweenOpacity(1, fadeInDuration);
                                cellSheenTween(blobInner, green);
                            }
                        }, fadeOutDuration);
                    } else {
                        wavingBlob.children.forEach(group => {
                            if (group.isGroup) {
                                group.visible = true;
                            }
                        });
                        speckleSystem.tweenOpacity(1, fadeInDuration);
                        cellSheenTween(blobInner, green);
                    }
                    zoomSecondCurrent = false;
                    zoomThirdCurrent = true;
                }
            }
        }
    }

    else if (pitchBool) {
        if (!pitchCurrent) {
            if (!pitchTextActivated) {
                activateText(pitchArea);
                pitchTextActivated = true;
            }

            // if coming from zoom, trigger explosion
            if (zoomThirdCurrent) {
                if (!isBlobMobilized) {
                    explodedGroups.clear();
                    const explosionDuration = 1600; // Total duration in ms

                    // Trigger blob color change with same duration
                    blobTweenMobilized(blobInner, blobOuter, true, explosionDuration * 0.7);

                    // Schedule explosions based on time thresholds
                    EXPLOSION_PHASES.forEach(phase => {
                        setTimeout(() => {
                            if (zoomThirdCurrent && !explodedGroups.has(phase.index)) {
                                speckleSystem.tweenExplosion(explosionDuration * (1 - phase.threshold), phase.index);
                                explodedGroups.add(phase.index);
                            }
                        }, explosionDuration * phase.threshold);
                    });

                    // delay text activation, synced to dot explosion
                    setTimeout(() => {
                        if (zoomCurrent) {
                            activateText(pitchArea);
                            pitchTextActivated = true;
                        }
                    }, explosionDuration * 0.4);
                }

                pitchCurrent = true;
                productCurrent = false;
            }
            else if (productCurrent) {
                controls.autoRotate = true;
                controls.enableRotate = true;
                controls.autoRotateSpeed = 0.2;

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

                if (state.sceneManager?.directionalLight) {
                    const { directionalLight } = state.sceneManager;
                    directionalLight.visible = false;
                    directionalLight.intensity = 0;
                }
            }
            zoomCurrent = false;
            pitchCurrent = true;
        }
    }
    else if (productBool) {
        if (!productCurrent) {
            // Load product on demand when entering product section
            if (!product) {
                // Keep cell visible during product loading
                state.app.loadProductOnDemand().then(loadedProduct => {
                    product = loadedProduct;

                    // Setup initial state before making visible
                    if (product) {
                        product.rotation.x = Math.PI / 2;
                        product.rotation.z = 0;
                        const productScale = isMobile ? 16 : 20;
                        product.scale.set(productScale, productScale, productScale);

                        if (state.applicatorObject) {
                            state.applicatorObject.position.y = 1;
                            state.applicatorObject.rotation.y = 0;
                        }

                        // Now that everything is set up, make product visible and reset visibility
                        product.visible = true;
                        resetProductVisibility(product, state.applicatorObject);
                        //cleanupManager.disposedProduct = false;  // Allow product to be shown

                        // Only hide cell object after product is ready
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
                    }

                    // Disable auto-rotation and manual rotation when entering product area
                    controls.autoRotate = false;
                    controls.enableRotate = false;
                });
            } else {
                resetProductVisibility(product, state.applicatorObject);
                //cleanupManager.disposedProduct = false;  // Allow product to be shown

                // Disable auto-rotation and manual rotation when entering product area
                controls.autoRotate = false;
                controls.enableRotate = false;

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

                // Hide cell object only when product is ready
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
        }

        productProgress = scrollProgress__LastElem(productArea);

        if (productProgress > 0.5 && !cleanupManager.disposedCellAndStarfield) {
            //console.log('🔄 Product progress > 0.5, disposing cell and starfield');
            cleanupManager.disposeCellAndStarfield(cellObject, state.starField);
        } else if (productProgress <= 0.5 && cleanupManager.disposedCellAndStarfield) {
            //console.log('🔄 Product progress <= 0.5, reinstating cell and starfield');
            cleanupManager.reinstateCellAndStarfield(cellObject, state.starField);
            // Ensure cell is visible when reinstated
            if (cellObject) {
                cellObject.visible = true;
            }
        }

        if (product && product.children) {
            // ===== PHASE 1: Initial Transition (0 to 0.75) =====
            if (productProgress <= 0.75) {

                if (productProgress > 0.3 && !navClearFlag && navElement) {
                    navElement.classList.add('clear');
                    navClearFlag = true;
                } else if (productProgress <= 0.3 && navClearFlag && navElement) {
                    navElement.classList.remove('clear');
                    navClearFlag = false;
                }

                if (!productPhase1Active) {
                    resetProductVisibility(product, state.applicatorObject);
                    cellObject.visible = true;

                    // Restore product rotation and position when coming from phase 2
                    if (productPhase2Active) {
                        product.rotation.set(Math.PI / 2, 0, 0);
                        product.position.set(0, 0, 0);
                        const productScale = isMobile ? 16 : 20;
                        product.scale.set(productScale, productScale, productScale);

                        renderer.toneMappingExposure = 1.0;
                        ambientLight.intensity = 4.6;
                        lightingTransitionComplete = true;
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
                            child.material.needsUpdate = true;
                        }

                        if (child.name === 'outer-cap' && child.material) {
                            if (child.material.ior != 200) {
                                child.material.ior = 200;
                                child.material.needsUpdate = true;
                            }
                        }
                    });

                    if (state.sceneManager?.directionalLight) {
                        const { directionalLight } = state.sceneManager;
                        directionalLight.visible = false;
                        directionalLight.intensity = 0;
                    }

                    productPhase2Active = false;
                    productPhase3Active = false;
                    productPhase1aActive = false; // overwritten if (productProgress > 0.375) is met
                    productPhase1Active = true;
                }

                if (state.starField) {
                    state.starField.visible = true;
                    state.starField.updateProgress(productProgress * 1.33, productBool && productProgress <= 0.75);
                }

                const cellScale = smoothLerp(1.6, 0.016, productProgress / 0.75);
                cellObject.scale.setScalar(cellScale);


                // hide text
                if (productProgress > 0.375) {
                    if (!productPhase1aActive) {
                        textChildren.forEach(child => {
                            if (child.classList.contains('active')) {
                                child.classList.remove('active');
                                pitchTextActivated = false;
                            }
                        });

                        if (state.applicatorObject) {
                            product.traverse(child => {
                                child.visible = true;
                            });

                            console.log(state.applicatorObject);

                            state.applicatorObject.rotation.y = 0;
                            state.applicatorObject.position.y = 1;

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
                        productPhase1aActive = true;
                        lightingTransitionComplete = false;
                    }

                    const fadeProgress = (productProgress - 0.375) / 0.375;

                    // Fade in specific product elements
                    if (product && fadeProgress > 0.5) {
                        product.traverse(child => {
                            if (child.name === 'peel' || child.parent?.name === 'peel' ||
                                child.name === 'inner-cap' || child.parent?.name === 'inner-cap') {
                                if (child.material) {
                                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                                    materials.forEach(mat => {
                                        mat.opacity = smoothLerp(0, 1, (fadeProgress - 0.5) * 2);
                                        mat.needsUpdate = true;
                                    });
                                }
                            }
                        });
                    }

                    renderer.toneMappingExposure = smoothLerp(1, 0.6, fadeProgress);

                    const productScale = isMobile
                        ? smoothLerp(16, 4.8, fadeProgress)  // Mobile
                        : smoothLerp(20, 4, fadeProgress);  // Desktop
                    product.scale.setScalar(productScale);

                    if (fadeProgress >= 1) {
                        lightingTransitionComplete = true;
                    }
                }
            }
            // ===== PHASE 2: Product Rotation (0.75 to 0.93) =====
            else if (0.75 <= productProgress && productProgress <= 0.93) {
                // Hide cell object and starfield after transition
                if (!productPhase2Active) {
                    cellObject.visible = false;
                    if (state.starField) state.starField.visible = false;

                    const scrollIndicator = document.querySelector('.scroll-indicator');
                    if (scrollIndicator && scrollIndicator.classList.contains('hidden')) {
                        scrollIndicator.classList.remove('hidden');
                    }

                    if (!isMobile) {
                        product.scale.setScalar(4);
                    } else if (isMobile) {
                        product.scale.setScalar(4.8);
                    }

                    if (state.applicatorObject) {
                        state.applicatorObject.position.y = 1;
                        state.applicatorObject.rotation.y = 0;
                    }

                    product.traverse(child => {
                        if (child.name === 'overflowMask') {
                            child.visible = false;
                        } else {
                            child.visible = true;
                        }
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                // this enables the pod color to shine through
                                mat.transparent = child.name === 'film-cover' || child.name === 'taxa-name';
                                mat.depthWrite = true;
                                mat.depthTest = true;
                                mat.opacity = 1;
                                mat.needsUpdate = true;
                            });
                        }
                        if (child.name === 'outer-cap' && child.material) {
                            if (child.material.ior != 1.5) {
                                child.material.ior = 1.5;
                                child.material.needsUpdate = true;
                            }
                        }
                    });

                    // Initialize directional light when entering product phase
                    if (state.sceneManager?.directionalLight) {
                        const { directionalLight } = state.sceneManager;
                        directionalLight.visible = true;
                    }

                    productPhase2Active = true;
                    productPhase1Active = false;
                    productPhase3Active = false;
                }

                const rotationProgress = (productProgress - 0.75) / 0.18;

                renderer.toneMappingExposure = smoothLerp(0.6, 0.36, rotationProgress);

                // Handle product movement
                if (isMobile) {
                    // MOBILE 2a+b
                    if (productProgress >= 0.75) {
                        const rotationProgress = (productProgress - 0.75) / 0.18;

                        product.rotation.x = smoothLerp(Math.PI / 2, Math.PI / 7, rotationProgress);
                        product.rotation.y = smoothLerp(0, Math.PI / 5, rotationProgress);
                        product.rotation.z = smoothLerp(0, -Math.PI / 6, rotationProgress);

                        product.position.x = smoothLerp(0, -3, rotationProgress);
                        product.position.y = smoothLerp(0, 5.4, rotationProgress);
                    }
                } else {
                    // DESKTOP 2a
                    product.rotation.x = smoothLerp(Math.PI / 2, Math.PI / 12, rotationProgress);

                    // DESKTOP 2b
                    if (rotationProgress > 0.5) {
                        const zRotationProgress = (rotationProgress - 0.5) / 0.5;

                        product.rotation.y = smoothLerp(0, Math.PI / 3.6, zRotationProgress);
                        product.rotation.z = smoothLerp(0, -Math.PI / 8, zRotationProgress);

                        product.position.x = smoothLerp(0, -20, zRotationProgress);
                        product.position.y = smoothLerp(0, -16, zRotationProgress);

                        const productScale = smoothLerp(4, 5.5, zRotationProgress);
                        product.scale.setScalar(productScale);

                    }
                }

                // Handle directional light intensity animation
                if (state.sceneManager?.directionalLight) {
                    const { directionalLight } = state.sceneManager;
                    const lightProgress = isMobile
                        ? (productProgress >= 0.87 ? (productProgress - 0.87) / 0.06 : 0)
                        : (rotationProgress > 0.5 ? (rotationProgress - 0.5) / 0.5 : 0);

                    directionalLight.intensity = smoothLerp(0, 8, lightProgress);
                    ambientLight.intensity = smoothLerp(4.6, 3.2, lightProgress);
                }
            }

            // ===== PHASE 3: Applicator Animation (0.93 to 1.0) =====
            else if (productProgress >= 0.93) {
                if (!productPhase3Active) {
                    renderer.toneMappingExposure = 0.36;
                    ambientLight.intensity = 3.2;
                    lightingTransitionComplete = true;

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

                // Keep directional light at full intensity during applicator animation
                if (state.sceneManager?.directionalLight) {
                    state.sceneManager.directionalLight.intensity = 8;
                }

                if (state.applicatorObject) {
                    // 3a. Applicator Position (0.93 to 0.97)
                    if (productProgress <= 0.97) {
                        const positionProgress = (productProgress - 0.93) / 0.04;
                        state.applicatorObject.position.y = smoothLerp(1, 0, positionProgress);
                    }
                    // 3b. Applicator Rotation (0.97 to 1.0)
                    else {
                        if (!productTextActivated) {
                            activateText(productArea);
                            productTextActivated = true;
                        }
                        const rotationProgress = (productProgress - 0.97) / 0.03;
                        state.applicatorObject.rotation.y = smoothLerp(0, Math.PI * 0.26, rotationProgress);
                    }
                }

                // Handle text activation when progress is past 0.97
                if (productProgress > 0.97 && !productTextActivated) {
                    activateText(productArea, false);
                    productTextActivated = true;
                }
            }

        }
    }

    // Check if section changed after processing scroll
    const newSection =
        splashCurrent ? 'splash' :
            zoomCurrent ? 'zoom' :
                pitchCurrent ? 'pitch' :
                    productCurrent ? 'product' : null;

    // Only handle cleanup during actual section transitions
    if (previousSection !== newSection) {
        console.log(`🔄 Section changed from ${previousSection} to ${newSection}`);

        // Use the new centralized disposal logic
        cleanupManager.handleVisibilityAndDisposal({
            cellObject,
            starField: state.starField,
            speckleSystem: state.app?.speckleSystem,
            product,
            ribbons,
            wavingBlob,
            splashBool,
            zoomBool,
            pitchBool,
            productBool,
            productProgress,
            section: newSection,
            explodedGroups
        });
    }

    // Special case: Handle product progress threshold crossing
    if (productCurrent) {
        cleanupManager.handleVisibilityAndDisposal({
            cellObject,
            starField: state.starField,
            speckleSystem: state.app?.speckleSystem,
            product,
            ribbons,
            wavingBlob,
            splashBool,
            zoomBool,
            pitchBool,
            productBool,
            productProgress,
            section: newSection,
            explodedGroups
        });
    }

    camera.updateProjectionMatrix();
    state.lastScrollY = scrollY;
}

// =====================================================================================

const navElement = document.querySelector('.nav');
const splashArea = document.querySelector('.splash');
const zoomArea = document.querySelector('.zoom');
const pitchArea = document.querySelector('.pitch');
const productArea = document.querySelector('.product');
const scrollDots = document.querySelectorAll('.scroll-dot');

const textChildren = document.querySelectorAll('.child');
const zoomFirst = document.querySelector('#zoomFirst');
const zoomSecond = document.querySelector('#zoomSecond');
const zoomThird = document.querySelector('#zoomThird');
const zoomElements = [zoomFirst, zoomSecond, zoomThird];

const fadeInDuration = 400;
const fadeOutDuration = 180;

let splashBool, zoomBool, pitchBool, productBool;
let splashProgress, zoomProgress, pitchProgress, productProgress;

let activeTextTimeout;

let splashCurrent = false;
let zoomCurrent = false;
let pitchCurrent = false;
let productCurrent = false;

let zoomFirstCurrent = false;
let zoomSecondCurrent = false;
let zoomThirdCurrent = false;

let productPhase1Active = false;
let productPhase1aActive = false;
let productPhase2Active = false;
let productPhase3Active = false;
let isBlobMobilized = false;

let lightingTransitionComplete = false;
let productTextActivated = false;
let pitchTextActivated = false;
let navClearFlag = false;

let isClickScroll = false;
let scrollTimeout;

let scrollRAF;
let indicatorRAF;

let explodedGroups = new Set();
let dotGroupsCache = null;
let originalInnerColors = new WeakMap();
let originalOuterColor = null;
let originalInnerScale = null;
let originalOuterScale = null;

// Update the explosion phases to be time percentages
const EXPLOSION_PHASES = [
    { threshold: 0.01, index: 0 },
    { threshold: 0.2, index: 1 },
    { threshold: 0.45, index: 2 },
    { threshold: 0.7, index: 3 },
    { threshold: 0.9, index: 4 }
];

export function animatePage(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {
    let scrollY = window.scrollY;
    let delta = scrollY - state.lastScrollY;
    let scrollDiff = Math.abs(delta);

    // Enable auto-rotation by default
    controls.autoRotate = true;

    if (isMobile) {
        const multiplier = Math.floor(scrollDiff / 30);
        // Scroll down: faster rotation, scroll up: slower reverse rotation
        controls.autoRotateSpeed = delta > 0
            ? Math.min(0.5 + (multiplier * 3), 10)  // Normal speed for downward
            : -Math.min(0.5 + (multiplier * 1.2), 6);  // Damped speed for upward
    } else {
        // Desktop logic
        const multiplier = Math.floor(scrollDiff / 20);
        controls.autoRotateSpeed = delta > 0
            ? Math.min(0.5 + (multiplier * 8), 20)  // Normal speed for downward
            : -Math.min(0.5 + (multiplier * 4), 12);  // More damped speed for upward
    }

    if (scrollRAF) {
        cancelAnimationFrame(scrollRAF);
    }

    const resetSpeed = (timestamp) => {
        if (!state.lastResetTime) state.lastResetTime = timestamp;
        const elapsed = timestamp - state.lastResetTime;

        if (elapsed < 100) {
            scrollRAF = requestAnimationFrame(resetSpeed);
        } else {
            controls.autoRotateSpeed = isMobile ? 0.2 : 0.5;
            state.lastResetTime = null;
        }
    };

    scrollRAF = requestAnimationFrame(resetSpeed);

    if (productBool && productCurrent) {
        controls.autoRotate = false;
        controls.enableRotate = false;
    } else {
        controls.autoRotate = true;
        controls.enableRotate = true;

    }

    const throttleDuration = isMobile ? 100 : 100;
    throttle(() => scrollLogic(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight), throttleDuration)();

    camera.updateProjectionMatrix();
    state.lastScrollY = scrollY;
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
                    cancelAnimationFrame(activeTextTimeout);
                }

                if (timeout) {
                    const startTime = performance.now();
                    const animate = (currentTime) => {
                        if (currentTime - startTime >= 400) {
                            activeText.classList.add('active');
                        } else {
                            activeTextTimeout = requestAnimationFrame(animate);
                        }
                    };
                    activeTextTimeout = requestAnimationFrame(animate);
                } else {
                    activeText.classList.add('active');
                }
            }
        }
    }
}

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

        // Convert durations to seconds and use proper easing format
        const duration = (
            numberOfSections === 1 ? (isMobile ? 1.5 : 1.2) :
                numberOfSections === 2 ? (isMobile ? 3.2 : 2.8) :
                    numberOfSections >= 3 ? (isMobile ? 4.0 : 3.6) : 0
        );

        state.lenis.scrollTo(targetPosition, {
            duration: duration,
            easing: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, // Simplified easing syntax
            lock: true,
            force: isMobile,
            onComplete: () => {
                // Use slight delay to ensure scroll position is settled
                setTimeout(() => {
                    isClickScroll = false;
                }, 100);
            }
        });
    } else {
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

const scrollHandler = () => {
    if (indicatorRAF) {
        cancelAnimationFrame(indicatorRAF);
    }
    indicatorRAF = requestAnimationFrame(updateScrollIndicator);
};

window.removeEventListener('scroll', scrollHandler);
//cleanupManager.addListener(window, 'scroll', scrollHandler);

export function cleanup() {
    if (scrollRAF) {
        cancelAnimationFrame(scrollRAF);
    }
    if (indicatorRAF) {
        cancelAnimationFrame(indicatorRAF);
    }
    if (activeTextTimeout) {
        cancelAnimationFrame(activeTextTimeout);
    }

    cleanupManager.cleanup();
}

function blobTweenMobilized(blobInner, blobOuter, mobilize = true, duration = 200) {
    // Early exit conditions
    if (!blobInner || !blobOuter || isBlobMobilized === mobilize) return;

    // Update state
    isBlobMobilized = mobilize;

    // Static color instances - reused across calls
    const staticTempColor = new THREE.Color();
    const staticGreenColor = MOBILIZE_GREEN;
    const staticBlueColor = isMobile ? MOBILE_BLUE : DESKTOP_BLUE;

    // Clear existing tweens
    const stateGroup = state.mobilizeTweenGroup;
    stateGroup.removeAll();

    // Cache outer material once
    const outerMaterial = blobOuter.children?.[0]?.material;

    // Initialize scales if needed (only done once)
    if (!originalInnerScale) {
        originalInnerScale = blobInner.scale.clone();
        originalOuterScale = blobOuter.scale.clone();
    }

    // Batch inner material collection
    const innerMaterialsData = [];
    blobInner.traverse(child => {
        if (child.isMesh && child.material) {
            const material = child.material;
            if (!originalInnerColors.has(material)) {
                originalInnerColors.set(material, material.color.clone());
            }
            innerMaterialsData.push({
                material,
                initialColor: material.color.clone(),
                targetColor: mobilize ? staticGreenColor : originalInnerColors.get(material)
            });
        }
    });

    // Single tween for all inner materials and scale
    if (innerMaterialsData.length > 0) {
        const startScale = blobInner.scale.x;
        const targetScale = mobilize ? 1.1 : originalInnerScale.x;

        const combinedTween = new Tween({ t: 0, scale: startScale })
            .to({ t: 1, scale: targetScale }, duration)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(({ t, scale }) => {
                // Batch update all materials
                innerMaterialsData.forEach(({ material, initialColor, targetColor }) => {
                    staticTempColor.lerpColors(initialColor, targetColor, t);
                    material.color.copy(staticTempColor);
                });

                // Single scale update
                blobInner.scale.setScalar(scale);

                // Single needsUpdate flag
                blobInner.traverse(child => {
                    if (child.isMesh) child.material.needsUpdate = true;
                });
            })
            .onComplete(() => stateGroup.remove(combinedTween));

        stateGroup.add(combinedTween);
        combinedTween.start();
    }

    // Outer material optimization
    if (outerMaterial) {
        // Initialize original state once
        if (!originalOuterColor) {
            originalOuterColor = {
                opacity: outerMaterial.opacity,
                transparent: outerMaterial.transparent,
                color: outerMaterial.color.clone(),
                roughness: outerMaterial.roughness,
                metalness: outerMaterial.metalness,
                envMapIntensity: outerMaterial.envMapIntensity,
                transmission: outerMaterial.transmission,
                reflectivity: outerMaterial.reflectivity
            };
        }

        // Create a state object that holds current values
        const isPhysicalMaterial = outerMaterial instanceof THREE.MeshPhysicalMaterial;
        const currentState = {
            opacity: outerMaterial.opacity,
            roughness: outerMaterial.roughness,
            metalness: outerMaterial.metalness,
            envMapIntensity: outerMaterial.envMapIntensity,
            colorR: outerMaterial.color.r,
            colorG: outerMaterial.color.g,
            colorB: outerMaterial.color.b,
            // Only include physical properties if material is physical
            ...(isPhysicalMaterial && {
                transmission: outerMaterial.transmission,
                reflectivity: outerMaterial.reflectivity
            })
        };

        // Define target state
        const targetColor = mobilize ? staticBlueColor : originalOuterColor.color;
        const targetState = {
            opacity: mobilize ? 1 : originalOuterColor.opacity,
            roughness: mobilize ? 0.4 : originalOuterColor.roughness,
            metalness: mobilize ? 0 : originalOuterColor.metalness,
            envMapIntensity: mobilize ? 0.6 : originalOuterColor.envMapIntensity,
            colorR: targetColor.r,
            colorG: targetColor.g,
            colorB: targetColor.b,
            // Only include physical targets if material is physical
            ...(isPhysicalMaterial && {
                transmission: mobilize ? 0.6 : originalOuterColor.transmission,
                reflectivity: mobilize ? 0.4 : originalOuterColor.reflectivity
            })
        };

        // Single tween for outer material that includes color
        const outerTween = new Tween(currentState)
            .to(targetState, duration)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(state => {
                outerMaterial.opacity = state.opacity;
                outerMaterial.roughness = state.roughness;
                outerMaterial.metalness = state.metalness;
                outerMaterial.envMapIntensity = state.envMapIntensity;
                // Only update physical material properties if material is MeshPhysicalMaterial
                if (outerMaterial instanceof THREE.MeshPhysicalMaterial) {
                    outerMaterial.transmission = state.transmission;
                    outerMaterial.reflectivity = state.reflectivity;
                }
                outerMaterial.color.setRGB(state.colorR, state.colorG, state.colorB);
                outerMaterial.needsUpdate = true;
            })
            .onComplete(() => {
                stateGroup.remove(outerTween);
                // Ensure final values are set exactly
                Object.assign(outerMaterial, {
                    opacity: targetState.opacity,
                    roughness: targetState.roughness,
                    metalness: targetState.metalness,
                    envMapIntensity: targetState.envMapIntensity,
                    transmission: targetState.transmission,
                    reflectivity: targetState.reflectivity
                });
                outerMaterial.color.copy(targetColor);
                outerMaterial.needsUpdate = true;
            });

        stateGroup.add(outerTween);
        outerTween.start();
    }

    // Cleanup tween
    stateGroup.add(new Tween({})
        .delay(duration + 10)
        .onComplete(() => {
            if (outerMaterial) {
                outerMaterial.opacity = originalOuterColor.opacity;
                outerMaterial.transparent = originalOuterColor.transparent;
            }
            blobOuter.scale.copy(originalOuterScale);
            stateGroup.removeAll();
        }));
}

function isVisibleBetweenTopAndBottom(element) {
    const rect = element.getBoundingClientRect();
    return rect.top <= 0 && rect.bottom > 0;
}

function scrollProgress(element) {
    const rect = element.getBoundingClientRect();
    const scrollableDistance = rect.height;
    const scrolledDistance = Math.max(0, -rect.top);
    const progress = Math.max(0, Math.min(1, scrolledDistance / scrollableDistance));
    return parseFloat(progress).toFixed(4);
}

function scrollProgress__LastElem(element) {
    const rect = element.getBoundingClientRect();
    const scrollableDistance = rect.height - window.innerHeight;
    const scrolledDistance = Math.max(0, -rect.top);
    const progress = Math.max(0, Math.min(1, scrolledDistance / scrollableDistance));
    return parseFloat(progress).toFixed(4);
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

function cellSheenTween(blobInner, color = null) {
    if (isMobile) return;
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
                    const tempColor = new THREE.Color();
                    tempColor.setRGB(r, g, b);
                    child.material.sheenColor.copy(tempColor);
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

function resetProductVisibility(product, applicatorObject) {
    if (!product) return;

    product.traverse(child => {
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(mat => {
                if (!cleanupManager.disposables.has(mat)) {
                    cleanupManager.addDisposable(mat);
                }
            });
        }
    });

    product.traverse(child => {
        if (child.name === 'overflowMask') {
            child.visible = true;
            if (child.material) {
                child.material.transparent = false;
                child.material.depthWrite = true;
                child.material.depthTest = true;
                child.material.opacity = 1;
                child.renderOrder = 1;
                child.material.needsUpdate = true;
            }
        }
    });

    product.traverse(child => {
        if (child.name !== 'overflowMask') {
            child.visible = false;
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    mat.transparent = true;
                    mat.opacity = 0;
                    mat.renderOrder = 2;
                    mat.needsUpdate = true;
                });
            }
        }
    });

    if (applicatorObject) {
        applicatorObject.traverse(child => {
            child.visible = true;
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    mat.visible = true;
                    mat.opacity = 1;
                    mat.renderOrder = 2;
                    mat.needsUpdate = true;
                });
            }
        });
    }
}

function restoreDotScale(wavingBlob) {
    if (!wavingBlob || !wavingBlob.scale) return;

    wavingBlob.scale.setScalar(1);
    if (wavingBlob.children) {
        wavingBlob.children.forEach(group => {
            if (group && group.isGroup && group.scale) {
                group.scale.setScalar(1);
            }
        });
    }
}

const smoothLerp = isMobile
    ? (start, end, progress) => {
        return start + (end - start) * (progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2);
    }
    : (start, end, progress) => start + (end - start) * smoothstep(progress);

function smoothstep(x) {
    return x * x * (3 - 2 * x);
}

function throttle(func, limit) {
    let inThrottle, lastRan;
    return function () {
        const context = this;
        const args = arguments;
        if (!lastRan || Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
        }
    };
}

function updateScrollIndicator() {
    if (!isClickScroll) {
        scrollDots.forEach(dot => {
            const section = dot.dataset.section;
            if ((section === 'splash' && splashBool) ||
                (section === 'zoom' && zoomBool) ||
                (section === 'pitch' && pitchBool) ||
                (section === 'product' && productBool)) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
}

// Scroll navigator
scrollDots.forEach(dot => {
    const clickHandler = () => {
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
                targetPosition = targetElement.offsetTop + 20;
            }
            smoothScrollTo(targetPosition);
        } else {
            console.error(`Target section "${section}" not found.`);
        }
    };

    cleanupManager.addListener(dot, 'click', clickHandler);
});

let cachedZoomHeight = window.innerHeight; // Default fallback
let cachedViewportHeight = window.innerHeight;

// Add this after DOM element declarations at the bottom
if (zoomArea) {
    cachedZoomHeight = zoomArea.offsetHeight;
    window.addEventListener('resize', () => {
        cachedZoomHeight = zoomArea.offsetHeight;
        cachedViewportHeight = window.innerHeight;
    }, { passive: true });
}

// Add these near the top with other state variables
let lastZoomUpdate = 0;
let cachedZoomSection = -1;
const ZOOM_UPDATE_INTERVAL = isMobile ? 100 : 30; // ms between updates