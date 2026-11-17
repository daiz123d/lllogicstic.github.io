export function buildBoxLabel(box = {}) {
  if (box.label) return String(box.label);
  if (box.name) return String(box.name);
  if (box.code) return String(box.code);
  if (box.id) return String(box.id);
  const order = box.order || box.itemIndex || box.sourceIndex;
  return order ? `Hộp ${order}` : 'Hộp';
}

export function getContainerRibCount(container = {}) {
  const length = Number(container.length) || 0;
  return Math.max(4, Math.min(24, Math.round(length)));
}

export function computeContainerOffsets(list = [], scale = 100) {
  if (!list.length) return [];

  const gap = 160;
  const cols = Math.ceil(Math.sqrt(list.length));
  const columnWidths = Array(cols).fill(0);
  const rowDepths = Array(Math.ceil(list.length / cols)).fill(0);

  list.forEach((container, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    columnWidths[col] = Math.max(columnWidths[col], (Number(container.width) || 0) * scale);
    rowDepths[row] = Math.max(rowDepths[row], (Number(container.length) || 0) * scale);
  });

  const xStarts = columnWidths.map((_, index) =>
    columnWidths.slice(0, index).reduce((sum, width) => sum + width + gap, 0)
  );
  const zStarts = rowDepths.map((_, index) =>
    rowDepths.slice(0, index).reduce((sum, depth) => sum + depth + gap, 0)
  );

  return list.map((_, index) => ({
    x: xStarts[index % cols],
    z: zStarts[Math.floor(index / cols)]
  }));
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
  const distance = Math.max(span * 1.75, 760);

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
