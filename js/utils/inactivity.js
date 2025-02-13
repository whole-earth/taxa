/**
 * Inactivity tracking and animation suspension module.
 * Handles pausing animations when user is inactive and displays a play button overlay.
 */

class InactivityManager {
    constructor() {
        // Configuration
        this.INACTIVITY_THRESHOLD = 2000; // 22 seconds
        this.POSITION_CHECK_INTERVAL = 2000; // 2 seconds
        
        // State
        this.isAnimationSuspended = false;
        this.animationFrameId = null;
        this.animateFunction = null;
        this.lastActivityTime = Date.now();
        this.lastPositionCheck = 0;
        this.inactivityTimer = null;
        
        // DOM Elements
        this.overlayDiv = null;
        this.playButtonSvg = null;
        
        // Bind methods
        this.handleActivity = this.handleActivity.bind(this);
        this.checkInactivity = this.checkInactivity.bind(this);
        this.suspendAnimation = this.suspendAnimation.bind(this);
        this.resumeAnimation = this.resumeAnimation.bind(this);
    }

    init(animate) {
        this.animateFunction = animate;
        this.setupOverlay();
        this.setupEventListeners();
        this.startInactivityCheck();
    }

    setupOverlay() {
        // Create overlay container
        this.overlayDiv = document.createElement('div');
        Object.assign(this.overlayDiv.style, {
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

        // Create play button SVG
        this.playButtonSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.playButtonSvg.setAttribute("viewBox", "0 0 24 24");
        
        Object.assign(this.playButtonSvg.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: '0',
            transition: 'opacity 300ms ease-out',
            filter: 'drop-shadow(0 0 60px #fffbf4) drop-shadow(0 0 16px #fffbf4)',
            cursor: 'pointer'
        });

        // Create play button path
        const playPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        playPath.setAttribute("d", "M8.5 5.5c-.2 0-.5.1-.7.3-.3.2-.3.5-.3.7v11c0 .2 0 .5.3.7.4.3.9.3 1.2 0l9-5.5c.3-.2.5-.5.5-.7s-.2-.5-.5-.7l-9-5.5c-.1-.2-.3-.3-.5-.3z");
        playPath.setAttribute("fill", "#849ed0");
        
        // Assemble and add to DOM
        this.playButtonSvg.appendChild(playPath);
        this.overlayDiv.appendChild(this.playButtonSvg);
        document.body.appendChild(this.overlayDiv);
        
        // Initial size update and resize handling
        this.updatePlayButtonSize();
        window.addEventListener('resize', this.debounce(this.updatePlayButtonSize.bind(this), 250), { passive: true });
        
        // Add click handler
        this.playButtonSvg.addEventListener('click', this.resumeAnimation, { passive: true });
    }

    updatePlayButtonSize() {
        const size = window.innerWidth < 768 ? "80" : "120";
        this.playButtonSvg.setAttribute("width", size);
        this.playButtonSvg.setAttribute("height", size);
    }

    setupEventListeners() {
        // Activity events
        const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, this.handleActivity, { passive: true });
        });
    }

    handleActivity() {
        this.lastActivityTime = Date.now();
        
        if (this.isAnimationSuspended) {
            this.resumeAnimation();
        }
        
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        
        if (!this.isNearPageBottom() && !this.isNavVisible()) {
            this.inactivityTimer = setTimeout(this.suspendAnimation, this.INACTIVITY_THRESHOLD);
        }
    }

    startInactivityCheck() {
        const checkLoop = (timestamp) => {
            if (!this.lastPositionCheck) this.lastPositionCheck = timestamp;
            
            if (timestamp - this.lastPositionCheck >= this.POSITION_CHECK_INTERVAL) {
                this.checkInactivity();
                this.lastPositionCheck = timestamp;
            }
            
            requestAnimationFrame(checkLoop);
        };
        
        requestAnimationFrame(checkLoop);
    }

    checkInactivity() {
        const timeSinceLastActivity = Date.now() - this.lastActivityTime;
        
        if (!this.isAnimationSuspended && 
            timeSinceLastActivity >= this.INACTIVITY_THRESHOLD && 
            !this.isNearPageBottom() && 
            !this.isNavVisible()) {
            this.suspendAnimation();
        }
    }

    suspendAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.isAnimationSuspended = true;
        this.logPauseInfo();
        
        // Show overlay with animation
        this.overlayDiv.style.display = 'block';
        this.overlayDiv.style.pointerEvents = 'auto';
        this.overlayDiv.offsetHeight; // Force reflow
        
        this.overlayDiv.style.backgroundColor = 'rgba(255, 251, 244, 0.3)';
        this.overlayDiv.style.backdropFilter = 'blur(2px)';
        
        setTimeout(() => {
            this.playButtonSvg.style.opacity = '1';
        }, 500);
    }

    resumeAnimation() {
        if (!this.isAnimationSuspended) return;
        
        this.isAnimationSuspended = false;
        this.lastActivityTime = Date.now();
        
        // Hide overlay with animation
        this.playButtonSvg.style.opacity = '0';
        this.overlayDiv.style.backgroundColor = 'rgba(255, 251, 244, 0)';
        this.overlayDiv.style.backdropFilter = 'blur(0px)';
        this.overlayDiv.style.pointerEvents = 'none';
        
        setTimeout(() => {
            this.overlayDiv.style.display = 'none';
        }, 400);
        
        // Resume animation
        if (this.animateFunction) {
            this.animateFunction();
        }
    }

    isNearPageBottom() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollPosition = window.scrollY + windowHeight;
        return documentHeight - scrollPosition <= 30;
    }

    isNavVisible() {
        const navBody = document.querySelector('.nav-body');
        return navBody && window.getComputedStyle(navBody).display !== 'none';
    }

    logPauseInfo() {
        const now = new Date();
        const deviceInfo = {
            platform: navigator.platform,
            cores: navigator.hardwareConcurrency || 'unknown',
            pixelRatio: window.devicePixelRatio,
            memory: performance?.memory?.usedJSHeapSize ? 
                `${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB used` : 
                'Memory info unavailable'
        };

        console.log(
            `3D render paused at ${now.toLocaleTimeString()}\n` +
            `Device: ${deviceInfo.platform}, ${deviceInfo.cores} cores, ` +
            `${deviceInfo.pixelRatio}x pixel ratio, ${deviceInfo.memory}`
        );
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    setAnimationFrameId(id) {
        this.animationFrameId = id;
    }
}

// Create singleton instance
const inactivityManager = new InactivityManager();

// Export functions
export function initActivityTracking(animate) {
    inactivityManager.init(animate);
}

export function setAnimationFrameId(id) {
    inactivityManager.setAnimationFrameId(id);
} 