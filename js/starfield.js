import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

export const starfieldParams = {
    lines: {
        count: 60,
        thickness: 0.8,
        opacity: 0.8,
        undulationRatio: 0.5,
        baseLength: 30
    },
    colors: {
        main: '#4a9eff',
        secondary: '#92ffd0',
        tertiary: '#b784ff'
    },
    space: {
        startZ: 0,
        endZ: 3,
        startDiameter: 60,
        endDiameter: 140,
        zVariance: 2
    },
    swirl: {
        points: 20,
        radius: 0.2,
        rotations: 1,
        speed: 0.1
    },
    glow: {
        thickness: 2,
        opacity: 0.2,
        color: '#92ffd0'
    },
    debug: {
        enabled: true,
        ringColor: '#ff0000',
        ringThickness: 1,
        markerCount: 5,
        markerColor: '#ffffff',
        markerSize: 2
    }
};

export class StarField extends THREE.Group {
    constructor(params = starfieldParams) {
        super();
        this.params = params;
        this.lines = [];
        this.time = 0;
        this.debugElements = new THREE.Group();
        this.add(this.debugElements);
        this.init();
    }

    getColorForIndex(index) {
        const pattern = index % 4;
        switch(pattern) {
            case 0:
            case 2:
                return this.params.colors.main;
            case 1:
                return this.params.colors.secondary;
            case 3:
                return this.params.colors.tertiary;
        }
    }

    async init() {
        const { MeshLine, MeshLineMaterial } = await waitForMeshLine();
        this.createStarField(MeshLine, MeshLineMaterial);
        if (this.params.debug.enabled) {
            this.createDebugElements(MeshLine, MeshLineMaterial);
        }
        this.animate();
    }

    createStarField(MeshLine, MeshLineMaterial) {
        const points = this.generateUniformPoints(this.params.lines.count);
        const numUndulatingLines = Math.floor(this.params.lines.count * this.params.lines.undulationRatio);
        const { space } = this.params;

        for (let i = 0; i < this.params.lines.count; i++) {
            const startRadius = space.startDiameter / 2;
            const endRadius = space.endDiameter / 2;
            
            const startPoint = new THREE.Vector3(
                points[i].x * startRadius,
                points[i].y * startRadius,
                space.startZ
            );

            const endPoint = new THREE.Vector3(
                points[i].x * endRadius,
                points[i].y * endRadius,
                space.endZ
            );

            // Create the main line
            const material = new MeshLineMaterial({
                color: this.getColorForIndex(i),
                transparent: true,
                opacity: this.params.lines.opacity,
                depthWrite: false,
                lineWidth: this.params.lines.thickness,
                sizeAttenuation: 1,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
            });

            const line = new MeshLine();
            const mesh = new THREE.Mesh(line, material);
            mesh.renderOrder = -1;

            // Create the glow line
            const glowMaterial = new MeshLineMaterial({
                color: this.params.glow.color,
                transparent: true,
                opacity: this.params.glow.opacity,
                depthWrite: false,
                lineWidth: this.params.lines.thickness * this.params.glow.thickness,
                sizeAttenuation: 1,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
            });

            const glowLine = new MeshLine();
            const glowMesh = new THREE.Mesh(glowLine, glowMaterial);
            glowMesh.renderOrder = -2;
            
            mesh.userData = {
                startPoint,
                endPoint,
                shouldUndulate: i < numUndulatingLines
            };

            glowMesh.userData = { ...mesh.userData };

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

    createDebugElements(MeshLine, MeshLineMaterial) {
        // Create start ring
        const startRing = this.createRing(
            this.params.space.startDiameter,
            this.params.space.startZ,
            MeshLine,
            MeshLineMaterial
        );
        this.debugElements.add(startRing);

        // Create end ring
        const endRing = this.createRing(
            this.params.space.endDiameter,
            this.params.space.endZ,
            MeshLine,
            MeshLineMaterial
        );
        this.debugElements.add(endRing);

    }

    createRing(diameter, zPosition, MeshLine, MeshLineMaterial) {
        const points = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const radius = diameter / 2;
            points.push(new THREE.Vector3(
                Math.cos(theta) * radius,
                Math.sin(theta) * radius,
                zPosition
            ));
        }

        const material = new MeshLineMaterial({
            color: this.params.debug.ringColor,
            lineWidth: this.params.debug.ringThickness,
            sizeAttenuation: 1,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
        });

        const line = new MeshLine();
        line.setPoints(points);
        return new THREE.Mesh(line, material);
    }

    generateLinePoints(start, end, progress, index, shouldUndulate = false) {
        const points = [];
        const { swirl } = this.params;
        const numPoints = swirl.points;
        
        // Always generate all points, but only move them based on progress
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            
            // Calculate the current position for this point based on progress
            // If progress is 0, all points will be at start
            // If progress is 1, points will spread from start to end
            const pointProgress = Math.min(1, progress * (numPoints / (i + 1)));
            const pos = new THREE.Vector3().lerpVectors(start, end, t * pointProgress);

            if (shouldUndulate && pointProgress > 0.1) {
                // Scale undulation based on how far the point has moved from start
                const undulationStrength = (t * pointProgress) ** 2;
                const angle = t * Math.PI * 2 * swirl.rotations + this.time + index * 0.1;
                const undulationRadius = swirl.radius * Math.sin(t * Math.PI) * undulationStrength;
                pos.x += Math.cos(angle) * undulationRadius;
                pos.y += Math.sin(angle) * undulationRadius;
            }

            points.push(pos);
        }

        return points;
    }

    updateProgress(progress) {
        // Only update if progress has changed significantly
        if (Math.abs(this.lastProgress - progress) < 0.001) return;
        this.lastProgress = progress;

        this.lines.forEach(({mesh, line, material, glowMesh, glowLine, glowMaterial}, i) => {
            const { startPoint, endPoint, shouldUndulate } = mesh.userData;
            mesh.userData.currentProgress = progress;
            
            const points = this.generateLinePoints(
                startPoint,
                endPoint,
                progress,
                i,
                shouldUndulate
            );
            
            line.setPoints(points);
            glowLine.setPoints(points);
            
            // Fade in quickly at the start
            const fadeStart = 0.05;
            material.opacity = progress < fadeStart ? 0 : this.params.lines.opacity;
            glowMaterial.opacity = progress < fadeStart ? 0 : this.params.glow.opacity;
            
            material.needsUpdate = true;
            glowMaterial.needsUpdate = true;
        });
    }

    animate() {
        // Only animate if visible
        if (!this.visible) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        this.time += this.params.swirl.speed;
        this.lines.forEach(({mesh, line, glowMesh, glowLine}, i) => {
            const { startPoint, endPoint, shouldUndulate, currentProgress = 1 } = mesh.userData;
            const points = this.generateLinePoints(
                startPoint, 
                endPoint, 
                currentProgress,
                i,
                shouldUndulate
            );
            line.setPoints(points);
            glowLine.setPoints(points);
        });

        requestAnimationFrame(() => this.animate());
    }

    generateUniformPoints(count) {
        const points = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            points.push(new THREE.Vector2(
                Math.cos(angle),
                Math.sin(angle)
            ));
        }
        return points;
    }

    updateFacing(camera) {
        this.quaternion.copy(camera.quaternion);
        // Make debug text always face camera
        if (this.params.debug.enabled) {
            this.debugElements.children.forEach(child => {
                if (child instanceof THREE.Sprite) {
                    child.quaternion.copy(camera.quaternion);
                }
            });
        }
    }
} 