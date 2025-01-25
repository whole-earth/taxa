import * as THREE from 'three';
import { waitForMeshLine } from 'three.meshline';

export const starfieldParams = {
    numLines: 100,              // Total number of lines in the star field
    lineThickness: 0.15,       // Thickness of the lines
    lineColor: '#4a9eff',      // Base color of the lines
    baseLength: 10,            // The base forward distance the lines extend
    lengthVarianceRange: 5,    // Random variation in line length
    startDiameter: 15,         // The diameter of the circle where lines start
    endDiameter: 60,          // The diameter of the circle where lines end
    opacity: 0.6,             // Transparency of the lines
    distributionMethod: 'fibonacci', // How points are distributed around the circle
    swirl: {
        points: 20,           // Number of points per line for smooth curves
        radius: 0.5,          // Radius of the undulation
        rotations: 0.5,       // Number of rotations along the line
        speed: 0.005          // Speed of the undulation animation
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

    async init() {
        const { MeshLine, MeshLineMaterial } = await waitForMeshLine();
        this.createStarField(MeshLine, MeshLineMaterial);
        this.animate();
    }

    createStarField(MeshLine, MeshLineMaterial) {
        const points = this.generateFibonacciPoints(this.params.numLines);

        for (let i = 0; i < this.params.numLines; i++) {
            const startPoint = new THREE.Vector3(
                points[i].x * this.params.startDiameter,
                points[i].y * this.params.startDiameter,
                0
            );

            const endPoint = new THREE.Vector3(
                points[i].x * this.params.endDiameter,
                points[i].y * this.params.endDiameter,
                this.params.baseLength + (Math.random() * 2 - 1) * this.params.lengthVarianceRange
            );

            // Create a new material for each line
            const material = new MeshLineMaterial({
                color: this.params.lineColor,
                transparent: true,
                opacity: this.params.opacity,
                depthWrite: false,
                lineWidth: this.params.lineThickness,
                sizeAttenuation: 1,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
            });

            const line = new MeshLine();
            const mesh = new THREE.Mesh(line, material);
            
            // Only make half the lines undulate
            mesh.userData = {
                startPoint,
                endPoint,
                phase: Math.random() * Math.PI * 2,
                shouldUndulate: i < this.params.numLines / 2
            };

            this.lines.push({
                mesh,
                line,
                material
            });
            this.initialPositions.push(startPoint.clone());
            this.finalPositions.push(endPoint.clone());
            this.add(mesh);
        }
    }

    generateLinePoints(start, end, progress, index, shouldUndulate = false) {
        const points = [];
        const { swirl } = this.params;
        const numPoints = swirl.points;

        // Calculate the current end point based on progress
        const currentEnd = new THREE.Vector3().lerpVectors(start, end, progress);

        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const pos = new THREE.Vector3().lerpVectors(start, currentEnd, t);

            if (shouldUndulate) {
                // Add gentle undulation only to selected lines
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
        this.lines.forEach(({mesh, line}, i) => {
            const { startPoint, endPoint, shouldUndulate } = mesh.userData;
            const points = this.generateLinePoints(startPoint, endPoint, progress, i, shouldUndulate);
            line.setPoints(points);
        });
    }

    animate() {
        this.time += this.params.swirl.speed;
        
        // Only update the undulating lines during animation
        this.lines.forEach(({mesh, line}, i) => {
            const { startPoint, endPoint, shouldUndulate } = mesh.userData;
            if (shouldUndulate) {
                const points = this.generateLinePoints(
                    startPoint, 
                    endPoint, 
                    1, // Use full length during animation
                    i,
                    true
                );
                line.setPoints(points);
            }
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

    // Method to make the star field face the camera
    updateFacing(camera) {
        this.quaternion.copy(camera.quaternion);
    }
} 