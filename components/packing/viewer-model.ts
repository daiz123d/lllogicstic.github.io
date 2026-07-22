import type { PackedContainer, Placement } from '@/lib/packing/types';

import type { CameraFrame, EmptyRegion, ViewerMetrics, ViewPreset } from './viewer-types';

type ContainerBounds = Pick<PackedContainer['container'], 'width' | 'height' | 'length'>;

const COVERAGE = .75;
const ELEVATION = 32;
const MAX_EMPTY_CELLS = 18_000;
const MAX_EMPTY_REGIONS = 256;

export function getCameraFrame(bounds: ContainerBounds, preset: ViewPreset, viewportWidth: number, viewportHeight: number): CameraFrame {
  const target: [number, number, number] = [bounds.width / 2, bounds.height / 2, bounds.length / 2];
  const elevationRadians = ELEVATION * Math.PI / 180;
  const horizontalProjection = Math.SQRT1_2 * (bounds.width + bounds.length);
  const verticalProjection = Math.SQRT1_2 * Math.sin(elevationRadians) * (bounds.width + bounds.length) + Math.cos(elevationRadians) * bounds.height;
  const projected = preset === 'iso'
    ? { width: horizontalProjection, height: verticalProjection }
    : preset === 'top'
      ? { width: bounds.width, height: bounds.length }
      : preset === 'front'
        ? { width: bounds.width, height: bounds.height }
        : { width: bounds.length, height: bounds.height };
  const zoom = Math.min(
    COVERAGE * Math.max(viewportWidth, 1) / Math.max(projected.width, Number.EPSILON),
    COVERAGE * Math.max(viewportHeight, 1) / Math.max(projected.height, Number.EPSILON),
  );
  const distance = Math.max(bounds.width, bounds.height, bounds.length, 1) * 2;
  const isoHorizontalOffset = distance * Math.cos(elevationRadians) * Math.SQRT1_2;
  const position: [number, number, number] = preset === 'iso'
    ? [target[0] + isoHorizontalOffset, target[1] + distance * Math.sin(elevationRadians), target[2] + isoHorizontalOffset]
    : preset === 'top'
      ? [target[0], target[1] + distance, target[2]]
      : preset === 'front'
        ? [target[0], target[1], target[2] + distance]
        : [target[0] + distance, target[1], target[2]];

  return { target, position, zoom, coverage: COVERAGE, elevation: ELEVATION };
}

export function getViewerMetrics(container: PackedContainer, visibleCount: number): ViewerMetrics {
  const visible = container.packed.slice(0, Math.max(0, visibleCount));
  const containerVolume = container.container.width * container.container.height * container.container.length;
  const usedVolume = visible.reduce((sum, box) => sum + box.width * box.height * box.length, 0);
  const usedWeight = visible.reduce((sum, box) => sum + box.weight, 0);

  return {
    usedVolume,
    volumePercent: containerVolume ? Math.min(100, usedVolume / containerVolume * 100) : 0,
    usedWeight,
    maxWeight: container.container.maxWeight,
    weightPercent: container.container.maxWeight ? Math.min(100, usedWeight / container.container.maxWeight * 100) : 0,
    packed: visible.length,
    total: container.packed.length + container.unpacked.length,
    floorOnly: visible.filter((box) => !box.stackable).length,
  };
}

export function getHeatColor(mode: 'weight' | 'height', value: number): string {
  const stops = mode === 'weight'
    ? ['#10b981', '#f59e0b', '#ef4444']
    : ['#38bdf8', '#a78bfa', '#fb7185'];
  const index = Math.round(Math.min(1, Math.max(0, value)) * (stops.length - 1));
  return stops[index];
}

