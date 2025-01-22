import * as THREE from 'three';
import { Tween, Easing } from 'tween';
import { lastScrollY, setLastScrollY, ribbonTweenGroup, dotTweenGroup, blobTweenGroup, applicatorObject } from './anim.js';

const splashStartFOV = window.innerWidth < 768 ? 90 : 60;
const splashEndFOV = splashStartFOV * 0.55;
const zoomStartFOV = splashEndFOV;
const zoomEndFOV = splashEndFOV * 1.1;
const zoomOutStartFOV = zoomEndFOV;
const zoomOutEndFOV = splashStartFOV;
const pitchStartFOV = zoomOutEndFOV;
const pitchEndFOV = pitchStartFOV * 1.5;
//const productStartFOV = pitchEndFOV;
//const productEndFOV = productStartFOV;

const green = new THREE.Color('#92cb86');
const orange = new THREE.Color('#ff8e00');
const yellow = new THREE.Color('#f1ff00');
const scrollDots = document.querySelectorAll('.scroll-dot');

const fadeInDuration = 500;
const fadeOutDuration = 180;

// ============================

function scrollLogic(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight) {
    splashBool = isVisibleBetweenTopAndBottom(splashArea);
    zoomBool = isVisibleBetweenTopAndBottom(zoomArea);
    zoomOutBool = isVisibleBetweenTopAndBottom(zoomOutArea);
    pitchBool = isVisibleBetweenTopAndBottom(pitchArea);
    productBool = isVisibleBetweenTopAndBottom(productArea);

    // Add this line after the boolean checks
    updateScrollIndicator();

    if (splashBool) {
        splashProgress = scrollProgress(splashArea);
        camera.fov = smoothLerp(splashStartFOV, splashEndFOV, splashProgress);

        if (!splashCurrent) {
            activateText(splashArea);

            // Restore ribbons when scrolling back up to splash
            if (comingFrom == 'zoomAreaFirst' || comingFrom == 'zoomOutArea') {
                dotTweenOpacity(spheres, 1, 0, wavingBlob, fadeOutDuration);
                ribbonTweenOpacity(ribbons, 0, 1);
                cellSheenTween(blobInner);
            }

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
                    } else if (comingFrom == 'zoomOutArea') {

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
            comingFrom = 'zoomOutArea';
        }

    }
    else if (pitchBool) {
        pitchProgress = scrollProgress(pitchArea);
        camera.fov = smoothLerp(pitchStartFOV, pitchEndFOV, pitchProgress);

        if (!pitchCurrent) {
            activateText(pitchArea);
            if (comingFrom == 'productArea') {
                controls.autoRotate = true;
                controls.enableRotate = true;
                controls.autoRotateSpeed = 0.2;
                restoreDotScale(wavingBlob);
            } else if (comingFrom == 'zoomOutArea' && spheres[0].material.opacity > 0) {
                // only trigger explosion if dots are visible
                dotsTweenExplosion(wavingBlob, 600, 80);
            }

            // Hide product when entering pitch section
            if (product) {
                product.visible = false;
            }

            zoomOutCurrent = false;
            pitchCurrent = true;
            productCurrent = false;
            comingFrom = 'pitchArea';
        }
    }
    else if (productBool) {

        if (!productCurrent) {

            if (product) {
                product.visible = true; // opacity initializes to 0
                product.rotation.x = Math.PI / 2;
            }

            // terminate existing animations for product
            wavingBlob.children.forEach(group => {
                if (group.isGroup) {
                    group.visible = false;
                }
            });
            blobTweenGroup.removeAll();
            dotTweenGroup.removeAll();
            restoreDotScale(wavingBlob);

            pitchCurrent = false;
            productCurrent = true;
            productTextActivated = false;
            comingFrom = 'productArea';

        }

        if (product && product.children) {
            productProgress = scrollProgress__LastElem(productArea);

            // Parent if-statement for 0-50% progress
            if (productProgress <= 0.5) {

                // restore
                product.rotation.x = Math.PI / 2;
                product.rotation.z = 0;
                cellObject.visible = true;

                // First animation: Scale down cell (0-50%)
                const cellScale = smoothLerp(1, 0.3, productProgress / 0.5);
                cellObject.scale.set(cellScale, cellScale, cellScale);

                // Second animation: Product scale and fade (25-50%)
                if (0.25 < productProgress) {

                    // TODO: call this only once
                    textChildren.forEach(child => {
                        if (child.classList.contains('active')) {
                            child.classList.remove('active');
                        }
                    });

                    const normalizedProgress = (productProgress - 0.25) * 4;
                    const fastOpacityProgress = Math.min(1, normalizedProgress * 2); // Double the opacity rate

                    renderer.toneMappingExposure = smoothLerp(1, 0.35, normalizedProgress);
                    ambientLight.intensity = smoothLerp(4, 4.6, normalizedProgress);
                    
                    // Scale product from 8x to 3x
                    const productScale = smoothLerp(9, 5, normalizedProgress);
                    product.scale.set(productScale, productScale, productScale);

                    // Fade in product by traversing all its meshes
                    product.traverse(child => {
                        if (child.isMesh && child.material) {
                            //child.material.transparent = true;
                            //child.material.opacity = smoothLerp(0, 1, fastOpacityProgress);
                            //child.material.needsUpdate = true;
                        }
                    });

                    cellObject.children.forEach(child => {
                        // no fadeout for ribbons: already 0
                        if (child.name != 'ribbons.glb') {
                            child.traverse(innerChild => {
                                if (innerChild.material) {
                                    innerChild.material.transparent = true;
                                    innerChild.material.opacity = smoothLerp(1, 0, fastOpacityProgress);
                                    innerChild.material.needsUpdate = true;
                                }
                            });
                        }
                    });
                }
            } else if (productProgress > 0.5) {
                cellObject.visible = false;
                const normalizedProgress = (productProgress - 0.5) / 0.5;

                if (!productTextActivated) {
                    activateText(productArea);
                    productTextActivated = true;
                }

                // calculate the first 40% of the normalizedProgress to determine rotationProgress
                if (normalizedProgress <= 0.4) {
                    const rotationXProgress = normalizedProgress / 0.4;
                    product.rotation.x = smoothLerp(Math.PI / 2, Math.PI / 15, rotationXProgress);

                    if (normalizedProgress > 0.05) {
                        // calculate the progression between normalizedprogress 0.1 and 0.25
                        const rotationZProgress = (normalizedProgress - 0.05) / 0.35;
                        product.rotation.z = smoothLerp(0, -Math.PI / 5, rotationZProgress);
                    }
                } else if (normalizedProgress > 0.8) {
                    // Animate applicator
                    if (applicatorObject) {
                        // First 10% (0.8-0.9): Move Y position
                        if (normalizedProgress <= 0.9) {
                            const positionProgress = (normalizedProgress - 0.8) / 0.1; // Normalize to 0-1 for position
                            applicatorObject.position.y = smoothLerp(12, 0, positionProgress);
                        }
                        
                        // Last 5% (0.95-1.0): Rotate
                        if (normalizedProgress > 0.95) {
                            const rotationProgress = (normalizedProgress - 0.95) / 0.05; // Normalize to 0-1 for rotation
                            applicatorObject.rotation.y = smoothLerp(0, Math.PI * 0.4, rotationProgress); // 1/5 of full turn (2π * 0.2)
                        }
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
let productTextActivated = false;

let zoomFirstCurrent = false;
let zoomSecondCurrent = false;
let zoomThirdCurrent = false;

let isClickScroll = false; // Flag to track if the scroll was initiated by a click
let scrollTimeout; // Timeout for debouncing scroll events

export function animatePage(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, scrollTimeout, renderer, ambientLight) {
    let scrollY = window.scrollY;
    let scrollDiff = scrollY - lastScrollY;
    const multiplier = Math.floor(scrollDiff / 20);
    controls.autoRotateSpeed = Math.min(1.0 + (multiplier * 10), 25);

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        controls.autoRotateSpeed = 0.2;
    }, 100);

    throttle(() => scrollLogic(controls, camera, cellObject, blobInner, ribbons, spheres, wavingBlob, dotBounds, product, renderer, ambientLight), 40)();
    camera.updateProjectionMatrix();
    setLastScrollY(scrollY);
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
    ribbonTweenGroup.removeAll();
    if (ribbons && ribbons.children) {
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
                        ribbonTweenGroup.remove(ribbonTween);
                    });

                ribbonTweenGroup.add(ribbonTween);
                ribbonTween.start();
            }
        });
    }
}

