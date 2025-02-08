/**
 * Inactivity tracking and animation suspension module.
 * Handles pausing animations when user is inactive and displays a play button overlay.
 */

// State variables
let isAnimationSuspended = false;
let animationFrameId = null;
let animateFunction = null;
let overlayDiv = null;
let playButtonSvg = null;
let lastCursorPosition = { x: 0, y: 0 };
let lastScrollPosition = { x: 0, y: 0 };
let inactivityTimer = null;
let lastPositionCheck = 0;

const INACTIVITY_THRESHOLD = 22000; // 22 seconds
const POSITION_CHECK_INTERVAL = 2000; // 2 seconds

/**
 * Initializes activity tracking and creates the overlay elements
 * @param {Function} animate - The main animation function to control
 */
export function initActivityTracking(animate) {
    animateFunction = animate;
    setupOverlayAndButton();
    startActivityTracking();
}

/**
 * Creates and configures both the overlay and play button elements
 */
function setupOverlayAndButton() {
    // Create and setup overlay
    overlayDiv = document.createElement('div');
    Object.assign(overlayDiv.style, {
        position: 'fixed',
        display: 'none',
        backgroundColor: 'rgba(255, 251, 244, 0)',
        backdropFilter: 'blur(0px)',
        width: '100%',
        height: '100%',
        top: '0',
        left: '0',
        zIndex: '1000000000000',
        transition: 'background-color 400ms ease-out, backdrop-filter 400ms ease-out'
    });
    
    // Create SVG element
    playButtonSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    playButtonSvg.setAttribute("viewBox", "0 0 24 24");
    
    // Configure play button styles
    Object.assign(playButtonSvg.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: '0',
        transition: 'opacity 300ms ease-out',
        filter: 'drop-shadow(0 0 60px #fffbf4) drop-shadow(0 0 16px #fffbf4)',
        cursor: 'pointer'
    });
    
    // Create and add the path
    const playPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    playPath.setAttribute("d", "M8.5 5.5c-.2 0-.5.1-.7.3-.3.2-.3.5-.3.7v11c0 .2 0 .5.3.7.4.3.9.3 1.2 0l9-5.5c.3-.2.5-.5.5-.7s-.2-.5-.5-.7l-9-5.5c-.1-.2-.3-.3-.5-.3z");
    playPath.setAttribute("fill", "#849ed0");
    playButtonSvg.appendChild(playPath);
    
    // Setup responsive sizing with initial size
    updatePlayButtonSize();
    const debouncedResize = debounce(updatePlayButtonSize, 250);
    window.addEventListener('resize', debouncedResize, { passive: true });
    
    // Add play button to overlay and overlay to document
    overlayDiv.appendChild(playButtonSvg);
    document.body.appendChild(overlayDiv);
    
    // Add click handler for the play button
    playButtonSvg.addEventListener('click', resumeAnimation, { passive: true });
}

/**
 * Updates play button size based on window width
 */
function updatePlayButtonSize() {
    const width = window.innerWidth < 768 ? "80" : "120";
    playButtonSvg.setAttribute("width", width);
    playButtonSvg.setAttribute("height", width);
}

/**
 * Debounce function to limit the rate at which a function can fire
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Starts tracking user activity
 */
function startActivityTracking() {
    // Use passive listeners for better performance
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    // Start the activity check loop using requestAnimationFrame
    checkActivity();
}

/**
 * Efficient mousemove handler
 */
function handleMouseMove(e) {
    lastCursorPosition = { x: e.clientX, y: e.clientY };
    resetInactivityTimer();
}

/**
 * Efficient scroll handler
 */
function handleScroll() {
    lastScrollPosition = {
        x: window.scrollX,
        y: window.scrollY
    };
    resetInactivityTimer();
}

/**
 * Resets the inactivity timer
 */
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    if (isAnimationSuspended) {
        resumeAnimation();
    }
    inactivityTimer = setTimeout(suspendAnimation, INACTIVITY_THRESHOLD);
}

/**
 * Checks activity status using requestAnimationFrame
 */
function checkActivity(timestamp) {
    if (!lastPositionCheck) lastPositionCheck = timestamp;
    const deltaTime = timestamp - lastPositionCheck;

    // Only check positions every POSITION_CHECK_INTERVAL
    if (deltaTime >= POSITION_CHECK_INTERVAL) {
        const currentScroll = {
            x: window.scrollX,
            y: window.scrollY
        };

        // If no movement and not suspended, ensure timer is running
        if (!isAnimationSuspended && 
            currentScroll.x === lastScrollPosition.x && 
            currentScroll.y === lastScrollPosition.y) {
            if (!inactivityTimer) {
                inactivityTimer = setTimeout(suspendAnimation, INACTIVITY_THRESHOLD);
            }
        }

        lastPositionCheck = timestamp;
    }

    // Continue the loop
    requestAnimationFrame(checkActivity);
}

/**
 * Suspends the animation and shows the overlay
 */
function suspendAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    isAnimationSuspended = true;
    
    logPauseInfo();
    
    overlayDiv.style.display = 'block';
    overlayDiv.style.pointerEvents = 'auto';
    overlayDiv.offsetHeight; // Force reflow
    
    overlayDiv.style.backgroundColor = 'rgba(255, 251, 244, 0.3)';
    overlayDiv.style.backdropFilter = 'blur(2px)';
    
    setTimeout(() => {
        playButtonSvg.style.opacity = '1';
    }, 500);
}

/**
 * Resumes the animation and hides the overlay
 */
function resumeAnimation() {
    if (isAnimationSuspended) {
        isAnimationSuspended = false;
        
        playButtonSvg.style.opacity = '0';
        overlayDiv.style.backgroundColor = 'rgba(255, 251, 244, 0)';
        overlayDiv.style.backdropFilter = 'blur(0px)';
        overlayDiv.style.pointerEvents = 'none';
        
        setTimeout(() => {
            overlayDiv.style.display = 'none';
        }, 400);
        
        animateFunction();
    }
}

/**
 * Logs pause information with timestamp and device details
 */
function logPauseInfo() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    const deviceInfo = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        memory: performance?.memory?.usedJSHeapSize ? 
            `${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB used` : 
            'Memory info unavailable',
        cores: navigator.hardwareConcurrency || 'unknown',
        devicePixelRatio: window.devicePixelRatio
    };

    console.log(
        `The 3D render was paused to optimize device performance.\n` +
        `Time: ${timeString}\n` +
        `Device: ${deviceInfo.platform}, ${deviceInfo.cores} cores, ${deviceInfo.devicePixelRatio}x pixel ratio, ${deviceInfo.memory}`
    );
}

/**
 * Sets the animation frame ID for tracking
 * @param {number} id - The animation frame ID to track
 */
export function setAnimationFrameId(id) {
    animationFrameId = id;
} 