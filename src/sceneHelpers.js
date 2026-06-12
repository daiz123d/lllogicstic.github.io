export function buildBoxLabel(box = {}) {
  if (box.label) return String(box.label);
  const order = box.order || box.itemIndex || box.sourceIndex;
  return order ? `#${order}` : '#';
}

export function getContainerRibCount(container = {}) {
  const length = Number(container.length) || 0;
  return Math.max(4, Math.min(24, Math.round(length)));
}

export function getCameraPlacement(containerList = [], offsets = [], view = 'iso', scale = 100) {
  if (!containerList.length) {
    return {
      position: { x: 600, y: 500, z: 600 },
      target: { x: 0, y: 0, z: 0 }
    };
  }

  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  let maxDim = 0;
  let maxY = 0;

  containerList.forEach((container, index) => {
    const offset = offsets[index] || { x: 0, z: 0 };
    const width = (Number(container.width) || 0) * scale;
    const height = (Number(container.height) || 0) * scale;
    const length = (Number(container.length) || 0) * scale;
    minX = Math.min(minX, offset.x);
    minZ = Math.min(minZ, offset.z);
    maxX = Math.max(maxX, offset.x + width);
    maxZ = Math.max(maxZ, offset.z + length);
    maxDim = Math.max(maxDim, width, height, length);
    maxY = Math.max(maxY, height);
  });

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const target = { x: centerX, y: maxY / 2, z: centerZ };
  const span = Math.max(maxX - minX, maxZ - minZ, maxY, maxDim);
  const distance = Math.max(span * 2.15, 900);

  if (view === 'top') {
    return {
      position: { x: centerX, y: maxY + distance * 1.4, z: centerZ },
      target
    };
  }

  if (view === 'side') {
    return {
      position: { x: centerX + distance, y: maxY * 0.72 + distance * 0.12, z: centerZ },
      target
    };
  }

  if (view === 'front') {
    return {
      position: { x: centerX, y: maxY * 0.72 + distance * 0.12, z: centerZ + distance },
      target
    };
  }

  return {
    position: { x: centerX + distance, y: maxY + distance * 0.42, z: centerZ + distance },
    target
  };
}
