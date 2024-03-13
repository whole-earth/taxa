import * as THREE from 'three';
export declare type OutlinesProps = {
    color: THREE.Color;
    opacity: number;
    transparent: boolean;
    thickness: number;
    angle: number;
};
export declare type OutlinesType = {
    group: THREE.Group;
    updateProps: (props: Partial<OutlinesProps>) => void;
    generate: () => void;
};
export declare function Outlines({ color, opacity, transparent, thickness, angle, }: Partial<OutlinesProps>): OutlinesType;
