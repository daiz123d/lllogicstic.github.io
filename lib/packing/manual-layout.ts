import { validateManualPlacement } from '@/src/binPacking.js';
import { Euler, Matrix4 } from 'three';

import type { PackedContainer, Placement } from './types';

export type ManualAxis = 'X' | 'Y' | 'Z';
export type ManualTransformMode = 'translate' | 'rotate';
export type ManualSnap = .01 | .05 | .10;
export type PlacementOverride = Pick<Placement, 'x' | 'y' | 'z' | 'width' | 'height' | 'length'>;
export type PlacementDraft = PlacementOverride & { rotation: [number, number, number] };
export type PlacementValidation = { valid: boolean; errors: string[] };

const errorLabels: Record<string, string> = {
  'invalid-number': 'Giá trị không hợp lệ',
  bounds: 'Vượt khỏi container',
  'out-of-bounds': 'Vượt khỏi container',
  collision: 'Va chạm kiện khác',
  unsupported: 'Không có bề mặt đỡ',
  'non-stackable-support': 'Đặt lên kiện không cho phép chồng',
  'non-stackable-floor': 'Kiện này phải nằm trên sàn',
  overweight: 'Vượt tải trọng container',
};

function keyFor(containerId: string, placement: Placement) {
  return `${containerId}:${placement.order}`;
}

export function createPlacementDraft(placement: Placement): PlacementDraft {
  return {
    x: placement.x,
    y: placement.y,
    z: placement.z,
    width: placement.width,
    height: placement.height,
    length: placement.length,
    rotation: [0, 0, 0],
  };
}

export function rotatePlacementDraft(draft: PlacementDraft, axis: ManualAxis): PlacementDraft {
  const rotation: [number, number, number] = [...draft.rotation];
  const index = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  rotation[index] += Math.PI / 2;
  const dimensions = getAxisAlignedDimensions(getUnrotatedDimensions(draft), rotation);

  return { ...draft, ...dimensions, rotation };
}

function normalizeExtent(value: number) {
  return Math.round(value * 1e12) / 1e12;
}

function getRotationElements(rotation: [number, number, number]) {
  return new Matrix4().makeRotationFromEuler(new Euler(...rotation, 'XYZ')).elements;
}

function getUnrotatedDimensions(draft: PlacementDraft) {
  const matrix = getRotationElements(draft.rotation);
  return {
    width: normalizeExtent(Math.abs(matrix[0]) * draft.width + Math.abs(matrix[1]) * draft.height + Math.abs(matrix[2]) * draft.length),
    height: normalizeExtent(Math.abs(matrix[4]) * draft.width + Math.abs(matrix[5]) * draft.height + Math.abs(matrix[6]) * draft.length),
    length: normalizeExtent(Math.abs(matrix[8]) * draft.width + Math.abs(matrix[9]) * draft.height + Math.abs(matrix[10]) * draft.length),
  };
}

export function getAxisAlignedDimensions(
  placement: Pick<Placement, 'width' | 'height' | 'length'>,
  rotation: [number, number, number],
) {
  const matrix = getRotationElements(rotation);
  const { width, height, length } = placement;

  return {
    width: normalizeExtent(Math.abs(matrix[0]) * width + Math.abs(matrix[4]) * height + Math.abs(matrix[8]) * length),
    height: normalizeExtent(Math.abs(matrix[1]) * width + Math.abs(matrix[5]) * height + Math.abs(matrix[9]) * length),
    length: normalizeExtent(Math.abs(matrix[2]) * width + Math.abs(matrix[6]) * height + Math.abs(matrix[10]) * length),
  };
}

export function validatePlacementDraft(
  container: PackedContainer['container'],
  placements: Placement[],
  selected: Placement,
  draft: PlacementOverride,
): PlacementValidation {
  const normalizedPlacements = placements.map((placement) => ({
    ...placement,
    id: undefined,
    boxKey: keyFor(container.id, placement),
  }));
  const candidate = {
    ...selected,
    ...draft,
    id: undefined,
    boxKey: keyFor(container.id, selected),
  };
  const validation = validateManualPlacement(container, normalizedPlacements, candidate) as { valid: boolean; errors?: string[] };

  return {
    valid: validation.valid,
    errors: (validation.errors ?? []).map((error) => errorLabels[error] ?? error),
  };
}

export function applyPlacementOverride(
  packedContainer: PackedContainer,
  selectedKey: string,
  override: PlacementOverride,
): PackedContainer {
  const packed = packedContainer.packed.map((placement) => keyFor(packedContainer.container.id, placement) === selectedKey
    ? { ...placement, ...override }
    : placement);

  return { ...packedContainer, packed };
}

export function toPlacementOverride(draft: PlacementDraft): PlacementOverride {
  const { x, y, z, width, height, length } = draft;
  return { x, y, z, width, height, length };
}
