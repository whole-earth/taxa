import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { state } from './anim.js';
import { cleanupManager } from '../utils/dispose.js';
import { MOBILIZE_GREEN, DESKTOP_BLUE, MOBILE_BLUE } from '../utils/materials.js';

const isMobile = window.innerWidth < 768;

const green = new THREE.Color('#92cb86');
const orange = new THREE.Color('#ffbb65');
const yellow = new THREE.Color('#f1ff00');

// Declare 'product' at the top level
let product = null;

// =====================================================================================

function scrollLogic(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {
    // Early return if essential objects are missing
    if (!controls || !camera) return;

    // If we're preventing scroll and trying to enter product area, stop here
    if (isPreventingScroll && isVisibleBetweenTopAndBottom(productArea)) {
        return;
    }

    splashBool = isVisibleBetweenTopAndBottom(splashArea);
    zoomBool = isVisibleBetweenTopAndBottom(zoomArea);
    pitchBool = isVisibleBetweenTopAndBottom(pitchArea);
    productBool = isVisibleBetweenTopAndBottom(productArea);
    updateScrollIndicator();

    // Get speckleSystem from state
    const speckleSystem = state.app?.speckleSystem;
    if (!speckleSystem) return;

    // Add explicit product visibility check at the start
    if (product && !productBool) {
        // If we're not in the product section, ensure product is hidden
        batchUpdateVisibility(product, false);
        if (state.applicatorObject) {
            state.applicatorObject.visible = false;
        }
    }

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

    if (splashBool && cellObject?.scale) {
        splashProgress = scrollProgress(splashArea);
        const scale = smoothLerp(1, 1.6, splashProgress);
        cellObject.scale.setScalar(scale);

        if (!splashCurrent) {
            if (cellObject && !cellObject.visible) {
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
                    cleanupManager.reinstateSpeckles(speckleSystem);
                    speckleSystem.tweenOpacity(1, duration);
                }

                cellSheenTween(blobInner);

                if (cellObject && !cellObject.visible) {
                    cellObject.visible = true;
                }

                // Enhanced product cleanup when entering zoom section
                if (product) {
                    batchUpdateVisibility(product, false);
                    // Reset product transforms
                    product.position.set(0, 0, 0);
                    product.rotation.set(Math.PI / 2, 0, 0);
                    product.scale.setScalar(isMobile ? MOBILE_PRODUCT_SCALES.initial : DESKTOP_PRODUCT_SCALES.initial);

                    // Reset cached transform state
                    cachedProductTransform.lastScale = 0;
                    cachedProductTransform.position.set(0, 0, 0);
                    cachedProductTransform.rotation.set(Math.PI / 2, 0, 0);
                    cachedProductTransform.scale.set(1, 1, 1);
                }

                if (state.starField) state.starField.visible = false;

                pitchCurrent = false;
                pitchTextActivated = false;
            } else {
                speckleSystem.tweenOpacity(1, fadeInDuration);
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

                    // Handle explosion differently for mobile and desktop
                    if (window.innerWidth < 768) {
                        // Single explosion for mobile
                        speckleSystem.tweenExplosion(explosionDuration * 2.2, 0);
                        // Dispose dots after explosion
                        setTimeout(() => {
                            if (pitchCurrent) {
                                cleanupManager.disposeSpeckles(speckleSystem);
                            }
                        }, explosionDuration * 2.21);
                    } else {
                        // Multiple phased explosions for desktop
                        EXPLOSION_PHASES.forEach(phase => {
                            setTimeout(() => {
                                if (zoomThirdCurrent && !explodedGroups.has(phase.index)) {
                                    speckleSystem.tweenExplosion(explosionDuration * (1 - phase.threshold), phase.index);
                                    explodedGroups.add(phase.index);

                                    // Dispose dots after last explosion phase
                                    if (phase.index === EXPLOSION_PHASES[EXPLOSION_PHASES.length - 1].index) {
                                        setTimeout(() => {
                                            if (pitchCurrent) {
                                                cleanupManager.disposeSpeckles(speckleSystem);
                                            }
                                        }, explosionDuration * (1 - phase.threshold));
                                    }
                                }
                            }, explosionDuration * phase.threshold);
                        });
                    }

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
            handleProductLoading();

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

        if (productProgress > 0.6 && !cleanupManager.disposedCellAndStarfield) {
            cleanupManager.disposeCellAndStarfield(cellObject, state.starField);
        } else if (productProgress <= 0.6 && cleanupManager.disposedCellAndStarfield) {
            cleanupManager.reinstateCellAndStarfield(cellObject, state.starField);
            if (cellObject) {
                cellObject.visible = true;
            }
        }

        if (product && product.children) {
            // ===== PHASE 1: Initial Transition (0 to 0.7) =====
            if (productProgress <= 0.7) {
                if (productProgress > 0.22 && !navClearFlag && navElement) {
                    navElement.classList.add('clear');
                    navClearFlag = true;
                    controls.autoRotate = false;
                    controls.enableRotate = false;
                    RotationManager.scrollMultiplierEnabled = false;
                } else if (productProgress <= 0.22 && navClearFlag && navElement) {
                    navElement.classList.remove('clear');
                    navClearFlag = false;
                    controls.autoRotate = true;
                    controls.enableRotate = true;
                    controls.autoRotateSpeed = 0.4;
                    RotationManager.scrollMultiplierEnabled = true;
                }

                if (!productPhase1Active) {
                    resetProductVisibility(product, state.applicatorObject);
                    if (cellObject) {
                        cellObject.visible = true;
                    }

                    // Restore product rotation and position when coming from phase 2
                    if (productPhase2Active) {
                        product.rotation.set(Math.PI / 2, 0, 0);
                        product.position.set(0, 0, 0);
                        const productScale = isMobile ? 18 : 20;
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
                    const materialsToUpdate = [];
                    product.traverse(child => {
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                mat.transparent = true;
                                mat.depthWrite = true;
                                mat.depthTest = true;
                                materialsToUpdate.push(mat);
                            });
                        }

                        if (child.name === 'outer-cap' && child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                if (mat.ior != 200) {
                                    mat.ior = 200;
                                    materialsToUpdate.push(mat);
                                }
                            });
                        }
                    });

                    // Batch update needsUpdate
                    materialsToUpdate.forEach(mat => {
                        mat.needsUpdate = true;
                    });

                    if (state.sceneManager?.directionalLight) {
                        const { directionalLight } = state.sceneManager;
                        directionalLight.visible = false;
                        directionalLight.intensity = 0;
                    }

                    productPhase2Active = false;
                    productPhase3Active = false;
                    productPhase1aActive = false;
                    productPhase1Active = true;
                }

                if (state.starField) {
                    state.starField.visible = true;
                    state.starField.updateProgress(productProgress * 1.66, productBool && productProgress <= 0.7);
                }

                const cellScale = smoothLerp(1.6, productSection__cellEndScale, productProgress / 0.7);
                cellObject.scale.setScalar(cellScale);


                // hide text
                if (productProgress > 0.4) {
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

                            state.applicatorObject.rotation.y = 0;
                            state.applicatorObject.position.y = 1;

                            const applicatorMaterialsToUpdate = [];
                            state.applicatorObject.traverse(child => {
                                child.visible = true;
                                if (child.material) {
                                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                                    materials.forEach(mat => {
                                        mat.visible = true;
                                        mat.opacity = 1;
                                        applicatorMaterialsToUpdate.push(mat);
                                    });
                                }
                            });

                            // Batch update needsUpdate for applicator materials
                            applicatorMaterialsToUpdate.forEach(mat => {
                                mat.needsUpdate = true;
                            });
                        }
                        productPhase1aActive = true;
                        lightingTransitionComplete = false;
                    }

                    const fadeProgress = (productProgress - 0.3) / 0.4;

                    // Fade in specific product elements
                    const productMaterialsToUpdate = [];
                    product.traverse(child => {
                        if (child.name === 'peel' || child.parent?.name === 'peel' ||
                            child.name === 'inner-cap' || child.parent?.name === 'inner-cap') {
                            if (child.material) {
                                const materials = Array.isArray(child.material) ? child.material : [child.material];
                                materials.forEach(mat => {
                                    mat.opacity = smoothLerp(0, 1, (fadeProgress - 0.5) * 2);
                                    productMaterialsToUpdate.push(mat);
                                });
                            }
                        }
                    });

                    // Batch update needsUpdate for product materials
                    productMaterialsToUpdate.forEach(mat => {
                        mat.needsUpdate = true;
                    });

                    renderer.toneMappingExposure = smoothLerp(1, 0.6, fadeProgress);

                    // Use a consistent easing function for smooth transitions
                    const easingFunction = Easing.Cubic.InOut;

                    // Update product scale with consistent easing
                    const productScale = isMobile
                        ? smoothLerp(18, 4.8, fadeProgress, easingFunction)  // Mobile
                        : smoothLerp(20, 4, fadeProgress, easingFunction);  // Desktop
                    product.scale.setScalar(productScale);

                    // Ensure smooth transition between phases with consistent easing
                    if (productProgress > 0.7 && productProgress <= 0.9) {
                        const rotationProgress = (productProgress - 0.7) / 0.2;
                        const scaleTransition = smoothLerp(productScale, 5.5, rotationProgress, easingFunction);
                        product.scale.setScalar(scaleTransition);
                    } else if (productProgress > 0.9) {
                        const finalScale = isMobile ? 5.2 : 5.5;
                        product.scale.setScalar(finalScale);
                    }

                    if (fadeProgress >= 1) {
                        lightingTransitionComplete = true;
                    }
                }
            }
            // ===== PHASE 2: Product Rotation (0.7 to 0.9) =====
            else if (0.7 <= productProgress && productProgress <= 0.9) {
                if (!productPhase2Active) {
                    cellObject.visible = false;
                    if (state.starField) state.starField.visible = false;

                    controls.autoRotate = false;
                    controls.enableRotate = false;

                    const scrollIndicator = document.querySelector('.scroll-indicator');
                    if (scrollIndicator && scrollIndicator.classList.contains('hidden')) {
                        scrollIndicator.classList.remove('hidden');
                    }

                    // Set initial scale based on whether we're coming from Phase 3 or Phase 1
                    if (isMobile) {
                        const targetScale = productPhase3Active ? MOBILE_PRODUCT_SCALES.final : MOBILE_PRODUCT_SCALES.transition;
                        product.scale.setScalar(targetScale);
                    } else if (!isMobile) {
                        product.scale.setScalar(4);
                    }

                    if (state.applicatorObject) {
                        state.applicatorObject.position.y = 1;
                        state.applicatorObject.rotation.y = 0;
                    }

                    const overflowMaterialsToUpdate = [];
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
                                overflowMaterialsToUpdate.push(mat);
                            });
                        }
                        if (child.name === 'outer-cap' && child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                if (mat.ior != 1.5) {
                                    mat.ior = 1.5;
                                    overflowMaterialsToUpdate.push(mat);
                                }
                            });
                        }
                    });

                    // Batch update needsUpdate for overflow materials
                    overflowMaterialsToUpdate.forEach(mat => {
                        mat.needsUpdate = true;
                    });

                    if (state.sceneManager?.directionalLight) {
                        const { directionalLight } = state.sceneManager;
                        directionalLight.visible = true;
                    }

                    productPhase2Active = true;
                    productPhase1Active = false;
                    productPhase3Active = false;
                }

                const rotationProgress = (productProgress - 0.7) / 0.2;

                renderer.toneMappingExposure = smoothLerp(0.6, 0.36, rotationProgress);

                // Handle product movement
                if (isMobile) {
                    // MOBILE 2a+b
                    const currentTime = performance.now();
                    if (currentTime - lastProductRotationUpdate >= PRODUCT_ROTATION_THROTTLE) {
                        if (lastProductAnimationFrame) {
                            cancelAnimationFrame(lastProductAnimationFrame);
                        }

                        lastProductAnimationFrame = requestAnimationFrame(() => {
                            const rotationProgress = (productProgress - 0.7) / 0.2;

                            // Cache all transform calculations
                            cachedProductTransform.rotation.set(
                                smoothLerp(Math.PI / 2, Math.PI / 7, rotationProgress),
                                smoothLerp(0, Math.PI / 5, rotationProgress),
                                smoothLerp(0, -Math.PI / 6, rotationProgress)
                            );

                            cachedProductTransform.position.set(
                                smoothLerp(0, -3, rotationProgress),
                                smoothLerp(0, 5.4, rotationProgress),
                                0
                            );

                            // Calculate target scale without damping
                            const targetScale = smoothLerp(MOBILE_PRODUCT_SCALES.transition, MOBILE_PRODUCT_SCALES.final, rotationProgress);
                            cachedProductTransform.scale.setScalar(targetScale);

                            // Batch transform updates
                            product.rotation.copy(cachedProductTransform.rotation);
                            product.position.copy(cachedProductTransform.position);
                            product.scale.copy(cachedProductTransform.scale);

                            lastProductRotationUpdate = currentTime;
                        });

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
                        ? (productProgress >= 0.85 ? (productProgress - 0.85) / 0.05 : 0)
                        : (rotationProgress > 0.5 ? (rotationProgress - 0.5) / 0.5 : 0);

                    directionalLight.intensity = smoothLerp(0, 8, lightProgress);
                    ambientLight.intensity = smoothLerp(4.6, 3.2, lightProgress);
                }
            }

            // ===== PHASE 3: Applicator Animation (0.9 to 1.0) =====
            else if (productProgress >= 0.9) {
                if (!productPhase3Active) {
                    renderer.toneMappingExposure = 0.36;
                    ambientLight.intensity = 3.2;
                    lightingTransitionComplete = true;

                    if (productPhase2Active) {
                        productPhase2Active = false;
                        productPhase1aActive = false;

                        // Only hide scroll indicator if not coming from click navigation
                        const scrollIndicator = document.querySelector('.scroll-indicator');
                        if (scrollIndicator && !scrollIndicator.classList.contains('hidden') && !isClickScroll) {
                            scrollIndicator.classList.add('hidden');
                        }
                    }

                    // Ensure we maintain the correct scale when entering phase 3
                    if (isMobile) {
                        product.scale.setScalar(MOBILE_PRODUCT_SCALES.final);
                    }

                    productPhase3Active = true;
                    productTextActivated = false;
                }

                // Keep directional light at full intensity during applicator animation
                if (state.sceneManager?.directionalLight) {
                    state.sceneManager.directionalLight.intensity = 8;
                }

                if (state.applicatorObject) {
                    // 3a. Applicator Position (0.9 to 0.95)
                    if (productProgress <= 0.95) {
                        const positionProgress = (productProgress - 0.9) / 0.05;
                        state.applicatorObject.position.y = smoothLerp(1, 0, positionProgress);

                        // Ensure smooth scale transition when scrolling up
                        if (isMobile) {
                            const scaleProgress = 1 - ((0.95 - productProgress) / 0.05);
                            product.scale.setScalar(smoothLerp(MOBILE_PRODUCT_SCALES.final, MOBILE_PRODUCT_SCALES.final, scaleProgress));
                        }
                    }
                    // 3b. Applicator Rotation (0.95 to 1.0)
                    else {
                        if (!productTextActivated) {
                            activateText(productArea);
                            productTextActivated = true;
                        }
                        const rotationProgress = (productProgress - 0.95) / 0.05;
                        state.applicatorObject.rotation.y = smoothLerp(0, Math.PI * 0.26, rotationProgress);

                        // Maintain final scale through the rotation
                        if (isMobile) {
                            product.scale.setScalar(MOBILE_PRODUCT_SCALES.final);
                        }
                    }
                }

                // Handle text activation when progress is past 0.95
                if (productProgress > 0.95 && !productTextActivated) {
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
        //console.log(`🔄 Section changed from ${previousSection} to ${newSection}`);

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
const productSection__cellEndScale = isMobile ? 0.05 : 0.016;

let splashBool, zoomBool, pitchBool, productBool;
let splashProgress, zoomProgress, productProgress;

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

// Cache scale values
const MOBILE_PRODUCT_SCALES = {
    initial: 26,
    transition: 4.8,
    final: 5.2
};

const DESKTOP_PRODUCT_SCALES = {
    initial: 20,
    transition: 4,
    final: 5.5
};

// Add these variables at the top with other state variables
let lastProductAnimationFrame;
let lastProductRotationUpdate = 0;
const PRODUCT_ROTATION_THROTTLE = 16.67; // ~60fps
let cachedProductTransform = {
    rotation: new THREE.Euler(),
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    lastScale: MOBILE_PRODUCT_SCALES.transition // Initialize with transition scale
};

// Single source of truth for rotation state
const RotationManager = {
    baseRotationSpeed: 0.4,
    currentMultiplier: 0,
    isDecelerating: false,
    rafId: null,
    scrollMultiplierEnabled: true,
    lastRotationTime: 0,
    isTransitioning: false,

    config: {
        mobile: {
            duration: 800,
            smoothing: 0.95,
            upScrollMultiplier: 0.06,
            downScrollMultiplier: 0.1,
            upDecayRate: 4,
            downDecayRate: 2,
            transitionDuration: 500
        },
        desktop: {
            duration: 100,
            smoothing: 0.8,
            upScrollMultiplier: 0.12,
            downScrollMultiplier: 0.2,
            upDecayRate: 4,
            downDecayRate: 2,
            transitionDuration: 300
        }
    },

    updateFromScroll(scrollDiff, delta) {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Don't update rotation during transitions
        if (this.isTransitioning) return this.baseRotationSpeed;

        const isMobile = window.innerWidth < 768;
        const config = isMobile ? this.config.mobile : this.config.desktop;

        // Throttle updates to maintain smooth rotation
        const now = performance.now();
        if (now - this.lastRotationTime < 16) { // ~60fps
            return this.baseRotationSpeed + this.currentMultiplier;
        }
        this.lastRotationTime = now;

        // Choose multiplier based on scroll direction
        const multiplier = delta > 0
            ? config.downScrollMultiplier
            : config.upScrollMultiplier;

        // Calculate additive multiplier from scroll with smoother interpolation
        const scrollMultiplier = this.scrollMultiplierEnabled
            ? (delta / Math.abs(delta)) * (scrollDiff * multiplier)
            : 0;

        // Smooth the transition of the multiplier
        this.currentMultiplier += (scrollMultiplier - this.currentMultiplier) * (1 - config.smoothing);

        this.isDecelerating = false;

        return this.baseRotationSpeed + this.currentMultiplier;
    },

    startDeceleration(controls) {
        if (this.isDecelerating || this.isTransitioning) return;

        this.isDecelerating = true;
        const isMobile = window.innerWidth < 768;
        const config = isMobile ? this.config.mobile : this.config.desktop;
        const startMultiplier = this.currentMultiplier;
        const startTime = performance.now();

        const decayRate = startMultiplier > 0 ? config.downDecayRate : config.upDecayRate;

        const decelerate = () => {
            if (this.isTransitioning) {
                this.isDecelerating = false;
                this.rafId = null;
                return;
            }

            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / config.duration, 1);

            const decay = Math.exp(-decayRate * progress);
            this.currentMultiplier = startMultiplier * decay;

            controls.autoRotateSpeed = this.baseRotationSpeed + this.currentMultiplier;

            if (Math.abs(this.currentMultiplier) > 0.01 && !this.isTransitioning) {
                this.rafId = requestAnimationFrame(decelerate);
            } else {
                this.isDecelerating = false;
                this.currentMultiplier = 0;
                controls.autoRotateSpeed = this.baseRotationSpeed;
                this.rafId = null;
            }
        };

        this.rafId = requestAnimationFrame(decelerate);
    },

    startTransition() {
        this.isTransitioning = true;
        const isMobile = window.innerWidth < 768;
        const config = isMobile ? this.config.mobile : this.config.desktop;
        
        setTimeout(() => {
            this.isTransitioning = false;
        }, config.transitionDuration);
    }
};

// Modify animatePage to use the manager
export function animatePage(controls, camera, cellObject, blobInner, blobOuter, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {
    // Don't process scroll events while preventing scroll
    if (isPreventingScroll) return;
    
    let scrollY = window.scrollY;
    let delta = scrollY - state.lastScrollY;
    let scrollDiff = Math.abs(delta);

    // Enable auto-rotation
    controls.autoRotate = true;

    if (scrollDiff > 0) {
        // Active scrolling - update speed
        controls.autoRotateSpeed = RotationManager.updateFromScroll(scrollDiff, delta);
    } else if (!RotationManager.isDecelerating) {
        // Start deceleration when scrolling stops
        RotationManager.startDeceleration(controls);
    }

    const throttleDuration = isMobile ? 200 : 100;
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
            const isProduct = section === 'product';
            return elem && (isProduct ? elem.offsetTop + elem.offsetHeight === targetPosition : elem.offsetTop === targetPosition);
        });

        const currentIndex = sections.indexOf(currentSection);
        const targetIndex = sections.indexOf(targetSection);
        const numberOfSections = Math.abs(targetIndex - currentIndex);

        // Get current scroll position and calculate actual distance
        const currentPosition = window.scrollY;
        const scrollDistance = Math.max(0, -rect.top);
        const viewportHeight = window.innerHeight;

        // Base duration on scroll distance for longer sections
        let duration;
        if (targetSection === 'product' && currentIndex < targetIndex) {
            // Scrolling to product section - adjust duration based on distance
            duration = isMobile ?
                Math.min(4.0, 2.2 + (scrollDistance / viewportHeight) * 1.8) :
                Math.min(5.0, 1.2 + (scrollDistance / viewportHeight) * 1.2);
        } else {
            // Normal section transitions
            duration = (
                numberOfSections === 1 ? (isMobile ? 1.0 : 1.2) :
                    numberOfSections === 2 ? (isMobile ? 2.2 : 2.8) :
                        numberOfSections >= 3 ? (isMobile ? 3.2 : 3.6) : 0
            );
        }

        // Disable pointer events before scroll
        document.body.style.pointerEvents = 'none';

        state.lenis.scrollTo(targetPosition, {
            duration: duration,
            easing: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            lock: true,
            force: isMobile,
            onComplete: () => {
                setTimeout(() => {
                    document.body.style.pointerEvents = '';
                    isClickScroll = false;
                    // If we're in the product section and came from click, keep indicator visible
                    if (productBool) {
                        const scrollIndicator = document.querySelector('.scroll-indicator');
                        if (scrollIndicator && scrollIndicator.classList.contains('hidden')) {
                            scrollIndicator.classList.remove('hidden');
                        }
                    }
                }, 100);
            }
        });
    } else {
        // Disable pointer events before scroll
        document.body.style.pointerEvents = 'none';

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });

        // Re-enable pointer events after scroll animation
        setTimeout(() => {
            document.body.style.pointerEvents = '';
            isClickScroll = false;
            // If we're in the product section and came from click, keep indicator visible
            if (productBool) {
                const scrollIndicator = document.querySelector('.scroll-indicator');
                if (scrollIndicator && scrollIndicator.classList.contains('hidden')) {
                    scrollIndicator.classList.remove('hidden');
                }
            }
        }, 1000); // Fallback duration for regular smooth scroll
    }
}

