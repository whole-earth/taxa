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

// TODO pick and confirm color
const blobMembraneColor = new THREE.Color('#f1ff00');

const green = new THREE.Color('#92cb86');
const orange = new THREE.Color('#ff8e00');
const yellow = new THREE.Color('#f1ff00');
const scrollDots = document.querySelectorAll('.scroll-dot');

const fadeInDuration = 500;
const fadeOutDuration = 180;

// Pre-calculate explosion thresholds
const EXPLOSION_PHASES = [
    { threshold: 0.20, index: 0 },
    { threshold: 0.45, index: 1 },
    { threshold: 0.65, index: 2 },
    { threshold: 0.85, index: 3 },
    { threshold: 0.95, index: 4 }
];

let explodedGroups = new Set(); // Track which groups have exploded
let dotGroupsCache = null; // Cache for dot groups

// ============================

function scrollLogic(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {

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
            restoreDotScale(wavingBlob);

            // Reset pitch effect when scrolling back to zoom area - only if not already reset
            if (pitchEffectActive && wavingBlob) {
                const blobState = { 
                    opacity: wavingBlob.material.opacity, 
                    r: wavingBlob.material.color.r, 
                    g: wavingBlob.material.color.g, 
                    b: wavingBlob.material.color.b 
                };
                
                const resetTween = new Tween(blobState)
                    .to({ opacity: 0, r: orange.r, g: orange.g, b: orange.b }, fadeOutDuration)
                    .easing(Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        wavingBlob.material.opacity = blobState.opacity;
                        wavingBlob.material.color.setRGB(blobState.r, blobState.g, blobState.b);
                        wavingBlob.material.needsUpdate = true;
                    })
                    .onComplete(() => {
                        state.blobTweenGroup.remove(resetTween);
                    });

                state.blobTweenGroup.add(resetTween);
                resetTween.start();
                pitchEffectActive = false;
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
        
            // fade out wavingBlob
            if (wavingBlob.material.opacity != 0) {
                const tween = new Tween(wavingBlob.material)
                    .to({ opacity: 0 }, 1000)
                    .easing(Easing.Quadratic.InOut)
                    .onComplete(() => {
                        state.blobTweenGroup.remove(tween);
                    });
                
                state.blobTweenGroup.add(tween);
                tween.start();
            }

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
            
            // Add pitch effect if not already active - moved here to sync with activateText
            if (!pitchEffectActive && wavingBlob) {
                const blobState = { 
                    opacity: wavingBlob.material.opacity, 
                    r: wavingBlob.material.color.r, 
                    g: wavingBlob.material.color.g, 
                    b: wavingBlob.material.color.b 
                };
                
                const pitchTween = new Tween(blobState)
                    .to({ opacity: 0.3, r: blobMembraneColor.r, g: blobMembraneColor.g, b: blobMembraneColor.b }, fadeInDuration*2)
                    .easing(Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        wavingBlob.material.opacity = blobState.opacity;
                        wavingBlob.material.color.setRGB(blobState.r, blobState.g, blobState.b);
                        wavingBlob.material.needsUpdate = true;
                    })
                    .onComplete(() => {
                        state.blobTweenGroup.remove(pitchTween);
                    });

                state.blobTweenGroup.add(pitchTween);
                pitchTween.start();
                pitchEffectActive = true;
            }

            if (comingFrom == 'productArea') {
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

                cellObject.children.forEach(child => {
                    if (child.name != 'ribbons.glb') {
                        child.traverse(innerChild => {
                            if (innerChild.material) {
                                innerChild.material.transparent = (child.name != 'blob-inner.glb');
                                innerChild.material.opacity = 1;
                                innerChild.material.needsUpdate = true;
                            }
                        });
                    }
                });

                if (state.starField) {
                    state.starField.visible = false;
                }

                restoreDotScale(wavingBlob);
            } else if (comingFrom == 'zoomOutArea' && spheres[0].material.opacity > 0) {
                // only trigger explosion if dots are visible
                dotsTweenExplosion(wavingBlob, 600, 80);
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
            
            // Reset product rotation and position
            if (product) {
                product.rotation.x = Math.PI / 2;
                product.rotation.z = 0;
                const productScale = 20;
                product.scale.set(productScale, productScale, productScale);
            }
            
            if (state.applicatorObject) {
                state.applicatorObject.position.y = 1;
                state.applicatorObject.rotation.y = 0;
            }

            // Hide cell object and dots for better performance
            cellObject.visible = false;
            wavingBlob.children.forEach(group => {
                if (group.isGroup) group.visible = false;
            });
            state.blobTweenGroup.removeAll();
            state.dotTweenGroup.removeAll();
            restoreDotScale(wavingBlob);

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
            comingFrom = 'productArea';
        }

        if (product && product.children) {
            productProgress = scrollProgress__LastElem(productArea);

            // Handle text activation when progress is past 0.95
            if (productProgress > 0.95 && !productTextActivated) {
                activateText(productArea, false);
                productTextActivated = true;
            }

            // ===== PHASE 1: Initial Transition (0 to 0.5) =====
            if (productProgress <= 0.5) {
                // Reset the flag in phase 1
                if (!productPhase1Active) {
                    resetProductVisibility(product, state.applicatorObject);
                    cellObject.visible = true;

                    productPhase2Active = false;
                    productPhase3Active = false;
                    productPhase1aActive = false; // overwritten if (productProgress > 0.25) condition is met
                    productPhase1Active = true;
                }

                if (state.starField) {
                    state.starField.visible = true;
                    state.starField.updateProgress(productProgress * 2);
                }

                const cellScale = smoothLerp(1, 0.06, productProgress / 0.4);
                cellObject.scale.set(cellScale, cellScale, cellScale);
                // Scale wavingBlob along with the cell
                if (wavingBlob) {
                    wavingBlob.scale.set(cellScale, cellScale, cellScale);
                }

                if (productProgress > 0.25) {
                    if (!productPhase1aActive) {
                        textChildren.forEach(child => {
                            if (child.classList.contains('active')) {
                                child.classList.remove('active');
                            }
                        });
                        if (state.applicatorObject) {
                            product.traverse(child => {
                                child.visible = true;
                            });
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
                    }

                    const fadeProgress = (productProgress - 0.25) / 0.25;

                    renderer.toneMappingExposure = smoothLerp(1, 0.35, fadeProgress);
                    ambientLight.intensity = smoothLerp(4, 4.6, fadeProgress);

                    cellObject.children.forEach(child => {
                        if (child.name != 'ribbons.glb') {
                            child.traverse(innerChild => {
                                if (innerChild.material) {
                                    innerChild.material.transparent = true;
                                    innerChild.material.opacity = smoothLerp(1, 0, fadeProgress);
                                    innerChild.material.needsUpdate = true;
                                }
                            });
                        }
                    });

                    // Fade wavingBlob opacity along with the cell, but only after fadeProgress > 0.5
                    if (wavingBlob && wavingBlob.material) {
                        if (fadeProgress > 0.5) {
                            // Remap fadeProgress from 0.5-1 range to 0-1 range for smooth fade
                            const remappedProgress = (fadeProgress - 0.5) / 0.5;
                            wavingBlob.material.opacity = smoothLerp(wavingBlob.material.opacity, 0, remappedProgress);
                            wavingBlob.material.needsUpdate = true;
                        }
                    }

                    const productScale = smoothLerp(20, 5, fadeProgress);
                    product.scale.set(productScale, productScale, productScale);

                }
            }
            // ===== PHASE 2: Product Rotation (0.5 to 0.8) =====
            else if (0.5 <= productProgress && productProgress <= 0.8) {
                // Hide cell object and starfield after transition
                if (!productPhase2Active) {
                    cellObject.visible = false;
                    if (state.starField) state.starField.visible = false;

                    product.traverse(child => {
                        if (child.name === 'overflowMask') {
                            child.visible = false;
                        } else {
                            child.visible = true;
                        }
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                mat.transparent = child.name === 'film-cover' || child.name === 'taxa-name';
                                mat.opacity = 1;
                                mat.needsUpdate = true;
                            });
                        }
                    });

                    productPhase2Active = true;
                    productPhase1Active = false;
                    productPhase3Active = false;
                }

                // 2a. X-axis rotation (0.5 to 0.8)
                const rotationProgress = (productProgress - 0.5) / 0.3;
                product.rotation.x = smoothLerp(Math.PI / 2, Math.PI / 15, rotationProgress);

                // 2b. Z-axis rotation (starts at 0.65)
                if (rotationProgress > 0.5) {
                    const zRotationProgress = (rotationProgress - 0.5) / 0.5;
                    product.rotation.z = smoothLerp(0, -Math.PI / 5, zRotationProgress);
                }
            }

            // ===== PHASE 3: Applicator Animation (0.8 to 1.0) =====
            else if (productProgress >= 0.8) {

                if (!productPhase3Active) {
                    if (productPhase2Active) {
                        productPhase2Active = false;
                        productPhase1aActive = false;
                    }
                    productPhase3Active = true;
                    productTextActivated = false;
                }

                if (state.applicatorObject) {
                    // 3a. Applicator Position (0.8 to 0.95)
                    if (productProgress <= 0.95) {
                        const positionProgress = (productProgress - 0.8) / 0.15;
                        state.applicatorObject.position.y = smoothLerp(1, 0, positionProgress);
                    }
                    // 3b. Applicator Rotation (0.95 to 1.0)
                    else {
                        if (!productTextActivated) {
                            activateText(productArea);
                            productTextActivated = true;
                        }
                        const rotationProgress = (productProgress - 0.95) / 0.05;
                        state.applicatorObject.rotation.y = smoothLerp(0, Math.PI * 0.4, rotationProgress);
                    }
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

let productTextActivated = false;

let isClickScroll = false;
let scrollTimeout;

// Add state tracking variable at the top with other state variables
let pitchEffectActive = false;

export function animatePage(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, scrollTimeout, renderer, ambientLight) {
    let scrollY = window.scrollY;
    let scrollDiff = scrollY - state.lastScrollY;
    const multiplier = Math.floor(scrollDiff / 20);
    controls.autoRotateSpeed = Math.min(1.0 + (multiplier * 10), 25);

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        controls.autoRotateSpeed = 0.2;
    }, 100);

    throttle(() => scrollLogic(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight), 40)();
    camera.updateProjectionMatrix();
    state.lastScrollY = scrollY;
};

