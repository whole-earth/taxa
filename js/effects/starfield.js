import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

const DEVICE = {
    MOBILE_BREAKPOINT: 768,
    isMobile: window.innerWidth < 768
};

export const starfieldParams = {
    geometry: {
        start: {
            z: -20,      // Starting depth position
            diameter: 50 // Starting diameter of the starfield circle
        },
        end: {
            z: 60,       // Ending depth position
            diameter: 10 // Final diameter of the starfield circle
        }
    },
    lines: {
        count: DEVICE.isMobile ? 7 : 14,
        thickness: DEVICE.isMobile ? 16 : 11.2,
        opacity: 1.0,
        basePattern: ['gray', 'blue', 'gray', 'green', 'gray', 'blue', 'purple']
    },
    colors: {
        blue: '#b6c9d8',
        purple: '#e8e2ee',
        gray: '#bfc8da',
        green: '#c9e2cf'
    },
    performance: {
        updateFrequency: DEVICE.isMobile ? 2 : 1, // Update every N frames
        progressThreshold: 0.001 // Minimum progress change to trigger update
    }
};


const generateColorPattern = () => {
    const { count, basePattern } = starfieldParams.lines;
    const pattern = [];
    for (let i = 0; i < count; i++) {
        pattern.push(basePattern[i % basePattern.length]);
    }

    return pattern;
};

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

    updateProgress(progress, isInActiveArea = true) {
        if (this.frameCount++ % this.updateFrequency !== 0) return;

        if (!this._shouldUpdate(isInActiveArea)) return;

        const scaledProgress = this._calculateProgress(progress);
        if (!this._hasProgressChanged(scaledProgress)) return;

        this._updateAnimation(scaledProgress);
    }

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
        const points = [];
        // Generate points in clockwise order
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            points.push(new THREE.Vector2(
                Math.cos(angle),
                Math.sin(angle)
            ));
        }
        return points;
    }

    _getColorForIndex(index) {
        const { basePattern } = starfieldParams.lines;
        return basePattern[index % basePattern.length];
    }

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

            // Set color based on clockwise position
            const color = new THREE.Color(this.config.colors[this._getColorForIndex(i)]);
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

    _createShaderMaterial() {
        const { lines } = this.config;
        return new THREE.ShaderMaterial({
            uniforms: {
                thickness: { value: lines.thickness },
                opacity: { value: lines.opacity },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: SHADERS.vertex,
            fragmentShader: SHADERS.fragment,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending
        });
    }

    _shouldUpdate(isInActiveArea) {
        if (!this.visible || !isInActiveArea) {
            if (this.lastProgress !== 0) {
                this._resetProgress();
            }
            return false;
        }
        return true;
    }

    _calculateProgress(progress) {
        const easedProgress = progress < 0.5
            ? 2 * progress * progress // Ease in
            : -1 + (4 - 2 * progress) * progress; // Ease out

        return Math.min(1, easedProgress / 0.8);
    }

    _hasProgressChanged(scaledProgress) {
        if (Math.abs(this.lastProgress - scaledProgress) < 0.0005) return false;
        this.lastProgress = scaledProgress;
        return true;
    }

    _updateAnimation(scaledProgress) {
        if (!this.visible || Math.abs(this._lastUpdateProgress - scaledProgress) < 0.001) {
            return;
        }
        this._lastUpdateProgress = scaledProgress;

        if (this.linesMesh) {
            this._updateLines(scaledProgress);
        }
    }

    _updateLines(scaledProgress) {
        const progressAttribute = this.linesMesh.geometry.getAttribute('instanceProgress');
        const data = progressAttribute.array;

        for (let i = 0; i < this.config.lines.count; i++) {
            data[i] = scaledProgress;
        }

        progressAttribute.needsUpdate = true;
    }

    _resetProgress() {
        this.lastProgress = 0;
        this._updateLines(0);
    }
}