const scrollHandler = () => {
    if (indicatorRAF) {
        cancelAnimationFrame(indicatorRAF);
    }
    indicatorRAF = requestAnimationFrame(updateScrollIndicator);
};

window.removeEventListener('scroll', scrollHandler);

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
    if (lastProductAnimationFrame) {
        cancelAnimationFrame(lastProductAnimationFrame);
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

let lastZoomUpdate = 0;
let cachedZoomSection = -1;
const ZOOM_UPDATE_INTERVAL = isMobile ? 100 : 30; // ms between updates

// Preload product assets to reduce initial load time
function preloadProductAssets() {
    if (!state.productAssetsPreloaded) {
        state.app.loadProductOnDemand().then(loadedProduct => {
            // Cache the loaded product for later use
            state.preloadedProduct = loadedProduct;
            state.productAssetsPreloaded = true;
        });
    }
}

// Call preloadProductAssets when the page loads or when the user is in a section just before the product section
window.addEventListener('load', preloadProductAssets);

// Use progressive rendering for the product
function setupProductForSection(product, applicatorObject) {
    if (!product) return;

    // Setup initial state before making visible
    product.rotation.x = Math.PI / 2;
    product.rotation.z = 0;
    const productScale = isMobile ? MOBILE_PRODUCT_SCALES.initial : DESKTOP_PRODUCT_SCALES.initial;
    product.scale.set(productScale, productScale, productScale);

    if (applicatorObject) {
        applicatorObject.position.y = 1;
        applicatorObject.rotation.y = 0;
    }

    // Reset cached transform state
    cachedProductTransform.lastScale = productScale;
    cachedProductTransform.position.set(0, 0, 0);
    cachedProductTransform.rotation.set(Math.PI / 2, 0, 0);
    cachedProductTransform.scale.set(productScale, productScale, productScale);

    // Start with a low-resolution version
    product.traverse(child => {
        if (child.material) {
            child.material.wireframe = true; // Start with wireframe for faster rendering
        }
    });

    // Now that everything is set up, make product visible
    product.visible = true;
    resetProductVisibility(product, applicatorObject);

    // Gradually enhance the product rendering
    setTimeout(() => {
        product.traverse(child => {
            if (child.material) {
                child.material.wireframe = false; // Switch to full rendering
                child.material.needsUpdate = true;
            }
        });
    }, 500); // Adjust the delay as needed
}

// Track if we're currently preventing scroll
let isPreventingScroll = false;

// Function to update loading progress
function updateLoadingProgress(progress) {
    const progressElement = document.querySelector('.product-loading-progress');
    if (progressElement) {
        progressElement.textContent = `${Math.round(progress * 100)}%`;
    }
}

// Function to show/hide loading overlay with smooth transitions
function toggleLoadingOverlay(show) {
    const overlay = document.querySelector('.product-loading-overlay');
    if (overlay) {
        if (show) {
            // Store the current scroll position and animation state
            const scrollY = window.scrollY;
            const currentRotationSpeed = RotationManager.currentMultiplier;
            
            // Store additional section state
            overlay.dataset.wasInProduct = productBool;
            overlay.dataset.productProgress = productProgress;
            overlay.dataset.lastScrollY = scrollY;
            
            // Smoothly transition rotation speed back to base speed
            const startMultiplier = currentRotationSpeed;
            const startTime = performance.now();
            const duration = 400; // Duration in ms for the transition
            
            const easeRotation = () => {
                const now = performance.now();
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Use smooth easing function
                const easeProgress = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                // Interpolate multiplier back to 0
                RotationManager.currentMultiplier = startMultiplier * (1 - easeProgress);
                // Update the actual rotation speed
                state.sceneManager.controls.autoRotateSpeed = RotationManager.baseRotationSpeed + RotationManager.currentMultiplier;
                console.log('Rotation speed:', state.sceneManager.controls.autoRotateSpeed.toFixed(4));
                
                if (progress < 1) {
                    requestAnimationFrame(easeRotation);
                }
            };
            
            requestAnimationFrame(easeRotation);
            
            // Show overlay
            overlay.classList.add('active');
            document.body.classList.add('scroll-disabled');
            
            // Prevent scroll jumping while maintaining position
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.left = '0';
            
            // Store states for restoration
            overlay.dataset.scrollY = scrollY;
            overlay.dataset.rotationSpeed = currentRotationSpeed;
            
            isPreventingScroll = true;
        } else {
            // Get the stored animation state
            const storedRotationSpeed = parseFloat(overlay.dataset.rotationSpeed || '0');
            const wasInProduct = overlay.dataset.wasInProduct === 'true';
            
            // Remove overlay and scroll lock
            overlay.classList.remove('active');
            document.body.classList.remove('scroll-disabled');
            
            // Important: Reset all body styles that were locking scroll
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.left = '';
            document.body.style.overflow = '';
            
            if (wasInProduct) {
                const productArea = document.querySelector('.product');
                if (productArea) {
                    // Calculate the position where productProgress would be 0
                    const productTop = productArea.offsetTop;
                    const viewportHeight = window.innerHeight;
                    
                    // Set scroll position to the start of the product section
                    window.scrollTo(0, productTop);
                    
                    // Update state variables
                    state.lastScrollY = productTop;
                    splashBool = false;
                    zoomBool = false;
                    pitchBool = false;
                    productBool = true;
                    splashCurrent = false;
                    zoomCurrent = false;
                    pitchCurrent = false;
                    productCurrent = true;
                    
                    // Reset product-specific states
                    productPhase1Active = false;
                    productPhase1aActive = false;
                    productPhase2Active = false;
                    productPhase3Active = false;
                    
                    // Force immediate state update
                    requestAnimationFrame(() => {
                        scrollLogic(
                            state.sceneManager.controls,
                            state.sceneManager.camera,
                            state.cellObject,
                            state.blobInner,
                            state.blobOuter,
                            state.ribbons,
                            state.spheres,
                            state.wavingBlob,
                            state.dotBounds,
                            product,
                            state.sceneManager.renderer,
                            state.sceneManager.ambientLight
                        );
                        
                        // Re-enable scroll processing
                        isPreventingScroll = false;
                    });
                }
            }
            
            // Re-enable scroll immediately if not in product section
            if (!wasInProduct) {
                isPreventingScroll = false;
            }
            
            // Restore rotation speed
            if (storedRotationSpeed !== 0) {
                RotationManager.currentMultiplier = storedRotationSpeed;
                requestAnimationFrame(() => {
                    RotationManager.startDeceleration(state.sceneManager.controls);
                });
            }
        }
    }
}

// Function to check if we should start loading the product
function shouldPreloadProduct() {
    const productArea = document.querySelector('.product');
    if (!productArea) return false;

    const rect = productArea.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Start loading when product area is within 2 viewport heights
    return rect.top <= viewportHeight * 2;
}

// Add scroll listener for preloading
window.addEventListener('scroll', () => {
    if (!state.productAssetsPreloaded && shouldPreloadProduct()) {
        preloadProductAssets();
    }
}, { passive: true });

// Modify handleProductLoading function
function handleProductLoading() {
    // If we're already in a loading state, don't trigger another load
    if (isPreventingScroll) return;

    if (!product) {
        if (state.preloadedProduct) {
            // Product was preloaded, use it directly without showing overlay
            product = state.preloadedProduct;
            requestAnimationFrame(() => {
                setupProductForSection(product, state.applicatorObject);
            });
        } else {
            // Only show loading overlay if we're in the product section and need to load
            if (productBool) {
                toggleLoadingOverlay(true);
            }
            
            state.app.loadProductOnDemand().then(loadedProduct => {
                product = loadedProduct;
                
                requestAnimationFrame(() => {
                    if (productBool) {
                        setupProductForSection(product, state.applicatorObject);
                        setTimeout(() => {
                            toggleLoadingOverlay(false);
                        }, 100);
                    } else {
                        batchUpdateVisibility(product, false);
                    }
                });
            }).catch(error => {
                console.error('Failed to load product:', error);
                toggleLoadingOverlay(false);
            });
        }
    } else {
        // Product already exists, just set it up without showing overlay
        requestAnimationFrame(() => {
            setupProductForSection(product, state.applicatorObject);
        });
    }
}

// Debounce visibility changes to reduce computational load
const debounceVisibilityChange = (product, visible) => {
    if (product.visibilityTimeout) {
        clearTimeout(product.visibilityTimeout);
    }
    product.visibilityTimeout = setTimeout(() => {
        product.visible = visible;
        product.traverse(child => {
            if (child.material) {
                child.visible = visible;
            }
        });
    }, 50); // Adjust the delay as needed
};

// Use requestAnimationFrame to batch updates
const batchUpdateVisibility = (product, visible) => {
    requestAnimationFrame(() => {
        debounceVisibilityChange(product, visible);
    });
};