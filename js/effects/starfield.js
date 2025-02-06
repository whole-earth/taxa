import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

/**
 * Configuration parameters for the starfield effect
 */
export const starfieldParams = {
    lines: {
        count: window.innerWidth < 768 ? 15 : 20, // Reduce line count on mobile
        thickness: window.innerWidth < 768 ? 2.0 : 1.8, // 2.0 on mobile
        opacity: 0.8,
        glow: {
            enabled: true,
            size: window.innerWidth < 768 ? 4.0 : 3.0,
            intensity: 0.6,
            steps: 6  // Number of gradient steps
        }
    },
    colors: {
        blue: '#4a9eff',
        purple: '#b784ff',
        gray: '#92ffd0',
        green: '#4aff9e'
    },
    geometry: {
        start: {
            z: -50,
            diameter: 80
        },
        end: {
            z: 80,
            diameter: 20
        }
    },
    cylinder: {
        segments: window.innerWidth < 768 ? 32 : 64, // Reduce segments on mobile
        color: '#949494',  // Changed from '#ff00ff' to a dark gray
        opacity: 0.99,
        radiusOffset: 40,  // How much larger than the starfield diameter
        extension: 1000     // How much further the tube extends beyond the end ring
    },
    debug: {
        enabled: false,
        ringColor: '#ff0000',
        ringThickness: 1
    }
};

// Color distribution pattern for the starfield lines (35% blue, 35% purple, 15% gray, 15% green)
const COLOR_PATTERN = [
    'blue', 'blue', 'purple', 'purple', 'blue',
    'purple', 'gray', 'blue', 'purple', 'green',
    'blue', 'purple', 'gray', 'blue', 'purple',
    'green', 'blue', 'purple', 'gray', 'green'
];

/**
 * StarField class creates and manages a 3D starfield effect with animated lines
 * and a surrounding cylinder.
 */
export class StarField extends THREE.Group {
    constructor(params = starfieldParams) {
        super();
        this.params = params;
        this.lines = [];
        this.debugElements = new THREE.Group();
        this.add(this.debugElements);
        
        // Create frustum for culling
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        
        // Initialize reusable objects for calculations
        this._tempVector = new THREE.Vector3();
        this._tempMatrix = new THREE.Matrix4();
        
        this.rotation.set(0, Math.PI, 0);
        
        // Adjust geometry parameters
        this.params.geometry = {
            ...this.params.geometry,
            start: {
                z: 0,
                diameter: this.params.geometry.start.diameter
            },
            end: {
                z: 130,
                diameter: this.params.geometry.end.diameter
            }
        };
        
        this._initProductTube();
        this._init();
    }

    /**
     * Creates the surrounding tube effect for the product visualization
     * @private
     */
    _initProductTube() {
        const { start } = this.params.geometry;
        const radius = (start.diameter / 2) + this.params.cylinder.radiusOffset;
        
        const geometry = new THREE.CylinderGeometry(
            radius,
            radius,
            0.1,
            this.params.cylinder.segments,
            1,
            true
        );
        
        const material = new THREE.MeshBasicMaterial({
            color: this.params.cylinder.color,
            transparent: true,
            opacity: this.params.cylinder.opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending
        });

        this.productTube = new THREE.Mesh(geometry, material);
        this.productTube.position.z = start.z;
        this.productTube.rotation.x = Math.PI / 2;
        this.productTube.renderOrder = -10000;
        
        this.add(this.productTube);
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
        return Array.from({ length: count }, (_, i) => {
            const angle = (i / count) * Math.PI * 2;
            return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
        });
    }

    /**
     * Creates a gradient texture for the glow effect
     * @private
     */
    _createGlowGradient(color) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        
        // Convert hex color to rgb for manipulation
        const c = new THREE.Color(color);
        const steps = this.params.lines.glow.steps;
        
        for (let i = 0; i <= steps; i++) {
            const alpha = i === 0 ? 1 : 1 - (i / steps);
            gradient.addColorStop(i / steps, `rgba(${Math.floor(c.r * 255)}, ${Math.floor(c.g * 255)}, ${Math.floor(c.b * 255)}, ${alpha})`);
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const texture = new THREE.CanvasTexture(
            canvas,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.LinearFilter,
            THREE.LinearFilter
        );
        
        return texture;
    }

