import { describe, expect, it } from 'vitest';

import {
  applyPlacementOverride,
  createPlacementDraft,
  getAxisAlignedDimensions,
  rotatePlacementDraft,
  toPlacementOverride,
  validatePlacementDraft,
} from '@/lib/packing/manual-layout';
import type { PackedContainer, Placement } from '@/lib/packing/types';

const container: PackedContainer['container'] = {
  id: 'container-1', name: 'Container 1', width: 4, height: 3, length: 5, maxWeight: 20,
};

const selected: Placement = {
  id: 'box', label: 'Kiện 1', width: 1, height: 1, length: 2, color: '#22d3ee', weight: 4,
  stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0,
};

const other: Placement = {
  ...selected, label: 'Kiện 2', x: 1, order: 2, itemIndex: 1, weight: 3,
};

describe('manual placement layout adapter', () => {
  it('maps manual validation errors and blocks an invalid draft', () => {
    const result = validatePlacementDraft(container, [selected, other], selected, { ...selected, x: -1 });

    expect(result).toEqual({ valid: false, errors: ['Vượt khỏi container'] });
  });

  it('maps every legacy validation error to a stable label', () => {
    const floorOnly = { ...selected, stackable: false };
    const above = { ...other, x: 0, y: 1, z: 0, width: 1, length: 2 };
    const cases = [
      validatePlacementDraft(container, [selected], selected, { ...selected, x: Number.NaN }),
      validatePlacementDraft(container, [selected, other], selected, { ...selected, x: 1 }),
      validatePlacementDraft(container, [selected], selected, { ...selected, x: 2, y: 1 }),
      validatePlacementDraft(container, [floorOnly], floorOnly, { ...floorOnly, y: 1 }),
      validatePlacementDraft(container, [floorOnly, above], floorOnly, floorOnly),
      validatePlacementDraft({ ...container, maxWeight: 5 }, [selected, other], selected, selected),
    ];

    expect(cases[0].errors).toContain('Giá trị không hợp lệ');
    expect(cases[1].errors).toContain('Va chạm kiện khác');
    expect(cases[2].errors).toContain('Không có bề mặt đỡ');
    expect(cases[3].errors).toContain('Kiện này phải nằm trên sàn');
    expect(cases[4].errors).toContain('Đặt lên kiện không cho phép chồng');
    expect(cases[5].errors).toContain('Vượt tải trọng container');
  });

  it('uses placement keys to ignore only the selected candidate when carton ids repeat', () => {
    const repeatedId = { ...other, x: 0, z: 2 };

    expect(validatePlacementDraft(container, [selected, repeatedId], selected, selected)).toEqual({ valid: true, errors: [] });
    expect(validatePlacementDraft(container, [selected, repeatedId], selected, { ...selected, z: 2 })).toEqual({ valid: false, errors: ['Va chạm kiện khác'] });
  });

  it('normalizes quarter-turn rotations into axis-aligned dimension swaps', () => {
    const draft = createPlacementDraft(selected);

    const aroundX = rotatePlacementDraft(draft, 'X');
    const aroundY = rotatePlacementDraft(draft, 'Y');
    const aroundZ = rotatePlacementDraft(draft, 'Z');

    expect(aroundX).toMatchObject({ width: 1, height: 2, length: 1, rotation: [Math.PI / 2, 0, 0] });
    expect(aroundY).toMatchObject({ width: 2, height: 1, length: 1, rotation: [0, Math.PI / 2, 0] });
    expect(aroundZ).toMatchObject({ width: 1, height: 1, length: 2, rotation: [0, 0, Math.PI / 2] });
  });

  it('matches the Three XYZ Euler AABB for combined rotations and persists those dimensions', () => {
    const nonsymmetric = { ...selected, width: 1, height: 2, length: 3 };
    const rotation: [number, number, number] = [Math.PI / 2, Math.PI / 2, 0];
    const dimensions = getAxisAlignedDimensions(nonsymmetric, rotation);
    const draft = { ...createPlacementDraft(nonsymmetric), ...dimensions, rotation };
    const sequentialDraft = rotatePlacementDraft(rotatePlacementDraft(createPlacementDraft(nonsymmetric), 'X'), 'Y');
    const source: PackedContainer = { container, packed: [nonsymmetric], unpacked: [] };

    expect(dimensions).toEqual({ width: 3, height: 1, length: 2 });
    expect(sequentialDraft).toMatchObject({ ...dimensions, rotation });
    expect(validatePlacementDraft(container, source.packed, nonsymmetric, draft)).toEqual({ valid: true, errors: [] });
    expect(applyPlacementOverride(source, 'container-1:1', toPlacementOverride(draft)).packed[0]).toMatchObject(dimensions);
  });

  it('applies only the keyed placement without mutating automatic packing', () => {
    const source: PackedContainer = { container, packed: [selected, other], unpacked: [] };
    const original = structuredClone(source);

    const updated = applyPlacementOverride(source, 'container-1:1', { x: .5, y: 0, z: 0, width: 2, height: 1, length: 1 });

    expect(updated).not.toBe(source);
    expect(updated.packed[0]).toMatchObject({ x: .5, width: 2, height: 1, length: 1 });
    expect(updated.packed[1]).toBe(other);
    expect(source).toEqual(original);
  });
});
