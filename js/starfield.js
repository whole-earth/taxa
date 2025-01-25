import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

export const starfieldParams = {
    lines: {
        count: 180,
        thickness: 0.2,
        opacity: 0.8,
        undulationRatio: 0.9,
        baseLength: 30
    },
    colors: {
        main: '#4a9eff',
        secondary: '#92ffd0',
        tertiary: '#b784ff'
    },
    space: {
        startZ: 3,
        endZ: 20,
        startDiameter: 800,
        endDiameter: 20,
        zVariance: 10
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
    }
};

export class StarField extends THREE.Group {
    constructor(params = starfieldParams) {
        super();
        this.params = params;
        this.lines = [];
        this.time = 0;
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
        this.animate();
    }

    createStarField(MeshLine, MeshLineMaterial) {
        const points = this.generateFibonacciPoints(this.params.lines.count);
        const numUndulatingLines = Math.floor(this.params.lines.count * this.params.lines.undulationRatio);
        const { space } = this.params;

        for (let i = 0; i < this.params.lines.count; i++) {
            const radius = Math.sqrt(points[i].lengthSq()) * space.startDiameter;
            
            const startPoint = new THREE.Vector3(
                points[i].x * radius,
                points[i].y * radius,
                space.startZ
            );

            const endPoint = new THREE.Vector3(
                points[i].x * space.endDiameter,
                points[i].y * space.endDiameter,
                space.endZ + (Math.random() * 2 - 1) * space.zVariance
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
            
            mesh.userData = {
                startPoint,
                endPoint,
                phase: Math.random() * Math.PI * 2,
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

    generateLinePoints(start, end, progress, index, shouldUndulate = false) {
        const points = [];
        const { swirl } = this.params;
        const numPoints = swirl.points;
        const currentEnd = new THREE.Vector3().lerpVectors(end, start, 1 - progress);

        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const pos = new THREE.Vector3().lerpVectors(end, currentEnd, t);

            if (shouldUndulate) {
                const angle = t * Math.PI * 2 * swirl.rotations + this.time + index * 0.1;
                const undulationRadius = swirl.radius * Math.sin(t * Math.PI);
                pos.x += Math.cos(angle) * undulationRadius;
                pos.y += Math.sin(angle) * undulationRadius;
            }

            points.push(pos);
        }

        return points;
    }

    updateProgress(progress) {
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
            
            const fadeStart = 0.05;
            const fadeEnd = 0.8;
            const opacity = progress < fadeStart ? 0 : 
                          progress < fadeEnd ? ((progress - fadeStart) / (fadeEnd - fadeStart)) : 
                          1.0;
            
            material.opacity = opacity * this.params.lines.opacity;
            glowMaterial.opacity = opacity * this.params.glow.opacity;
            
            material.needsUpdate = true;
            glowMaterial.needsUpdate = true;
        });
    }

    animate() {
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

    generateFibonacciPoints(count) {
        const points = [];
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const angleIncrement = Math.PI * 2 * goldenRatio;

        for (let i = 0; i < count; i++) {
            const t = i / count;
            const angle = i * angleIncrement;
            const radius = Math.sqrt(t);
            
            points.push(new THREE.Vector2(
                radius * Math.cos(angle),
                radius * Math.sin(angle)
            ));
        }

        return points;
    }

    updateFacing(camera) {
        this.quaternion.copy(camera.quaternion);
    }
} 