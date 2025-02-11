import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

// =========================================
// Device Detection
// =========================================
const DEVICE = {
    MOBILE_BREAKPOINT: 768,
    isMobile: window.innerWidth < 768
};

// =========================================
// Configuration
// =========================================

/**
 * Visual configuration for the starfield effect
 * Adjust these parameters to modify the appearance
 */
export const starfieldParams = {
    // Spatial layout configuration
    geometry: {
        start: {
            z: -20,           // Starting depth position
            diameter: 50      // Starting diameter of the starfield circle
        },
        end: {
            z: 60,           // Ending depth position
            diameter: 5       // Final diameter of the starfield circle
        }
    },
    
    // Line appearance and distribution
    lines: {
        count: DEVICE.isMobile ? 15 : 20,
        thickness: DEVICE.isMobile ? 3.6 : 4.8,
        opacity: 1.0,
        
        // Color distribution (must total 100)
        distribution: {
            blue: 75,    // 75% blue
            purple: 10,  // 10% purple
            gray: 10,    // 10% gray
            green: 5     // 5% green
        },
        
        // Order for spacing colors (determines the sequence when distributing)
        colorOrder: ['blue', 'purple', 'gray', 'green']
    },

    // Glow effect parameters
    glow: {
        enabled: true,
        size: DEVICE.isMobile ? 4.0 : 3.0,
        intensity: 0.3,
        steps: 6
    },

    // Color palette (modify these to change the color scheme)
    colors: {
        blue: '#4a9eff',
        purple: '#b784ff',
        gray: '#92ffd0',
        green: '#4aff9e'
    },

    // Performance settings
    performance: {
        updateFrequency: DEVICE.isMobile ? 2 : 1, // Update every N frames
        progressThreshold: 0.0005 // Minimum progress change to trigger update
    }
};

// =========================================
// Color Pattern Generation
// =========================================

/**
 * Generates a color pattern with percentage-based distribution but evenly spaced
 * @private
 */
const generateColorPattern = () => {
    const { count } = starfieldParams.lines;
    const { distribution, colorOrder } = starfieldParams.lines;
    
    // Calculate how many of each color we need based on percentages
    const colorCounts = {};
    let remainingSlots = count;
    
    // First pass: calculate integer number of slots for each color
    colorOrder.forEach(color => {
        const percentage = distribution[color];
        const exactCount = (percentage / 100) * count;
        const intCount = Math.floor(exactCount);
        colorCounts[color] = intCount;
        remainingSlots -= intCount;
    });
    
    // Second pass: distribute remaining slots based on decimal parts
    if (remainingSlots > 0) {
        const decimalParts = colorOrder.map(color => ({
            color,
            decimal: ((distribution[color] / 100) * count) % 1
        })).sort((a, b) => b.decimal - a.decimal);
        
        for (let i = 0; i < remainingSlots; i++) {
            colorCounts[decimalParts[i].color]++;
        }
    }
    
    // Create the pattern with even spacing
    const pattern = [];
    let colorIndex = 0;
    const usedCounts = Object.fromEntries(colorOrder.map(color => [color, 0]));
    
    // Fill pattern ensuring even distribution
    while (pattern.length < count) {
        const currentColor = colorOrder[colorIndex % colorOrder.length];
        
        // If we still have this color available, use it
        if (usedCounts[currentColor] < colorCounts[currentColor]) {
            pattern.push(currentColor);
            usedCounts[currentColor]++;
        }
        
        colorIndex++;
    }
    
    // Apply a controlled shuffle to maintain some spacing while adding randomness
    const shuffleWindow = Math.max(2, Math.floor(count / colorOrder.length));
    for (let i = 0; i < pattern.length - shuffleWindow; i++) {
        const swapWith = i + Math.floor(Math.random() * shuffleWindow);
        [pattern[i], pattern[swapWith]] = [pattern[swapWith], pattern[i]];
    }
    
    return pattern;
};

const COLOR_PATTERN = generateColorPattern();

// =========================================
// Shader Code
// =========================================

