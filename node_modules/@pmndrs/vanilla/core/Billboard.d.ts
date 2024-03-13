import * as THREE from 'three';
export declare type BillboardProps = {
    follow?: boolean;
    lockX?: boolean;
    lockY?: boolean;
    lockZ?: boolean;
};
export declare type BillboardType = {
    group: THREE.Group;
    update: (camera: THREE.Camera) => void;
    updateProps: (newProps: Partial<BillboardProps>) => void;
};
export declare const Billboard: ({ follow, lockX, lockY, lockZ, }?: BillboardProps) => BillboardType;
