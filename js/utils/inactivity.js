let lastActivityTime = Date.now();
let isAnimationSuspended = false;
let animationFrameId = null;
let animateFunction = null;
let overlayDiv = null;
let messageDiv = null;

export function initActivityTracking(animate) {
    animateFunction = animate;
    
    // Create overlay div
    overlayDiv = document.createElement('div');
    overlayDiv.style.position = 'fixed';
    overlayDiv.style.display = 'none';
    overlayDiv.style.backgroundColor = 'rgba(255, 251, 244, 0)';
    overlayDiv.style.backdropFilter = 'blur(0px)';
    overlayDiv.style.width = '100%';
    overlayDiv.style.height = '100%';
    overlayDiv.style.top = '0';
    overlayDiv.style.left = '0';
    overlayDiv.style.zIndex = '1000';
    overlayDiv.style.pointerEvents = 'none';
    overlayDiv.style.transition = 'background-color 300ms ease-out, backdrop-filter 300ms ease-out';

    // Add message text
    messageDiv = document.createElement('div');
    messageDiv.textContent = 'animation paused, move mouse to resume';
    messageDiv.style.position = 'absolute';
    messageDiv.style.bottom = '2rem';
    messageDiv.style.width = '100%';
    messageDiv.style.textAlign = 'center';
    messageDiv.style.color = '#000';
    messageDiv.style.fontFamily = 'inherit';
    messageDiv.style.opacity = '0';
    messageDiv.style.transition = 'opacity 200ms ease-out';
    overlayDiv.appendChild(messageDiv);

    // Add overlay to the three container
    const threeContainer = document.querySelector('#three');
    threeContainer.appendChild(overlayDiv);
    
    // Track mouse movement
    document.addEventListener('mousemove', () => {
        lastActivityTime = Date.now();
        if (isAnimationSuspended) {
            resumeAnimation();
        }
    });

    // Track scrolling
    document.addEventListener('scroll', () => {
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
    
    // Show and animate overlay
    overlayDiv.style.display = 'block';
    // Force a reflow to ensure the display:block takes effect before starting transitions
    overlayDiv.offsetHeight;
    overlayDiv.style.backgroundColor = 'rgba(255, 251, 244, 0.3)';
    overlayDiv.style.backdropFilter = 'blur(2px)';
    
    // Fade in text after overlay animation
    setTimeout(() => {
        messageDiv.style.opacity = '1';
    }, 300);
}

function resumeAnimation() {
    if (isAnimationSuspended) {
        isAnimationSuspended = false;
        
        // Reset all styles immediately
        messageDiv.style.opacity = '0';
        overlayDiv.style.backgroundColor = 'rgba(255, 251, 244, 0)';
        overlayDiv.style.backdropFilter = 'blur(0px)';
        
        // Hide overlay after transitions complete
        setTimeout(() => {
            overlayDiv.style.display = 'none';
        }, 300);
        
        animateFunction();
    }
}

export function setAnimationFrameId(id) {
    animationFrameId = id;
} 