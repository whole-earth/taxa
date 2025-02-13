/**
 * Inactivity Manager
 * Shows overlay and pauses animation after inactivity threshold
 */

class InactivityManager {
    constructor() {
        this.INACTIVITY_THRESHOLD = 2000; // 2 seconds
        this.app = null;
        this.isActive = true;
        this.lastActivityTime = Date.now();
        
        // DOM Elements
        this.overlay = null;
        this.playButton = null;
        
        // Bind methods
        this.handleActivity = this.handleActivity.bind(this);
        this.checkInactivity = this.checkInactivity.bind(this);
        this.resumeAnimation = this.resumeAnimation.bind(this);
    }

    init(app) {
        this.app = app;
        this.setupOverlay();
        this.setupEventListeners();
        setInterval(this.checkInactivity, 1000);
    }

    setupOverlay() {
        // Create overlay
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed',
            display: 'none',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 251, 244, 0.3)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000000
        });

        // Create play button
        this.playButton = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.playButton.setAttribute("viewBox", "0 0 24 24");
        this.playButton.setAttribute("width", "120");
        this.playButton.setAttribute("height", "120");
        
        Object.assign(this.playButton.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            filter: 'drop-shadow(0 0 60px #fffbf4) drop-shadow(0 0 16px #fffbf4)',
            cursor: 'pointer'
        });

        const playPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        playPath.setAttribute("d", "M8.5 5.5c-.2 0-.5.1-.7.3-.3.2-.3.5-.3.7v11c0 .2 0 .5.3.7.4.3.9.3 1.2 0l9-5.5c.3-.2.5-.5.5-.7s-.2-.5-.5-.7l-9-5.5c-.1-.2-.3-.3-.5-.3z");
        playPath.setAttribute("fill", "#849ed0");

        this.playButton.appendChild(playPath);
        this.overlay.appendChild(this.playButton);
        document.body.appendChild(this.overlay);

        this.playButton.addEventListener('click', this.resumeAnimation);
    }

    setupEventListeners() {
        ['mousemove', 'scroll', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, this.handleActivity);
        });
    }

    handleActivity() {
        this.lastActivityTime = Date.now();
        
        if (!this.isActive) {
            this.resumeAnimation();
        }
    }

    checkInactivity() {
        const timeSinceActivity = Date.now() - this.lastActivityTime;
        console.log(`Inactive for: ${Math.round(timeSinceActivity/1000)}s`);
        
        if (timeSinceActivity >= this.INACTIVITY_THRESHOLD && this.isActive) {
            // Pause animation
            if (this.app?.animationFrameId) {
                cancelAnimationFrame(this.app.animationFrameId);
                this.app.animationFrameId = null;
            }
            
            // Show overlay
            this.overlay.style.display = 'block';
            this.isActive = false;
        }
    }

    resumeAnimation() {
        if (this.isActive) return;
        
        // Hide overlay
        this.overlay.style.display = 'none';
        
        // Resume animation
        if (this.app) {
            this.app.startAnimationLoop();
        }
        
        this.isActive = true;
        this.lastActivityTime = Date.now();
    }

    dispose() {
        ['mousemove', 'scroll', 'touchstart', 'keydown'].forEach(event => {
            document.removeEventListener(event, this.handleActivity);
        });
        
        if (this.overlay?.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}

// Create singleton instance
const inactivityManager = new InactivityManager();

// Export initialization function
export function initInactivityManager(app) {
    inactivityManager.init(app);
} 