const SHADERS = {
    vertex: `
        attribute vec3 instanceStart;
        attribute vec3 instanceEnd;
        attribute vec3 instanceColor;
        attribute float instanceProgress;
        
        uniform float thickness;
        
        varying vec3 vColor;
        varying float vProgress;
        varying vec2 vUv;
        varying float vLineProgress;
        
        void main() {
            vColor = instanceColor;
            vProgress = instanceProgress;
            vUv = vec2(position.x + 0.5, position.y);
            vLineProgress = position.y;
            
            vec3 currentEnd = mix(instanceStart, instanceEnd, instanceProgress);
            vec3 dir = normalize(currentEnd - instanceStart);
            vec3 cameraUp = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);
            vec3 right = normalize(cross(dir, normalize(instanceStart)));
            
            vec3 pos = mix(instanceStart, currentEnd, position.y);
            float viewScale = 1.0 - abs(dot(normalize(instanceStart), normalize(cameraUp)));
            pos += right * position.x * thickness * (1.0 + viewScale);
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    
    fragment: `
        uniform float opacity;
        uniform float glowSize;
        uniform float glowIntensity;
        
        varying vec3 vColor;
        varying float vProgress;
        varying vec2 vUv;
        varying float vLineProgress;
        
        void main() {
            float dist = abs(vUv.x - 0.5);
            float finalOpacity = (1.0 - smoothstep(0.0, 0.5, dist)) * 
                                (1.0 - vLineProgress) * 
                                opacity;
            
            gl_FragColor = vec4(vColor, finalOpacity);
        }
    `
};

// =========================================
// StarField Class
// =========================================

export class StarField extends THREE.Group {
    constructor(params = starfieldParams) {
        super();
        this.config = params;
        this.lines = [];
        this.frameCount = 0;
        this.updateFrequency = params.performance.updateFrequency;
        
        this._setupInitialState();
        this._init();
    }

    // =========================================
    // Public Methods
    // =========================================

    /**
     * Updates the starfield animation progress
     * @param {number} progress - Animation progress from 0 to 1
     * @param {boolean} isInActiveArea - Whether we're in an active scroll area
     */
    updateProgress(progress, isInActiveArea = true) {
        if (this.frameCount++ % this.updateFrequency !== 0) return;
        
        if (!this._shouldUpdate(isInActiveArea)) return;
        
        const scaledProgress = this._calculateProgress(progress);
        if (!this._hasProgressChanged(scaledProgress)) return;
        
        this._updateAnimation(scaledProgress);
    }

    // =========================================
    // Private Setup Methods
    // =========================================

    _setupInitialState() {
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        this._tempVector = new THREE.Vector3();
        this._tempMatrix = new THREE.Matrix4();
        this.rotation.set(0, Math.PI, 0);
    }

    async _init() {
        const { MeshLine, MeshLineMaterial } = await waitForMeshLine();
        this._createStarField(MeshLine, MeshLineMaterial);
    }

    _generateUniformPoints(count) {
        const halfCount = Math.ceil(count / 2);
        const topPoints = Array.from({ length: halfCount }, (_, i) => {
            const angle = (i / halfCount) * Math.PI * 2;
            return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
        });
        
        const bottomPoints = Array.from({ length: count - halfCount }, (_, i) => {
            const angle = ((i + 0.5) / halfCount) * Math.PI * 2;
            return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
        });
        
        return [...topPoints, ...bottomPoints].sort(() => Math.random() - 0.5);
    }

    _getColorForIndex(index) {
        const position = index % COLOR_PATTERN.length;
        return this.config.colors[COLOR_PATTERN[position]];
    }

    /**
     * Creates the starfield with instanced geometry and custom shaders
     */
    async _createStarField(MeshLine, MeshLineMaterial) {
        const { lines, geometry } = this.config;
        const points = this._generateUniformPoints(lines.count);

        // Create base geometry
        const lineGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
            -0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0
        ]);
        const indices = new Uint16Array([0, 2, 1, 1, 2, 3]);
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        lineGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        // Setup instance attributes
        this._setupInstanceAttributes(lineGeometry, points);

        // Create shader material
        const material = this._createShaderMaterial();

        // Create and add instanced mesh
        this.linesMesh = new THREE.InstancedMesh(lineGeometry, material, lines.count);
        this.linesMesh.frustumCulled = false;
        this.linesMesh.renderOrder = 1;
        this.add(this.linesMesh);
    }

    /**
     * Sets up instance attributes for the starfield geometry
     */
    _setupInstanceAttributes(geometry, points) {
        const { lines, geometry: geo } = this.config;
        const startPositions = new Float32Array(lines.count * 3);
        const endPositions = new Float32Array(lines.count * 3);
        const colors = new Float32Array(lines.count * 3);
        const progressArray = new Float32Array(lines.count);

        for (let i = 0; i < lines.count; i++) {
            const startRadius = geo.start.diameter / 2;
            const endRadius = geo.end.diameter / 2;
            
            // Set positions
            const idx = i * 3;
            startPositions[idx] = points[i].x * startRadius;
            startPositions[idx + 1] = points[i].y * startRadius;
            startPositions[idx + 2] = geo.start.z;

            endPositions[idx] = points[i].x * endRadius;
            endPositions[idx + 1] = points[i].y * endRadius;
            endPositions[idx + 2] = geo.end.z;

            // Set color
            const color = new THREE.Color(this._getColorForIndex(i));
            colors[idx] = color.r;
            colors[idx + 1] = color.g;
            colors[idx + 2] = color.b;

            progressArray[i] = 0;
        }

        geometry.setAttribute('instanceStart', new THREE.InstancedBufferAttribute(startPositions, 3));
        geometry.setAttribute('instanceEnd', new THREE.InstancedBufferAttribute(endPositions, 3));
        geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
        geometry.setAttribute('instanceProgress', new THREE.InstancedBufferAttribute(progressArray, 1));
    }

    /**
     * Creates the shader material for the starfield
     */
    _createShaderMaterial() {
        const { lines, glow } = this.config;
        return new THREE.ShaderMaterial({
            uniforms: {
                thickness: { value: lines.thickness },
                opacity: { value: lines.opacity },
                glowSize: { value: glow.size },
                glowIntensity: { value: glow.intensity },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: SHADERS.vertex,
            fragmentShader: SHADERS.fragment,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending
        });
    }

    // =========================================
    // Private Update Methods
    // =========================================

    /**
     * Determines if the starfield should update
     * @private
     */
    _shouldUpdate(isInActiveArea) {
        if (!this.visible || !isInActiveArea) {
            if (this.lastProgress !== 0) {
                this._resetProgress();
            }
            return false;
        }
        return true;
    }

    /**
     * Calculates the eased and scaled progress
     * @private
     */
    _calculateProgress(progress) {
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress // Ease in
            : -1 + (4 - 2 * progress) * progress; // Ease out
            
        return Math.min(1, easedProgress / 0.8);
    }

    /**
     * Checks if the progress has changed significantly
     * @private
     */
    _hasProgressChanged(scaledProgress) {
        if (Math.abs(this.lastProgress - scaledProgress) < 0.0005) return false;
        this.lastProgress = scaledProgress;
        return true;
    }

    /**
     * Updates the animation with the current progress
     * @private
     */
    _updateAnimation(scaledProgress) {
        if (!this.visible || Math.abs(this._lastUpdateProgress - scaledProgress) < 0.001) {
            return;
        }
        this._lastUpdateProgress = scaledProgress;

        if (this.linesMesh) {
            this._updateLines(scaledProgress);
        }
    }

    /**
     * Updates the line animations
     * @private
     */
    _updateLines(scaledProgress) {
        const progressAttribute = this.linesMesh.geometry.getAttribute('instanceProgress');
        const data = progressAttribute.array;
        
        for (let i = 0; i < this.config.lines.count; i++) {
            data[i] = scaledProgress;
        }
        
        progressAttribute.needsUpdate = true;
    }

    // =========================================
    // Helper Methods
    // =========================================

    /**
     * Resets the progress state
     * @private
     */
    _resetProgress() {
        this.lastProgress = 0;
        this._updateLines(0);
    }
}