import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

// =========================================
// Configuration
// =========================================

const DEVICE = {
    MOBILE_BREAKPOINT: 768,
    isMobile: window.innerWidth < 768
};

/**
 * Core visual parameters for the starfield effect
 */
const STARFIELD_PARAMS = {
    // Spatial configuration
    geometry: {
        start: {
            z: -20,            // Starting depth position
            diameter: 50      // Starting diameter of the starfield circle
        },
        end: {
            z: 60,          // Ending depth position
            diameter: 5      // Final diameter of the starfield circle (convergence point)
        }
    },
    
    // Line appearance
    lines: {
        count: DEVICE.isMobile ? 15 : 40,
        thickness: DEVICE.isMobile ? 3.6 : 4.8,
        opacity: 1.0,
        distribution: {
            blue: 75,    // 35% blue
            purple: 10,  // 35% purple
            gray: 10,    // 15% gray
            green: 5    // 15% green
        }
    },

    // Glow effect
    glow: {
        enabled: true,
        size: DEVICE.isMobile ? 4.0 : 3.0,
        intensity: 0.3,
        steps: 6
    },

    // Color palette
    colors: {
        
        blue: '#4a9eff',
        purple: '#b784ff',
        gray: '#92ffd0',
        green: '#4aff9e'
        /*
        blue: '#ffffff',
        purple: '#ffffff',
        gray: '#ffffff',
        green: '#ffffff'    
        */
    }
};

/**
 * Surrounding cylinder configuration
 */
const CYLINDER_PARAMS = {
    geometry: {
        segments: DEVICE.isMobile ? 32 : 64,
        radiusOffset: 20,     // Extra radius beyond starfield diameter
        extension: 800       // Extra length beyond end point
    },
    appearance: {
        color: '#fffbf4',
        opacity: 0.70
    },
    animation: {
        minProgressDelta: 0.005, // Minimum progress change to trigger update
        minDimensionDelta: 0.05  // Minimum dimension change to trigger update
    }
};

// Generate color distribution pattern based on percentages
const COLOR_PATTERN = (() => {
    const pattern = [];
    const { distribution } = STARFIELD_PARAMS.lines;
    const totalSlots = 20; // Total number of slots for distribution
    
    const addColors = (color, percentage) => {
        const slots = Math.round((percentage / 100) * totalSlots);
        for (let i = 0; i < slots; i++) pattern.push(color);
    };

    addColors('blue', distribution.blue);
    addColors('purple', distribution.purple);
    addColors('gray', distribution.gray);
    addColors('green', distribution.green);
    
    return pattern;
})();

// Combine all configs into the exported params
export const starfieldParams = {
    geometry: STARFIELD_PARAMS.geometry,
    lines: {
        ...STARFIELD_PARAMS.lines,
        glow: STARFIELD_PARAMS.glow
    },
    colors: STARFIELD_PARAMS.colors,
    cylinder: {
        ...CYLINDER_PARAMS.geometry,
        ...CYLINDER_PARAMS.appearance,
        ...CYLINDER_PARAMS.animation
    }
};

// =========================================
// StarField Class
// =========================================

export class StarField extends THREE.Group {
    constructor(params = starfieldParams) {
        super();
        this.params = params;
        this.lines = [];
        this.frameCount = 0;
        this.updateFrequency = DEVICE.isMobile ? 2 : 1; // Update every other frame on mobile
        
        this._setupInitialState();
        this._initProductTube();
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
        // Skip frames based on device capability
        if (this.frameCount++ % this.updateFrequency !== 0) return;
        
        if (!this._shouldUpdate(isInActiveArea)) return;
        
        const scaledProgress = this._calculateProgress(progress);
        if (!this._hasProgressChanged(scaledProgress)) return;
        
        this._updateAnimation(scaledProgress);
    }

    // =========================================
    // Private Setup Methods
    // =========================================

