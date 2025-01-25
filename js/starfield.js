import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

export const starfieldParams = {
    numLines: 80,              // Total number of lines in the star field
    lineThickness: 0.6,        // Thickness of the lines
    colors: {
        main: '#4a9eff',       // Base blue color
        secondary: '#92ffd0',       // Mint green color
        tertiary: '#b784ff'      // Purple color
    },
    baseLength: 10,            // The base forward distance the lines extend
    lengthVarianceRange: 5,    // Random variation in line length
    startDiameter: 180,        // The diameter of the circle where lines start (outer circle)
    endDiameter: 15,          // The diameter of the circle where lines end (inner circle)
    opacity: 0.8,             // Transparency of the lines
    undulationRatio: 0.7,     // Ratio of lines that should undulate (0 to 1)
    distributionMethod: 'fibonacci', // How points are distributed around the circle
    swirl: {
        points: 20,           // Number of points per line for smooth curves
        radius: 0.2,          // Radius of the undulation
        rotations: 1,         // Number of rotations along the line
        speed: 0.01           // Speed of the undulation animation
    },
    glow: {
        thickness: 10,       // How much thicker the glow line is compared to main line
        opacity: 0.2,        // Base opacity of the glow
        color: '#92ffd0'      // Color of the glow
    }
};

export class StarField extends THREE.Group {
    constructor(params = starfieldParams) {
        super();
        this.params = params;
        this.lines = [];
        this.initialPositions = [];
        this.finalPositions = [];
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
        const points = this.generateFibonacciPoints(this.params.numLines);
        const numUndulatingLines = Math.floor(this.params.numLines * this.params.undulationRatio);

        for (let i = 0; i < this.params.numLines; i++) {
            const startPoint = new THREE.Vector3(
                points[i].x * this.params.endDiameter,
                points[i].y * this.params.endDiameter,
                this.params.baseLength  // All lines start at same Z position
            );

            const endPoint = new THREE.Vector3(
                points[i].x * this.params.startDiameter,
                points[i].y * this.params.startDiameter,
                this.params.baseLength * 0.1 + (Math.random() * 2 - 1) * (this.params.lengthVarianceRange * 0.2)
            );

            // Create the main line
            const material = new MeshLineMaterial({
                color: this.getColorForIndex(i),
                transparent: true,
                opacity: this.params.opacity,
                depthWrite: false,
                lineWidth: this.params.lineThickness,
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
                lineWidth: this.params.lineThickness * this.params.glow.thickness,
                sizeAttenuation: 1,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
            });

            const glowLine = new MeshLine();
            const glowMesh = new THREE.Mesh(glowLine, glowMaterial);
            
            // Store data for both meshes
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

            this.initialPositions.push(startPoint.clone());
            this.finalPositions.push(endPoint.clone());
            this.add(glowMesh); // Add glow first so it renders behind
            this.add(mesh);
        }
    }

    generateLinePoints(start, end, progress, index, shouldUndulate = false) {
        const points = [];
        const { swirl } = this.params;
        const numPoints = swirl.points;
        const currentStart = new THREE.Vector3().lerpVectors(end, start, progress);

        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const pos = new THREE.Vector3().lerpVectors(currentStart, end, t);

            if (shouldUndulate) {
                const angle = t * Math.PI * 2 * swirl.rotations + this.time + index * 0.1;
                const undulationRadius = swirl.radius * Math.sin(t * Math.PI); // Fade undulation at ends
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
            const points = this.generateLinePoints(startPoint, endPoint, progress, i, shouldUndulate);
            
            // Update both main line and glow line
            line.setPoints(points);
            glowLine.setPoints(points);
            
            // Calculate opacity based on progress - 0% at start, 100% by 70% progress
            const opacity = progress < 0.7 ? (progress / 0.7) : 1.0;
            material.opacity = opacity * this.params.opacity;
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