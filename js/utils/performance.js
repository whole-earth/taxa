/**
 * Performance monitoring utilities for Three.js applications
 */

class PerformanceMonitor {
    constructor() {
        this.frameRates = [];
        this.maxSamples = 60;
        this.lastTime = 0;
        this.isMonitoring = false;
        this.materialUpdateCount = 0;
        this.instanceMatrixUpdateCount = 0;
        this.attributeUpdateCount = 0;
        this.renderCount = 0;
        
        // Create stats display
        this.statsElement = document.createElement('div');
        this.statsElement.style.position = 'fixed';
        this.statsElement.style.top = '0';
        this.statsElement.style.right = '0';
        this.statsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.statsElement.style.color = 'white';
        this.statsElement.style.padding = '10px';
        this.statsElement.style.fontFamily = 'monospace';
        this.statsElement.style.fontSize = '12px';
        this.statsElement.style.zIndex = '9999';
        this.statsElement.style.display = 'none';
    }
    
    /**
     * Start monitoring performance
     */
    start() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.lastTime = performance.now();
        document.body.appendChild(this.statsElement);
        this.statsElement.style.display = 'block';
        
        // Reset counters
        this.resetCounters();
        
        // Start update loop
        this.update();
    }
    
    /**
     * Stop monitoring performance
     */
    stop() {
        this.isMonitoring = false;
        this.statsElement.style.display = 'none';
    }
    
    /**
     * Toggle monitoring state
     */
    toggle() {
        if (this.isMonitoring) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    /**
     * Reset all counters
     */
    resetCounters() {
        this.materialUpdateCount = 0;
        this.instanceMatrixUpdateCount = 0;
        this.attributeUpdateCount = 0;
        this.renderCount = 0;
    }
    
    /**
     * Record a material update
     * @param {number} count - Number of materials updated
     */
    recordMaterialUpdate(count = 1) {
        this.materialUpdateCount += count;
    }
    
    /**
     * Record an instance matrix update
     * @param {number} count - Number of instance matrices updated
     */
    recordInstanceMatrixUpdate(count = 1) {
        this.instanceMatrixUpdateCount += count;
    }
    
    /**
     * Record an attribute update
     * @param {number} count - Number of attributes updated
     */
    recordAttributeUpdate(count = 1) {
        this.attributeUpdateCount += count;
    }
    
    /**
     * Record a render
     */
    recordRender() {
        this.renderCount++;
    }
    
    /**
     * Update the performance stats
     */
    update() {
        if (!this.isMonitoring) return;
        
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        
        // Calculate FPS
        const fps = 1000 / delta;
        this.frameRates.push(fps);
        
        // Keep only the last N samples
        if (this.frameRates.length > this.maxSamples) {
            this.frameRates.shift();
        }
        
        // Calculate average FPS
        const avgFps = this.frameRates.reduce((sum, value) => sum + value, 0) / this.frameRates.length;
        
        // Update stats display
        this.statsElement.innerHTML = `
            FPS: ${avgFps.toFixed(1)}<br>
            Material Updates: ${this.materialUpdateCount}<br>
            Instance Matrix Updates: ${this.instanceMatrixUpdateCount}<br>
            Attribute Updates: ${this.attributeUpdateCount}<br>
            Renders: ${this.renderCount}
        `;
        
        // Schedule next update
        requestAnimationFrame(() => this.update());
    }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Add keyboard shortcut to toggle performance monitor (Alt+P)
document.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 'p') {
        performanceMonitor.toggle();
    }
}); 