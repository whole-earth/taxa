import * as THREE from 'three';
export declare type GridProps = {
    args?: Array<number>;
    cellSize?: number;
    cellThickness?: number;
    cellColor?: THREE.Color;
    sectionSize?: number;
    sectionThickness?: number;
    sectionColor?: THREE.Color;
    followCamera?: boolean;
    infiniteGrid?: boolean;
    fadeDistance?: number;
    fadeStrength?: number;
    side?: THREE.Side;
};
export declare type GridType = {
    mesh: THREE.Mesh;
    update: (camera: THREE.Camera) => void;
};
export declare const Grid: ({ args, cellColor, sectionColor, cellSize, sectionSize, followCamera, infiniteGrid, fadeDistance, fadeStrength, cellThickness, sectionThickness, side, }?: GridProps) => GridType;
