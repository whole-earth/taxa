import * as THREE from "three";

const isMobile = window.innerWidth < 768;

const zoomStreakConfig = {
  geometry: {
    start: {
      z: -10, // Starting depth position
      diameter: 50, // Starting diameter of the streak ring
    },
    end: {
      z: 60, // Ending depth position
      diameter: 10, // Final diameter of the streak ring
    },
  },
  lines: {
    count: isMobile ? 7 : 14,
    thickness: isMobile ? 16 : 11.2,
    opacity: 1.0,
    basePattern: ["gray", "blue", "gray", "green", "gray", "blue", "purple"],
  },
  colors: {
    blue: "#b6c9d8",
    purple: "#e8e2ee",
    gray: "#bfc8da",
    green: "#c9e2cf",
  },
};

const SHADERS = {
  vertex: `
        attribute vec3 instanceStart;
        attribute vec3 instanceEnd;
        attribute vec3 instanceColor;
        uniform float progress;
        
        uniform float thickness;
        
        varying vec3 vColor;
        varying vec2 vUv;
        varying float vLineProgress;
        
        void main() {
            vColor = instanceColor;
            vUv = vec2(position.x + 0.5, position.y);
            vLineProgress = position.y;
            
            vec3 currentEnd = mix(instanceStart, instanceEnd, progress);
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
        varying vec2 vUv;
        varying float vLineProgress;
        
        void main() {
            float dist = abs(vUv.x - 0.5);
            float finalOpacity = (1.0 - smoothstep(0.0, 0.5, dist)) * 
                                (1.0 - vLineProgress) * 
                                opacity;
            
            gl_FragColor = vec4(vColor, finalOpacity);
        }
    `,
};

export class ZoomStreaks extends THREE.Group {
  constructor(params = zoomStreakConfig) {
    super();
    this.config = params;

    this.rotation.set(0, Math.PI, 0);
    this.createMesh();
    this.lastProgress = -1;
  }

  updateProgress(progress) {
    const value = this.visible ? this.easeProgress(progress) : 0;
    if (value === this.lastProgress) return;
    this.lastProgress = value;
    this.linesMesh.material.uniforms.progress.value = value;
  }

  createPoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push(new THREE.Vector2(Math.cos(angle), Math.sin(angle)));
    }
    return points;
  }

  colorAt(index) {
    const { basePattern } = this.config.lines;
    return basePattern[index % basePattern.length];
  }

  createMesh() {
    const { lines } = this.config;
    const points = this.createPoints(lines.count);

    const lineGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0,
    ]);
    const indices = new Uint16Array([0, 2, 1, 1, 2, 3]);
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    lineGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.setInstanceAttributes(lineGeometry, points);

    const material = this.createMaterial();

    this.linesMesh = new THREE.InstancedMesh(
      lineGeometry,
      material,
      lines.count,
    );
    this.linesMesh.frustumCulled = false;
    this.linesMesh.renderOrder = 1;
    this.add(this.linesMesh);
  }

  setInstanceAttributes(geometry, points) {
    const { lines, geometry: geo } = this.config;
    const startPositions = new Float32Array(lines.count * 3);
    const endPositions = new Float32Array(lines.count * 3);
    const colors = new Float32Array(lines.count * 3);

    for (let i = 0; i < lines.count; i++) {
      const startRadius = geo.start.diameter / 2;
      const endRadius = geo.end.diameter / 2;

      const idx = i * 3;
      startPositions[idx] = points[i].x * startRadius;
      startPositions[idx + 1] = points[i].y * startRadius;
      startPositions[idx + 2] = geo.start.z;

      endPositions[idx] = points[i].x * endRadius;
      endPositions[idx + 1] = points[i].y * endRadius;
      endPositions[idx + 2] = geo.end.z;

      const color = new THREE.Color(this.config.colors[this.colorAt(i)]);
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }

    geometry.setAttribute(
      "instanceStart",
      new THREE.InstancedBufferAttribute(startPositions, 3),
    );
    geometry.setAttribute(
      "instanceEnd",
      new THREE.InstancedBufferAttribute(endPositions, 3),
    );
    geometry.setAttribute(
      "instanceColor",
      new THREE.InstancedBufferAttribute(colors, 3),
    );
  }

  createMaterial() {
    const { lines } = this.config;
    return new THREE.ShaderMaterial({
      uniforms: {
        progress: { value: 0 },
        thickness: { value: lines.thickness },
        opacity: { value: lines.opacity },
      },
      vertexShader: SHADERS.vertex,
      fragmentShader: SHADERS.fragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
  }

  easeProgress(progress) {
    const easedProgress =
      progress < 0.5
        ? 2 * progress * progress // Ease in
        : -1 + (4 - 2 * progress) * progress; // Ease out

    return Math.min(1, easedProgress / 0.8);
  }
}