function cellSheenTween(group, color = null) {
    blobTweenGroup.removeAll();
    group.traverse(child => {
        if (child.isMesh && child.material) {
            const initialColor = new THREE.Color(child.material.sheenColor);
            const targetColor = color ? new THREE.Color(color) : new THREE.Color(child.material.color); // if no color param, set sheenColor = color

            const blobTween = new Tween({ r: initialColor.r, g: initialColor.g, b: initialColor.b })
                .to({ r: targetColor.r, g: targetColor.g, b: targetColor.b }, 400)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(({ r, g, b }) => {
                    child.material.sheenColor.setRGB(r, g, b);
                    child.material.needsUpdate = true;
                })
                .onComplete(() => {
                    blobTweenGroup.remove(blobTween);
                });

            blobTweenGroup.add(blobTween);
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
    dotTweenGroup.removeAll();
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
                dotTweenGroup.remove(sphereTween);
            });

        dotTweenGroup.add(sphereTween);
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
                dotTweenGroup.remove(scaleTween);
            });

        dotTweenGroup.add(scaleTween);
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

//================================================================

function dotsTweenExplosion(wavingBlob, duration, delayBeforeFire) {
    blobTweenGroup.removeAll();
    dotTweenGroup.removeAll();

    const dotGroups = wavingBlob.children.filter(group => group.isGroup);

    dotGroups.forEach((group, index) => {
        const initialScale = { scale: 1 };
        const targetScale = { scale: 3 };
        const initialOpacity = { opacity: 1 };
        const targetOpacity = { opacity: 0 };

        setTimeout(() => {
            // Step 1: Scale Animation - Full duration
            const scaleTween = new Tween(initialScale)
                .to(targetScale, duration) // Full duration for scaling
                .easing(Easing.Quadratic.InOut)
                .onUpdate(() => {
                    group.scale.set(initialScale.scale, initialScale.scale, initialScale.scale);
                })
                .onComplete(() => {
                    blobTweenGroup.remove(scaleTween);
                });

            blobTweenGroup.add(scaleTween);
            scaleTween.start();

            // Step 2: Opacity Animation - Start after 75% of the duration, overlap with last 25%
            setTimeout(() => {
                group.children.forEach(sphere => {
                    const sphereTween = new Tween(initialOpacity)
                        .to(targetOpacity, duration * 0.3) // Final 30%
                        .easing(Easing.Quadratic.InOut)
                        .onUpdate(() => {
                            sphere.material.opacity = initialOpacity.opacity;
                            sphere.material.needsUpdate = true;
                        })
                        .onComplete(() => {
                            dotTweenGroup.remove(sphereTween);
                        });

                    dotTweenGroup.add(sphereTween);
                    sphereTween.start();
                });
            }, duration * 0.5); // Start opacity fade after 70% of the scale animation

        }, index * delayBeforeFire); // Stagger each group's animation by delayBeforeFire
    });

    // Cleanup: Remove all tweens after the last group's animation is complete
    setTimeout(() => {
        blobTweenGroup.removeAll();
        dotTweenGroup.removeAll();
    }, (dotGroups.length - 1) * delayBeforeFire + duration); // Total time for the last group to finish
}


