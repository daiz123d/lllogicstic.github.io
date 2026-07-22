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
    const longLandscape = getCameraFrame({ width: 2, height: 2, length: 10 }, 'iso', 1200, 700);
    const longPortrait = getCameraFrame({ width: 2, height: 2, length: 10 }, 'iso', 700, 1200);
    const compactLandscape = getCameraFrame({ width: 2, height: 2, length: 2 }, 'iso', 1200, 700);
    const [targetX, targetY, targetZ] = longLandscape.target;
    const [positionX, positionY, positionZ] = longLandscape.position;
    const horizontalDistance = Math.hypot(positionX - targetX, positionZ - targetZ);
    const measuredElevation = Math.atan2(positionY - targetY, horizontalDistance) * 180 / Math.PI;

    expect(longLandscape).toMatchObject({ coverage: .75, elevation: 32 });
    expect(measuredElevation).toBeCloseTo(32, 6);
    expect(longLandscape.zoom).toBeGreaterThan(longPortrait.zoom);
    expect(compactLandscape.zoom).toBeGreaterThan(longLandscape.zoom);
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

  it('caps fragmented empty-region output deterministically at 256', () => {
    const packed = [] as PackedContainer['packed'];
    let order = 1;
    for (let z = 0; z < 10; z += 1) for (let y = 0; y < 10; y += 1) for (let x = 0; x < 10; x += 1) {
      if ((x + y + z) % 2 !== 0) continue;
      packed.push({
        id: `fragment-${order}`, label: `Fragment ${order}`, width: .25, height: .25, length: .25,
        color: '#36c5f0', weight: 1, stackable: true, x: x * .25, y: y * .25, z: z * .25,
        order, sourceIndex: order - 1, itemIndex: 0,
      });
      order += 1;
    }
    const fragmented: PackedContainer = {
      container: { id: 'fragmented', name: 'Fragmented', width: 2.5, height: 2.5, length: 2.5, maxWeight: 1000 },
      packed,
      unpacked: [],
    };

    const first = getEmptyRegions(fragmented, true);
    const second = getEmptyRegions(fragmented, true);

    expect(first).toHaveLength(256);
    expect(second).toEqual(first);
    expect(first.at(-1)?.id).toBe('empty-255');
  });
});
