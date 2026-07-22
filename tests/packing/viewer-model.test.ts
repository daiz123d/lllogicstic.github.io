import { describe, expect, it } from 'vitest';

import { getCameraFrame, getEmptyRegions, getHeatColor, getViewerMetrics } from '@/components/packing/viewer-model';
import type { PackedContainer } from '@/lib/packing/types';

const packedContainer: PackedContainer = {
  container: { id: 'container-1', name: 'Demo container', width: 2, height: 2, length: 10, maxWeight: 4800 },
  packed: [
    {
      id: 'box-1', label: 'Floor-only carton', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 100, stackable: false,
      x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0,
    },
  ],
  unpacked: [
    {
      id: 'box-2', label: 'Unpacked carton', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 100, stackable: true,
      x: 0, y: 0, z: 0, order: 2, sourceIndex: 0, itemIndex: 1, reason: 'no-space',
    },
  ],
};

describe('viewer model', () => {
  it('fits the container to 75 percent of an orthographic viewport', () => {
    expect(getCameraFrame({ width: 2, height: 2, length: 10 }, 'iso', 1200, 700)).toMatchObject({ coverage: .75, elevation: 32 });
  });

  it('computes volume, weight, packed and floor-only metrics', () => {
    expect(getViewerMetrics(packedContainer, 1)).toMatchObject({ packed: 1, total: 2, floorOnly: 1, usedWeight: 100, maxWeight: 4800 });
  });

  it('returns deterministic weight and height heat colors', () => {
    expect(getHeatColor('weight', .5)).toBe('#f59e0b');
    expect(getHeatColor('height', 1)).toBe('#fb7185');
  });

  it('returns no empty geometry when disabled and bounded regions when enabled', () => {
    expect(getEmptyRegions(packedContainer, false)).toEqual([]);
    expect(getEmptyRegions(packedContainer, true).every((region) => region.width > 0 && region.length > 0 && region.height > 0)).toBe(true);
  });
});