function isVisibleBetweenTopAndBottom(element) {
    const rect = element.getBoundingClientRect();
    return rect.top <= 0 && rect.bottom > 0;
}

function scrollProgress(element) {
    const rect = element.getBoundingClientRect();
    const scrollableDistance = rect.height;
    const scrolledDistance = Math.max(0, -rect.top);
    const progress = Math.max(0, Math.min(1, scrolledDistance / scrollableDistance));
    return parseFloat(progress).toFixed(4); // here we truncate!
}

function scrollProgress__LastElem(element) {
    const rect = element.getBoundingClientRect();
    const scrollableDistance = rect.height - window.innerHeight;
    const scrolledDistance = Math.max(0, -rect.top);
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

function cellSheenTween(group, color = null) {
    state.blobTweenGroup.removeAll();
    if (!group) return;
    
    group.traverse(child => {
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
    // Initialize cache if not exists
    if (!dotGroupsCache) {
        dotGroupsCache = wavingBlob.children.filter(group => group.isGroup);
    }
    
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
            group.children.forEach(sphere => {
                sphere.material.opacity = Math.max(0, tweenState.opacity);
                sphere.material.needsUpdate = true;
            });
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
    // First, set everything invisible and transparent
    product.traverse(child => {
        child.visible = false;
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(mat => {
                mat.transparent = true;
                mat.opacity = 0;
                mat.needsUpdate = true;
            });
        }
        // Handle meshes without materials
        if (child.isMesh) {
            child.visible = false;
        }
    });

    // Then, selectively show only the applicator and overflowMask
    if (applicatorObject) {
        applicatorObject.traverse(child => {
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

    // Show overflowMask if it exists
    product.traverse(child => {
        if (child.name === 'overflowMask') {
            child.visible = true;
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    mat.opacity = 1;
                    mat.needsUpdate = true;
                });
            }
        }
    });
}

function restoreDotScale(wavingBlob) {
    wavingBlob.scale.set(1, 1, 1);
    wavingBlob.children.forEach(group => {
        if (group.isGroup) {
            group.scale.set(1, 1, 1);
        }
    });
}

// Add function to reset wavingBlob state
function resetWavingBlob(wavingBlob) {
    if (!wavingBlob) return;
    
    const blobState = { 
        opacity: wavingBlob.material.opacity, 
        r: wavingBlob.material.color.r, 
        g: wavingBlob.material.color.g, 
        b: wavingBlob.material.color.b 
    };
    
    const resetTween = new Tween(blobState)
        .to({ opacity: 0, r: orange.r, g: orange.g, b: orange.b }, fadeOutDuration)
        .easing(Easing.Quadratic.InOut)
        .onUpdate(() => {
            wavingBlob.material.opacity = blobState.opacity;
            wavingBlob.material.color.setRGB(blobState.r, blobState.g, blobState.b);
            wavingBlob.material.needsUpdate = true;
        })
        .onComplete(() => {
            state.blobTweenGroup.remove(resetTween);
            // Reset exploded groups tracking
            explodedGroups.clear();
            // Reset visibility of all groups
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
        });

    state.blobTweenGroup.add(resetTween);
    resetTween.start();
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
    const startPosition = window.scrollY;
    const sections = ['splash', 'zoom', 'pitch', 'product'];

    let currentSection = '';
    let targetSection = '';

    sections.forEach(section => {
        const elem = document.querySelector(`.${section}`);
        if (section === 'zoom') {
            const zoomOutElem = document.querySelector('.zoom-out');
            if ((elem && isVisibleBetweenTopAndBottom(elem)) ||
                (zoomOutElem && isVisibleBetweenTopAndBottom(zoomOutElem))) {
                currentSection = section;
            }
        } else if (elem && isVisibleBetweenTopAndBottom(elem)) {
            currentSection = section;
        }
    });


    sections.forEach(section => {
        const elem = document.querySelector(`.${section}`);
        // Special handling for the product section
        if (section === 'product') {
            const productElem = document.querySelector('.product');
            if (productElem && targetPosition >= productElem.offsetTop) {
                targetSection = 'product';
            }
        } else if (elem && elem.offsetTop === targetPosition) {
            targetSection = section;
        }
    });

    if (!currentSection && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight) {
        currentSection = 'product';
    }

    const currentIndex = sections.indexOf(currentSection);
    const targetIndex = sections.indexOf(targetSection);
    const numberOfSections = Math.abs(targetIndex - currentIndex);

    let duration;
    if (numberOfSections === 1) {
        duration = 1200;
    } else if (numberOfSections === 2) {
        duration = 2800;
    } else if (numberOfSections >= 3) {
        duration = 3600;
    } else {
        duration = 0;
    }

    let startTime = null;

    function animation(currentTime) {
        if (!startTime) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);

        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        window.scrollTo(0, startPosition + (targetPosition - startPosition) * ease);

        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        } else {
            isClickScroll = false;
        }
    }

    requestAnimationFrame(animation);
}

window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        updateScrollIndicator();
    }, 100);
});