    /**
     * Creates the starfield lines with their materials and geometries
     * @private
     */
    async _createStarField(MeshLine, MeshLineMaterial) {
        const points = this._generateUniformPoints(this.params.lines.count);
        const { start, end } = this.params.geometry;

        for (let i = 0; i < this.params.lines.count; i++) {
            const startRadius = start.diameter / 2;
            const endRadius = end.diameter / 2;
            
            const startPoint = new THREE.Vector3(
                points[i].x * startRadius,
                points[i].y * startRadius,
                start.z
            );

            const endPoint = new THREE.Vector3(
                points[i].x * endRadius,
                points[i].y * endRadius,
                end.z
            );

            const lineColor = this._getColorForIndex(i);

            // Create glow material with gradient texture
            const glowMaterial = new MeshLineMaterial({
                useMap: true,
                map: this._createGlowGradient(lineColor),
                transparent: true,
                opacity: this.params.lines.opacity * this.params.lines.glow.intensity,
                depthWrite: false,
                depthTest: true,
                blending: THREE.AdditiveBlending,
                lineWidth: this.params.lines.thickness * this.params.lines.glow.size,
                sizeAttenuation: 1,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
            });

            // Create main line material with original color
            const material = new MeshLineMaterial({
                color: lineColor,
                transparent: true,
                opacity: this.params.lines.opacity,
                depthWrite: false,
                depthTest: true,
                blending: THREE.NormalBlending,
                lineWidth: this.params.lines.thickness,
                sizeAttenuation: 1,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
                dashArray: 0,
                dashOffset: 0,
                dashRatio: 0,
                visibility: 1
            });

            // Create glow line
            const glowLine = new MeshLine();
            glowLine.setPoints([startPoint, startPoint.clone()]);
            const glowMesh = new THREE.Mesh(glowLine, glowMaterial);
            glowMesh.renderOrder = 0;
            glowMesh.frustumCulled = false;
            glowMesh.userData.startPoint = startPoint;
            glowMesh.userData.endPoint = endPoint;

            // Create main line
            const line = new MeshLine();
            line.setPoints([startPoint, startPoint.clone()]);
            const mesh = new THREE.Mesh(line, material);
            mesh.renderOrder = 1;
            mesh.frustumCulled = false;
            mesh.userData.startPoint = startPoint;
            mesh.userData.endPoint = endPoint;

            this.lines.push({ 
                mesh, 
                line, 
                material,
                glowMesh,
                glowLine,
                glowMaterial 
            });
            
            this.add(glowMesh);
            this.add(mesh);
        }
    }

    /**
     * Updates the starfield animation progress
     * @param {number} progress - Animation progress from 0 to 1
     */
    updateProgress(progress) {
        if (!this.visible) return;
        
        const { start, end } = this.params.geometry;
        const scaledProgress = Math.min(1, progress / 0.6);
        
        // Only update if progress has changed significantly
        if (Math.abs(this.lastProgress - scaledProgress) < 0.001) return;
        this.lastProgress = scaledProgress;
        
        // Make sure lines are visible when updating
        this.lines.forEach(({ mesh }) => {
            if (!mesh.visible) mesh.visible = true;
        });
        
        this._updateLines(scaledProgress);
        this._updateCylinder(scaledProgress, start, end);
    }

    /**
     * Updates the individual line animations
     * @private
     */
    _updateLines(scaledProgress) {
        // Update lines in batches with frustum culling
        const batchSize = 40;
        for (let i = 0; i < this.lines.length; i += batchSize) {
            const endIdx = Math.min(i + batchSize, this.lines.length);
            for (let j = i; j < endIdx; j++) {
                const { line, mesh, glowLine, glowMesh } = this.lines[j];
                const startPoint = mesh.userData.startPoint;
                const endPoint = mesh.userData.endPoint;
                
                this._tempVector.lerpVectors(startPoint, endPoint, scaledProgress);
                line.setPoints([startPoint, this._tempVector]);
                glowLine.setPoints([startPoint, this._tempVector]);
            }
        }
    }

    /**
     * Updates the surrounding cylinder animation
     * @private
     */
    _updateCylinder(scaledProgress, start, end) {
        if (Math.abs(this._lastCylinderProgress - scaledProgress) < 0.01) return;
        this._lastCylinderProgress = scaledProgress;
        
        const totalLength = (end.z - start.z) + this.params.cylinder.extension;
        const currentLength = THREE.MathUtils.lerp(0, totalLength, scaledProgress);
        const startRadius = (start.diameter / 2) + this.params.cylinder.radiusOffset;
        const endRadius = (end.diameter / 2) + this.params.cylinder.radiusOffset;
        const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, scaledProgress);

        // Skip update if changes are minimal
        if (this._lastLength && Math.abs(this._lastLength - currentLength) < 0.1 &&
            this._lastRadius && Math.abs(this._lastRadius - currentRadius) < 0.1) {
            return;
        }

        this._lastLength = currentLength;
        this._lastRadius = currentRadius;

        // Adjust segment count based on distance for LOD
        const distance = this.parent?.position.length() || 0;
        const segmentMultiplier = Math.max(0.5, Math.min(1, 50 / distance));
        const segments = Math.max(16, Math.floor(this.params.cylinder.segments * segmentMultiplier));

        const newGeometry = new THREE.CylinderGeometry(
            currentRadius,
            currentRadius,
            currentLength,
            segments,
            1,
            true
        );
        
        if (this.productTube.geometry) {
            this.productTube.geometry.dispose();
        }
        this.productTube.geometry = newGeometry;
        this.productTube.position.z = start.z + (currentLength / 2);
    }

    /**
     * This method is now a no-op to maintain fixed orientation
     * @param {THREE.Camera} camera - The camera (unused)
     */
    updateFacing(camera) {
        // Do nothing - maintain fixed orientation
    }
} 