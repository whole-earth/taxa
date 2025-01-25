let lastActivityTime = Date.now();
let isAnimationSuspended = false;
let animationFrameId = null;
let animateFunction = null;

export function initActivityTracking(animate) {
    animateFunction = animate;
    
    // Track mouse movement
    document.addEventListener('mousemove', () => {
        lastActivityTime = Date.now();
        if (isAnimationSuspended) {
            resumeAnimation();
        }
    });

    // Start the inactivity check
    checkInactivity();
}

function checkInactivity() {
    const inactivityThreshold = 10000; // 10 seconds
    const currentTime = Date.now();
    
    if (currentTime - lastActivityTime > inactivityThreshold && !isAnimationSuspended) {
        suspendAnimation();
    }
    
    // Continue checking every second
    setTimeout(checkInactivity, 1000);
}

function suspendAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    isAnimationSuspended = true;
}

function resumeAnimation() {
    if (isAnimationSuspended) {
        isAnimationSuspended = false;
        animateFunction();
    }
}

export function setAnimationFrameId(id) {
    animationFrameId = id;
} 