import * as THREE from 'three';

const Billboard = ({
  follow = true,
  lockX = false,
  lockY = false,
  lockZ = false
} = {}) => {
  const group = new THREE.Group();
  const props = {
    follow,
    lockX,
    lockY,
    lockZ
  };
  function update(camera) {
    const {
      follow,
      lockX,
      lockY,
      lockZ
    } = props;
    if (!follow) return;
    // save previous rotation in case we're locking an axis
    const prevRotation = group.rotation.clone();

    // always face the camera
    camera.getWorldQuaternion(group.quaternion);

    // readjust any axis that is locked
    if (lockX) group.rotation.x = prevRotation.x;
    if (lockY) group.rotation.y = prevRotation.y;
    if (lockZ) group.rotation.z = prevRotation.z;
  }
  return {
    group,
    update,
    updateProps(newProps) {
      Object.assign(props, newProps);
    }
  };
};

export { Billboard };
