class InactivityManager {
    constructor() {

        this.INACTIVITY_THRESHOLD = 40000;
        this.CHECK_INTERVAL = 3000;
        this.THROTTLE_DELAY = 250;
        this.BOTTOM_THRESHOLD = 40;
        
        this.app = null;
        this.isActive = true;
        this.lastActivityTime = performance.now(); // Use performance.now() consistently
        this.lastLogTime = 0;
        this.checkIntervalId = null;
        this.lastScrollY = window.scrollY;
        this.scrollTimeout = null;
        this.documentHeight = document.documentElement.scrollHeight;
        
        // Cache DOM Elements
        this.overlay = null;
        this.playButton = null;
        
        // Pre-bind methods once
        this.boundHandleActivity = this.throttle(this.handleActivity.bind(this), this.THROTTLE_DELAY);
        this.boundCheckInactivity = this.checkInactivity.bind(this);
        this.boundResumeAnimation = this.resumeAnimation.bind(this);
        this.boundHandleResize = this.debounce(this.handleResize.bind(this), 250);
        this.addStyles();
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    debounce(func, wait) {
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

    handleResize() {
        this.documentHeight = document.documentElement.scrollHeight;
    }

    logPauseInfo() {
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

    addStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .inactivity-overlay {
                position: fixed;
                display: block;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(255, 251, 244, 0);
                backdrop-filter: blur(0px);
                z-index: 1000000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 500ms ease-out, backdrop-filter 500ms ease-out, background-color 500ms ease-out;
            }

            .inactivity-overlay.active {
                background-color: rgba(255, 251, 244, 0.3);
                backdrop-filter: blur(2px);
                opacity: 1;
                pointer-events: auto;
            }

            .inactivity-play-button {
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) scale(0.8);
                filter: drop-shadow(0 0 60px #fffbf4) drop-shadow(0 0 16px #fffbf4);
                cursor: pointer;
                opacity: 0;
                transition: opacity 400ms ease-out, transform 400ms ease-out;
                transition-delay: 100ms;
                width: 80px;
                height: 80px;
            }

            @media (max-width: 768px) {
                .inactivity-play-button {
                    width: 50px;
                    height: 50px;
                }
            }

            .inactivity-overlay.active .inactivity-play-button {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        `;
        document.head.appendChild(styles);
    }

    init(app) {
        this.app = app;
        this.setupOverlay();
        this.setupEventListeners();
        this.checkIntervalId = setInterval(this.boundCheckInactivity, this.CHECK_INTERVAL);
        
        window.addEventListener('resize', this.boundHandleResize, { passive: true });
    }

    setupOverlay() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'inactivity-overlay';

        // Create play button
        this.playButton = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.playButton.setAttribute("viewBox", "0 0 330 330");
        this.playButton.setAttribute("width", "80");
        this.playButton.setAttribute("height", "80");
        this.playButton.setAttribute("class", "inactivity-play-button");

        const playPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        playPath.setAttribute("d", "M37.728 328.12c2.266 1.256 4.77 1.88 7.272 1.88 2.763 0 5.522-.763 7.95-2.28l240-149.999c4.386-2.741 7.05-7.548 7.05-12.72s-2.664-9.979-7.05-12.72L52.95 2.28c-4.625-2.891-10.453-3.043-15.222-.4C32.959 4.524 30 9.547 30 15v300c0 5.453 2.959 10.476 7.728 13.12z");
        playPath.setAttribute("fill", "#849ed0");

        this.playButton.appendChild(playPath);
        this.overlay.appendChild(this.playButton);
        document.body.appendChild(this.overlay);

        this.playButton.addEventListener('click', this.boundResumeAnimation);
    }

    setupEventListeners() {
        const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
        const options = { passive: true };
        
        events.forEach(event => {
            document.addEventListener(event, this.boundHandleActivity, options);
        });
    }

    handleActivity() {
        this.lastActivityTime = performance.now(); // Use performance.now() consistently
        
        if (!this.isActive) {
            this.resumeAnimation();
        }
    }

    checkInactivity() {
        const now = performance.now();
        const timeSinceActivity = now - this.lastActivityTime;
        
        // Early return if we're still within the threshold
        if (timeSinceActivity < this.INACTIVITY_THRESHOLD) return;
        
        // Check if we're near the bottom of the page (using cached documentHeight)
        const scrollPosition = window.scrollY + window.innerHeight;
        const isNearBottom = this.documentHeight - scrollPosition <= this.BOTTOM_THRESHOLD;
        
        // If near bottom, just reset timer and ensure animation
        if (isNearBottom) {
            this.lastActivityTime = now;
            if (!this.isActive) {
                this.resumeAnimation();
            }
            return;
        }
        
        // Only proceed if we're active and enough time has passed
        if (!this.isActive || timeSinceActivity < this.INACTIVITY_THRESHOLD) return;
        
        // Start fade in sequence
        this.overlay.classList.add('active');
        
        // Use requestAnimationFrame for better timing with frame updates
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (!this.isActive) return;
                if (this.app?.animationFrameId) {
                    cancelAnimationFrame(this.app.animationFrameId);
                    this.app.animationFrameId = null;
                    this.logPauseInfo();
                }
                this.isActive = false;
            }, 500);
        });
    }

    resumeAnimation() {
        if (this.isActive) return;
        
        // Start fade out
        this.overlay.classList.remove('active');
        
        // Resume animation immediately
        if (this.app) {
            this.app.startAnimationLoop();
        }
        
        this.isActive = true;
        this.lastActivityTime = performance.now(); // Use performance.now() consistently
    }

    dispose() {
        const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.removeEventListener(event, this.boundHandleActivity);
        });
        
        window.removeEventListener('resize', this.boundHandleResize);
        
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
        }
        
        if (this.overlay?.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}

const inactivityManager = new InactivityManager();

export function initInactivityManager(app) {
    inactivityManager.init(app);
} 