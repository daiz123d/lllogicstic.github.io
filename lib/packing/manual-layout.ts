import { validateManualPlacement } from '@/src/binPacking.js';

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

  if (axis === 'X') return { ...draft, height: draft.length, length: draft.height, rotation };
  if (axis === 'Y') return { ...draft, width: draft.length, length: draft.width, rotation };
  return { ...draft, width: draft.height, height: draft.width, rotation };
}

export function getAxisAlignedDimensions(
  placement: Pick<Placement, 'width' | 'height' | 'length'>,
  rotation: [number, number, number],
) {
  let { width, height, length } = placement;
  const turns = rotation.map((value) => Math.abs(Math.round(value / (Math.PI / 2))) % 2);
  if (turns[0]) [height, length] = [length, height];
  if (turns[1]) [width, length] = [length, width];
  if (turns[2]) [width, height] = [height, width];
  return { width, height, length };
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
