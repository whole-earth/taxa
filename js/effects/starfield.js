import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

/**
 * Configuration parameters for the starfield effect
 */
export const starfieldParams = {
    lines: {
        count: 25,
        thickness: 1.2,
        opacity: 0.8
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
            diameter: 60
        },
        end: {
            z: 80,
            diameter: 20
        }
    },
    cylinder: {
        segments: 64,
        color: '#ff00ff',
        opacity: 0.99,
        radiusOffset: 15,  // How much larger than the starfield diameter
        extension: 200     // How much further the tube extends beyond the end ring
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
        
        // Ensure the starfield faces the camera
        this.rotation.set(0, Math.PI, 0);
        
        // Adjust the geometry parameters for camera-relative positioning
        this.params.geometry = {
            ...this.params.geometry,
            start: {
                z: 0,  // Start at camera near plane
                diameter: this.params.geometry.start.diameter
            },
            end: {
                z: 130,  // Extend forward from camera
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
            blending: THREE.AdditiveBlending
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
     * Creates the starfield lines with their materials and geometries
     * @private
     */
    _createStarField(MeshLine, MeshLineMaterial) {
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

            const material = new MeshLineMaterial({
                color: this._getColorForIndex(i),
                transparent: true,
                opacity: this.params.lines.opacity,
                depthWrite: false,
                depthTest: true,
                lineWidth: this.params.lines.thickness,
                sizeAttenuation: 1,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
            });

            const line = new MeshLine();
            line.setPoints([startPoint, startPoint]);
            
            const mesh = new THREE.Mesh(line, material);
            mesh.userData.startPoint = startPoint;
            mesh.userData.endPoint = endPoint;

            this.lines.push({ mesh, line, material });
            this.add(mesh);
        }
    }

    /**
     * Updates the starfield animation progress
     * @param {number} progress - Animation progress from 0 to 1
     */
    updateProgress(progress) {
        const { start, end } = this.params.geometry;
        const scaledProgress = Math.min(1, progress / 0.6);
        
        this._updateLines(scaledProgress);
        this._updateCylinder(scaledProgress, start, end);
    }

    /**
     * Updates the individual line animations
     * @private
     */
    _updateLines(scaledProgress) {
        this.lines.forEach(({ line, mesh }) => {
            const startPoint = mesh.userData.startPoint;
            const endPoint = mesh.userData.endPoint;
            
            const currentEnd = new THREE.Vector3().lerpVectors(startPoint, endPoint, scaledProgress);
            line.setPoints([startPoint, currentEnd]);
        });
    }

    /**
     * Updates the surrounding cylinder animation
     * @private
     */
    _updateCylinder(scaledProgress, start, end) {
        const totalLength = (end.z - start.z) + this.params.cylinder.extension;
        const currentLength = THREE.MathUtils.lerp(0, totalLength, scaledProgress);
        const startRadius = (start.diameter / 2) + this.params.cylinder.radiusOffset;
        const endRadius = (end.diameter / 2) + this.params.cylinder.radiusOffset;
        const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, scaledProgress);

        const newGeometry = new THREE.CylinderGeometry(
            currentRadius,
            currentRadius,
            currentLength,
            this.params.cylinder.segments,
            1,
            true
        );
        
        this.productTube.geometry.dispose();
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