import { shaderMaterial } from '../core/shaderMaterial.js';

const MeshDiscardMaterial = shaderMaterial({}, 'void main() { }', 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); discard;  }');

export { MeshDiscardMaterial };
