import * as THREE from 'three';

// These will be initialized from anim.js
let MeshLine;
let MeshLineMaterial;

// Initialize MeshLine dependencies
export function initMeshLine(deps) {
    MeshLine = deps.MeshLine;
    MeshLineMaterial = deps.MeshLineMaterial;
}

export const starfieldParams = {
    numLines: 100,              // Total number of lines in the star field
    lineThickness: 0.1,        // Actual thickness of the lines (now works with MeshLine!)
    lineColor: '#ff0000',      // Color of the lines (currently red for debugging)
    baseLength: 10,            // The base forward distance the lines extend
    lengthVarianceRange: 5,    // Random variation in line length (±5 units)
    startDiameter: 15,         // The diameter of the circle where lines start
    endDiameter: 60,          // The diameter of the circle where lines end (creates cone effect)
    opacity: 0.6,              // Transparency of the lines (0 = invisible, 1 = solid)
    distributionMethod: 'fibonacci' // How points are distributed around the circle
};

export class StarField extends THREE.Group {
    constructor(params = starfieldParams) {
        super();
        if (!MeshLine || !MeshLineMaterial) {
            throw new Error('MeshLine dependencies not initialized. Call initMeshLine first.');
        }
        this.params = params;
        this.lines = [];
        this.initialPositions = [];
        this.finalPositions = [];
        this.createStarField();
    }

    createStarField() {
        const material = new MeshLineMaterial({
            color: this.params.lineColor,
            transparent: true,
            opacity: this.params.opacity,
            depthWrite: false,
            lineWidth: this.params.lineThickness,
            sizeAttenuation: 1
        });

        // Generate fibonacci points for even distribution
        const points = this.generateFibonacciPoints(this.params.numLines);

        for (let i = 0; i < this.params.numLines; i++) {
            // Create start and end points for each line
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

            // Create the line
            const line = new MeshLine();
            const positions = [startPoint, endPoint];
            line.setPoints(positions);

            // Create the mesh
            const mesh = new THREE.Mesh(line, material);

            this.lines.push({
                mesh,
                line
            });
            this.initialPositions.push(startPoint.clone());
            this.finalPositions.push(endPoint.clone());
            this.add(mesh);
        }
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

    // Method to update line positions based on progress (0 to 1)
    updateProgress(progress) {
        this.lines.forEach(({mesh, line}, i) => {
            const currentEnd = new THREE.Vector3().lerpVectors(
                this.initialPositions[i],
                this.finalPositions[i],
                progress
            );
            
            // Update the line points
            line.setPoints([this.initialPositions[i], currentEnd]);
        });
    }

    // Method to make the star field face the camera
    updateFacing(camera) {
        this.quaternion.copy(camera.quaternion);
    }
} 