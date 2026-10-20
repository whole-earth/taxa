import * as THREE from "three";
import { Tween, Easing } from "tween";
import { state } from "../core/state.js";

const SIZES = [0.06, 0.1, 0.14, 0.18, 0.2];
const ROTATIONS = [
  [-1, 0.08],
  [-Math.PI / 2, 0.06],
  [Math.PI / 12, 0.05],
  [-Math.PI / 4, 0.06],
  [Math.PI / 3, 0.06],
];

export class SpeckleSystem {
  constructor(scene, radius, cellObject) {
    this.isMobile = window.innerWidth < 768;
    this.radius = radius;
    this.wavingBlob = new THREE.Group();
    this.wavingBlob.visible = false;
    cellObject.add(this.wavingBlob);
    this.geometry = new THREE.SphereGeometry(
      1,
      this.isMobile ? 6 : 8,
      this.isMobile ? 6 : 8,
    );
    this.instancedMeshes = [];
    this.materials = [];
    this.axes = ROTATIONS.map(
      ([angle]) => new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0),
    );
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.tweens = new Set();
    for (const size of this.isMobile ? [0.3] : SIZES) {
      const material = new THREE.MeshBasicMaterial({
        color: "#ffbb65",
        opacity: 0,
        transparent: true,
        depthWrite: false,
        precision: "lowp",
        fog: false,
      });
      const mesh = new THREE.InstancedMesh(
        this.geometry,
        material,
        this.isMobile ? 200 : 120,
      );
      mesh.userData.size = size;
      mesh.renderOrder = 2;
      // The rotating group remains inside a small, known sphere. Avoid
      // stale automatically cached instance bounds after randomization.
      mesh.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(),
        radius + size,
      );
      this.instancedMeshes.push(mesh);
      this.materials.push(material);
      this.wavingBlob.add(mesh);
    }
    this.randomizePositions();
  }

  get animated() {
    return (
      !this.isMobile &&
      this.wavingBlob.visible &&
      this.wavingBlob.parent.visible &&
      this.instancedMeshes.some(
        (mesh) => mesh.visible && mesh.material.opacity > 0,
      )
    );
  }

  updatePositions(time) {
    if (!this.animated) return;
    // Identical tilted-axis orbital motion, expressed once per group instead
    // of decomposing/recomposing and uploading all 600 instance matrices.
    this.instancedMeshes.forEach((mesh, index) => {
      if (mesh.visible && mesh.material.opacity > 0) {
        mesh.quaternion.setFromAxisAngle(
          this.axes[index],
          time * 0.001 * ROTATIONS[index][1],
        );
      }
    });
  }

  randomizePositions() {
    for (const mesh of this.instancedMeshes) {
      for (let i = 0; i < mesh.count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.cbrt(Math.random()) * this.radius;
        this.position.set(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        );
        this.matrix
          .makeScale(mesh.userData.size, mesh.userData.size, mesh.userData.size)
          .setPosition(this.position);
        mesh.setMatrixAt(i, this.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  cancel() {
    for (const tween of this.tweens) {
      tween.stop();
      state.tweens.remove(tween);
    }
    this.tweens.clear();
  }

  tween(target, values, duration, delay = 0, complete) {
    const tween = new Tween(target, state.tweens)
      .to(values, duration)
      .delay(delay)
      .easing(Easing.Quadratic.InOut)
      .onComplete(() => {
        this.tweens.delete(tween);
        complete?.();
      });
    this.tweens.add(tween);
    tween.start();
    state.app.invalidate();
  }

  show(color, duration = 400) {
    this.cancel();
    const reveal = () => {
      // Change positions and color only while every group is invisible.
      this.randomizePositions();
      this.wavingBlob.visible = true;
      this.instancedMeshes.forEach((mesh) => {
        mesh.visible = true;
        mesh.scale.setScalar(1);
        mesh.material.color.set(color);
        if (duration === 0) mesh.material.opacity = 1;
        else this.tween(mesh.material, { opacity: 1 }, duration);
      });
      state.app.invalidate();
    };
    if (
      duration === 0 ||
      !this.wavingBlob.visible ||
      this.materials.every((material) => material.opacity === 0)
    ) {
      reveal();
      return;
    }
    // Completion callbacks belong to cancellable tweens, so reversing or
    // leaving the chapter cannot reveal an outdated topic later.
    let remaining = this.materials.length;
    this.materials.forEach((material) => {
      this.tween(material, { opacity: 0 }, 180, 0, () => {
        if (--remaining === 0) reveal();
      });
    });
  }

  hide(duration = 180) {
    this.cancel();
    this.materials.forEach((material) =>
      this.tween(material, { opacity: 0 }, duration),
    );
  }

  explode() {
    this.cancel();
    this.instancedMeshes.forEach((mesh, index) => {
      const delay = this.isMobile ? 0 : [16, 320, 720, 1120, 1440][index];
      const duration = this.isMobile ? 2112 : 1600 - delay;
      this.tween(
        mesh.scale,
        {
          x: this.isMobile ? 1.5 : 1.8,
          y: this.isMobile ? 1.5 : 1.8,
          z: this.isMobile ? 1.5 : 1.8,
        },
        duration,
        delay,
      );
      this.tween(mesh.material, { opacity: 0 }, duration, delay, () => {
        mesh.visible = false;
      });
    });
  }
}