    /**
     * Sets up the initial state and configuration
     * @private
     */
    _setupInitialState() {
        // Setup culling
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        
        // Setup reusable calculation objects
        this._tempVector = new THREE.Vector3();
        this._tempMatrix = new THREE.Matrix4();
        
        this.rotation.set(0, Math.PI, 0);
        
        this.params.geometry = {
            ...this.params.geometry,
            start: { 
                z: this.params.geometry.start.z, 
                diameter: this.params.geometry.start.diameter 
            },
            end: { 
                z: this.params.geometry.end.z, 
                diameter: this.params.geometry.end.diameter 
            }
        };
    }

    /**
     * Initializes the surrounding tube effect
     * @private
     */
    _initProductTube() {
        const { start } = this.params.geometry;
        const radius = (start.diameter / 2) + this.params.cylinder.radiusOffset;
        
        const geometry = this._createCylinderGeometry();
        const material = this._createCylinderMaterial(radius);
        
        this.productTube = new THREE.Mesh(geometry, material);
        this._setupProductTube(start);
        
        //this.add(this.productTube);
    }

    /**
     * Creates the cylinder geometry
     * @private
     */
    _createCylinderGeometry() {
        return new THREE.CylinderGeometry(
            1.0, 1.0, 1.0,
            this.params.cylinder.segments,
            1, true
        );
    }