export function getEmptyRegions(container: PackedContainer, enabled: boolean): EmptyRegion[] {
  if (!enabled) return [];

  const { width, height, length } = container.container;
  if (width <= 0 || height <= 0 || length <= 0) return [];
  const cellSize = getCellSize(width, height, length);
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const depths = Math.ceil(length / cellSize);
  const occupied = new Uint8Array(columns * rows * depths);
  const indexOf = (x: number, y: number, z: number) => (z * rows + y) * columns + x;

  for (const placement of container.packed) markOccupied(occupied, placement, cellSize, columns, rows, depths, indexOf);

  const regions: EmptyRegion[] = [];
  for (let z = 0; z < depths; z += 1) for (let y = 0; y < rows; y += 1) for (let x = 0; x < columns; x += 1) {
    if (occupied[indexOf(x, y, z)]) continue;
    const xEnd = growX(occupied, x, y, z, columns, indexOf);
    const zEnd = growZ(occupied, x, xEnd, y, z, depths, indexOf);
    const yEnd = growY(occupied, x, xEnd, y, z, zEnd, rows, indexOf);
    fill(occupied, x, xEnd, y, yEnd, z, zEnd, indexOf);
    regions.push({
      id: `empty-${regions.length}`,
      x: x * cellSize,
      y: y * cellSize,
      z: z * cellSize,
      width: Math.min(width, xEnd * cellSize) - x * cellSize,
      height: Math.min(height, yEnd * cellSize) - y * cellSize,
      length: Math.min(length, zEnd * cellSize) - z * cellSize,
    });
    if (regions.length === MAX_EMPTY_REGIONS) return regions;
  }
  return regions;
}

function getCellSize(width: number, height: number, length: number): number {
  let cellSize = .25;
  while (Math.ceil(width / cellSize) * Math.ceil(height / cellSize) * Math.ceil(length / cellSize) > MAX_EMPTY_CELLS) cellSize *= 1.1;
  return cellSize;
}

function markOccupied(occupied: Uint8Array, placement: Placement, cellSize: number, columns: number, rows: number, depths: number, indexOf: (x: number, y: number, z: number) => number) {
  const xStart = clamp(Math.floor(placement.x / cellSize), 0, columns);
  const yStart = clamp(Math.floor(placement.y / cellSize), 0, rows);
  const zStart = clamp(Math.floor(placement.z / cellSize), 0, depths);
  const xEnd = clamp(Math.ceil((placement.x + placement.width) / cellSize), 0, columns);
  const yEnd = clamp(Math.ceil((placement.y + placement.height) / cellSize), 0, rows);
  const zEnd = clamp(Math.ceil((placement.z + placement.length) / cellSize), 0, depths);
  fill(occupied, xStart, xEnd, yStart, yEnd, zStart, zEnd, indexOf);
}

function growX(occupied: Uint8Array, x: number, y: number, z: number, columns: number, indexOf: (x: number, y: number, z: number) => number) {
  let end = x;
  while (end < columns && !occupied[indexOf(end, y, z)]) end += 1;
  return end;
}

function growZ(occupied: Uint8Array, xStart: number, xEnd: number, y: number, z: number, depths: number, indexOf: (x: number, y: number, z: number) => number) {
  let end = z + 1;
  while (end < depths && isFree(occupied, xStart, xEnd, y, y + 1, end, end + 1, indexOf)) end += 1;
  return end;
}

function growY(occupied: Uint8Array, xStart: number, xEnd: number, y: number, zStart: number, zEnd: number, rows: number, indexOf: (x: number, y: number, z: number) => number) {
  let end = y + 1;
  while (end < rows && isFree(occupied, xStart, xEnd, end, end + 1, zStart, zEnd, indexOf)) end += 1;
  return end;
}

function isFree(occupied: Uint8Array, xStart: number, xEnd: number, yStart: number, yEnd: number, zStart: number, zEnd: number, indexOf: (x: number, y: number, z: number) => number) {
  for (let z = zStart; z < zEnd; z += 1) for (let y = yStart; y < yEnd; y += 1) for (let x = xStart; x < xEnd; x += 1) if (occupied[indexOf(x, y, z)]) return false;
  return true;
}

function fill(occupied: Uint8Array, xStart: number, xEnd: number, yStart: number, yEnd: number, zStart: number, zEnd: number, indexOf: (x: number, y: number, z: number) => number) {
  for (let z = zStart; z < zEnd; z += 1) for (let y = yStart; y < yEnd; y += 1) for (let x = xStart; x < xEnd; x += 1) occupied[indexOf(x, y, z)] = 1;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