function restoreDotScale(wavingBlob) {
    wavingBlob.scale.set(1, 1, 1);

    wavingBlob.children.forEach(group => {
        if (group.isGroup) {
            group.scale.set(1, 1, 1);
        }
    });

    //console.log("All scales reset to (1,1,1) for wavingBlob and its dot groups");
}

//================================================================

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

        // Remove active class from all dots and add to clicked dot
        scrollDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');

        isClickScroll = true; // Set the flag to true

        if (targetElement) {
            let targetPosition;
            if (section === 'product') {
                // Scroll to the bottom of the product section
                targetPosition = targetElement.offsetTop + targetElement.offsetHeight;
            } else {
                // Scroll to the top of the section
                targetPosition = targetElement.offsetTop;
            }
            smoothScrollTo(targetPosition);
        } else {
            console.error(`Target section "${section}" not found.`);
        }
    });
});

// Smooth scroll function
function smoothScrollTo(targetPosition) {
    const startPosition = window.scrollY;
    const sections = ['splash', 'zoom', 'pitch', 'product'];
    
    // Find current and target sections
    let currentSection = '';
    let targetSection = '';
    
    // Find which section we're currently in
    sections.forEach(section => {
        const elem = document.querySelector(`.${section}`);
        if (section === 'zoom') {
            // Check both zoom and zoom-out areas
            const zoomOutElem = document.querySelector('.zoom-out');
            if ((elem && isVisibleBetweenTopAndBottom(elem)) || 
                (zoomOutElem && isVisibleBetweenTopAndBottom(zoomOutElem))) {
                currentSection = section;
            }
        } else if (elem && isVisibleBetweenTopAndBottom(elem)) {
            currentSection = section;
        }
    });
    
    // Find which section we're targeting
    sections.forEach(section => {
        const elem = document.querySelector(`.${section}`);
        // Special handling for the product section
        if (section === 'product') {
            // Check if we're targeting the product section
            const productElem = document.querySelector('.product');
            if (productElem && targetPosition >= productElem.offsetTop) {
                targetSection = 'product';
            }
        } else if (elem && elem.offsetTop === targetPosition) {
            targetSection = section;
        }
    });
    
    // If no section was found and we're at the bottom, assume product section
    if (!currentSection && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight) {
        currentSection = 'product';
    }
    
    // Calculate number of sections between
    const currentIndex = sections.indexOf(currentSection);
    const targetIndex = sections.indexOf(targetSection);
    const numberOfSections = Math.abs(targetIndex - currentIndex);
    
    // Log for debugging
    console.log(`Scrolling from ${currentSection} (index: ${currentIndex}) to ${targetSection} (index: ${targetIndex})`);
    console.log(`Number of sections to scroll: ${numberOfSections}`);
    
    // Determine duration based on number of sections
    let duration;
    if (numberOfSections === 1) {
        duration = 1200;      // 1 section = 1.2s
    } else if (numberOfSections === 2) {
        duration = 2800;      // 2 sections = 2.8s
    } else if (numberOfSections >= 3) {
        duration = 4000;      // 3+ sections = 4.0s
    } else {
        duration = 0;      // Same section or error case
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

// Debounce the scroll event
window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        updateScrollIndicator();
    }, 100); // Adjust the timeout as needed
});