    /**
     * Creates the cylinder material with dynamic scaling
     * @private
     */
    _createCylinderMaterial(radius) {
        return new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(this.params.cylinder.color) },
                opacity: { value: this.params.cylinder.opacity },
                radius: { value: radius },
                height: { value: 0.1 }
            },
            vertexShader: this._getCylinderVertexShader(),
            fragmentShader: this._getCylinderFragmentShader(),
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending
        });
    }

    /**
     * Sets up the product tube properties
     * @private
     */
    _setupProductTube(start) {
        this.productTube.position.z = start.z;
        this.productTube.rotation.x = Math.PI / 2;
        this.productTube.renderOrder = -10000;
        this.productTube.visible = true;
    }

    /**
     * Initializes the starfield by creating the MeshLine elements
     * @private
     */
    async _init() {
        const { MeshLine, MeshLineMaterial } = await waitForMeshLine();
        this._createStarField(MeshLine, MeshLineMaterial);
    }

    /**
     * Creates evenly distributed points around a circle
     * @private
     */
    _generateUniformPoints(count) {
        // Generate two sets of points to ensure full coverage
        const halfCount = Math.ceil(count / 2);
        const topPoints = Array.from({ length: halfCount }, (_, i) => {
            const angle = (i / halfCount) * Math.PI * 2;
            return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
        });
        
        const bottomPoints = Array.from({ length: count - halfCount }, (_, i) => {
            const angle = ((i + 0.5) / halfCount) * Math.PI * 2; // Offset to stagger bottom points
            return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
        });
        
        // Combine and shuffle points to distribute them evenly
        return [...topPoints, ...bottomPoints].sort(() => Math.random() - 0.5);
    }

    /**
     * Returns a color based on the index to maintain consistent distribution
     * @private
     */
    _getColorForIndex(index) {
        const position = index % COLOR_PATTERN.length;
        return this.params.colors[COLOR_PATTERN[position]];
    }

    /**
     * Creates the starfield lines with their materials and geometries
     * @private
     */
    async _createStarField(MeshLine, MeshLineMaterial) {
        const points = this._generateUniformPoints(this.params.lines.count);
        const { start, end } = this.params.geometry;

        // Create base line geometry with proper segments for thickness
        const lineGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
            -0.5, 0, 0,   // left vertex
            0.5, 0, 0,    // right vertex
            -0.5, 1, 0,   // left vertex top
            0.5, 1, 0     // right vertex top
        ]);
        const indices = new Uint16Array([0, 2, 1, 1, 2, 3]); // Triangle indices
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        lineGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        // Create instance attributes
        const startPositions = new Float32Array(this.params.lines.count * 3);
        const endPositions = new Float32Array(this.params.lines.count * 3);
        const colors = new Float32Array(this.params.lines.count * 3);
        const progressArray = new Float32Array(this.params.lines.count);

        // Fill instance attributes
        for (let i = 0; i < this.params.lines.count; i++) {
            const startRadius = start.diameter / 2;
            const endRadius = end.diameter / 2;
            
            // Start position
            startPositions[i * 3] = points[i].x * startRadius;
            startPositions[i * 3 + 1] = points[i].y * startRadius;
            startPositions[i * 3 + 2] = start.z;

            // End position
            endPositions[i * 3] = points[i].x * endRadius;
            endPositions[i * 3 + 1] = points[i].y * endRadius;
            endPositions[i * 3 + 2] = end.z;

            // Color
            const lineColor = new THREE.Color(this._getColorForIndex(i));
            colors[i * 3] = lineColor.r;
            colors[i * 3 + 1] = lineColor.g;
            colors[i * 3 + 2] = lineColor.b;

            // Initial progress
            progressArray[i] = 0;
        }

        // Add instance attributes to geometry
        lineGeometry.setAttribute('instanceStart', new THREE.InstancedBufferAttribute(startPositions, 3));
        lineGeometry.setAttribute('instanceEnd', new THREE.InstancedBufferAttribute(endPositions, 3));
        lineGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
        lineGeometry.setAttribute('instanceProgress', new THREE.InstancedBufferAttribute(progressArray, 1));

        // Create shader material for lines
        const lineMaterial = new THREE.ShaderMaterial({
            uniforms: {
                thickness: { value: this.params.lines.thickness },
                opacity: { value: this.params.lines.opacity },
                glowSize: { value: this.params.lines.glow.size },
                glowIntensity: { value: this.params.lines.glow.intensity },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: this._getLineVertexShader(),
            fragmentShader: this._getLineFragmentShader(),
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending
        });

        // Create instanced mesh
        this.linesMesh = new THREE.InstancedMesh(lineGeometry, lineMaterial, this.params.lines.count);
        this.linesMesh.frustumCulled = false;
        this.linesMesh.renderOrder = 1;
        this.linesMesh.visible = true;
        
        this.add(this.linesMesh);
    }

    /**
     * Gets the line vertex shader code
     * @private
     */
    _getLineVertexShader() {
        return `
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
                vUv = vec2(position.x + 0.5, position.y); // Convert position to UV
                vLineProgress = position.y;
                
                // Calculate current end position based on progress
                vec3 currentEnd = mix(instanceStart, instanceEnd, instanceProgress);
                
                // Calculate line direction
                vec3 dir = normalize(currentEnd - instanceStart);
                
                // Calculate perpendicular vector using camera up direction
                vec3 cameraUp = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);
                vec3 right = normalize(cross(dir, normalize(instanceStart))); // Use position for better orientation
                
                // Calculate position along the line
                vec3 pos = mix(instanceStart, currentEnd, position.y);
                
                // Add thickness offset with view-dependent scaling
                float viewScale = 1.0 - abs(dot(normalize(instanceStart), normalize(cameraUp)));
                pos += right * position.x * thickness * (1.0 + viewScale);
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;
    }

    /**
     * Gets the line fragment shader code
     * @private
     */
    _getLineFragmentShader() {
        return `
            uniform float opacity;
            uniform float glowSize;
            uniform float glowIntensity;
            
            varying vec3 vColor;
            varying float vProgress;
            varying vec2 vUv;
            varying float vLineProgress;
            
            void main() {
                float dist = abs(vUv.x - 0.5);
                
                // Combine calculations to reduce operations
                float finalOpacity = (1.0 - smoothstep(0.0, 0.5, dist)) * 
                                    (1.0 - vLineProgress) * 
                                    opacity;
                
                gl_FragColor = vec4(vColor, finalOpacity);
            }
        `;
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
        // Only update if visible and progress changed significantly
        if (!this.visible || Math.abs(this._lastUpdateProgress - scaledProgress) < 0.001) {
            return;
        }
        this._lastUpdateProgress = scaledProgress;

        if (this.linesMesh) {
            this._updateLines(scaledProgress);
        }
        this._updateCylinder(scaledProgress, this.params.geometry.start, this.params.geometry.end);
    }

    /**
     * Updates the line animations
     * @private
     */
    _updateLines(scaledProgress) {
        const progressAttribute = this.linesMesh.geometry.getAttribute('instanceProgress');
        const data = progressAttribute.array;
        
        for (let i = 0; i < this.params.lines.count; i++) {
            data[i] = scaledProgress;
        }
        
        progressAttribute.needsUpdate = true;
    }

    /**
     * Updates the cylinder animation
     * @private
     */
    _updateCylinder(scaledProgress, start, end) {
        if (!this._shouldUpdateCylinder(scaledProgress)) return;
        
        const { currentLength, currentRadius } = this._calculateCylinderDimensions(scaledProgress, start, end);
        
        if (!this._hasCylinderDimensionsChanged(currentLength, currentRadius)) return;
        
        this._applyCylinderUpdate(currentLength, currentRadius, start);
    }

    /**
     * Calculates the current cylinder dimensions based on progress
     * @private
     */
    _calculateCylinderDimensions(scaledProgress, start, end) {
        const easeProgress = Math.min(1, scaledProgress );
        
        // Match radius progress exactly to length progress
        const radiusProgress = easeProgress;
        
        const totalLength = (end.z - start.z) + (this.params.cylinder.extension * easeProgress);
        const currentLength = THREE.MathUtils.lerp(0, totalLength, easeProgress);
        
        const startRadius = (start.diameter / 2) + this.params.cylinder.radiusOffset;
        const endRadius = (end.diameter / 2) + this.params.cylinder.radiusOffset;
        const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, radiusProgress);
        
        return { currentLength, currentRadius };
    }

    // =========================================
    // Shader Code
    // =========================================

    /**
     * Gets the cylinder vertex shader code
     * @private
     */
    _getCylinderVertexShader() {
        return `
            uniform float radius;
            uniform float height;
            
            void main() {
                vec3 scaled = position;
                scaled.xz *= radius;
                scaled.y *= height;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(scaled, 1.0);
            }
        `;
    }

    /**
     * Gets the cylinder fragment shader code
     * @private
     */
    _getCylinderFragmentShader() {
        return `
            uniform vec3 color;
            uniform float opacity;
            
            void main() {
                gl_FragColor = vec4(color, opacity);
            }
        `;
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
        this._updateCylinder(0, this.params.geometry.start, this.params.geometry.end);
    }

    /**
     * Checks if the cylinder needs updating
     * @private
     */
    _shouldUpdateCylinder(scaledProgress) {
        if (Math.abs(this._lastCylinderProgress - scaledProgress) < 0.001) return false;
        this._lastCylinderProgress = scaledProgress;
        return true;
    }

    /**
     * Checks if cylinder dimensions have changed significantly
     * @private
     */
    _hasCylinderDimensionsChanged(currentLength, currentRadius) {
        if (this._lastLength && Math.abs(this._lastLength - currentLength) < 0.05 &&
            this._lastRadius && Math.abs(this._lastRadius - currentRadius) < 0.05) {
            return false;
        }
        this._lastLength = currentLength;
        this._lastRadius = currentRadius;
        return true;
    }

    /**
     * Applies the cylinder update
     * @private
     */
    _applyCylinderUpdate(currentLength, currentRadius, start) {
        const material = this.productTube.material;
        material.uniforms.radius.value = currentRadius;
        material.uniforms.height.value = currentLength;
        this.productTube.position.z = start.z + (currentLength / 2);
    }
} 