import { describe, expect, it } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';

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
  it.each([
    ['iso', 1200, 700],
    ['iso', 700, 1200],
    ['top', 1200, 700],
    ['top', 700, 1200],
    ['front', 1200, 700],
    ['front', 700, 1200],
    ['side', 1200, 700],
    ['side', 700, 1200],
  ] as const)('fits %s to 75 percent of Drei\'s default %sx%s pixel frustum', (preset, viewportWidth, viewportHeight) => {
    const bounds = { width: 2, height: 2.5, length: 10 };
    const frame = getCameraFrame(bounds, preset, viewportWidth, viewportHeight);
    const camera = new OrthographicCamera(-viewportWidth / 2, viewportWidth / 2, viewportHeight / 2, -viewportHeight / 2, .1, 10_000);
    camera.position.set(...frame.position);
    camera.zoom = frame.zoom;
    camera.lookAt(...frame.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const projectedCorners = [0, bounds.width].flatMap((x) => [0, bounds.height].flatMap((y) => [0, bounds.length].map((z) => new Vector3(x, y, z).project(camera))));
    const visibleWidthFraction = (Math.max(...projectedCorners.map(({ x }) => x)) - Math.min(...projectedCorners.map(({ x }) => x))) / 2;
    const visibleHeightFraction = (Math.max(...projectedCorners.map(({ y }) => y)) - Math.min(...projectedCorners.map(({ y }) => y))) / 2;
    const [targetX, targetY, targetZ] = frame.target;
    const [positionX, positionY, positionZ] = frame.position;
    const horizontalDistance = Math.hypot(positionX - targetX, positionZ - targetZ);
    const measuredElevation = Math.atan2(positionY - targetY, horizontalDistance) * 180 / Math.PI;

    expect(frame).toMatchObject({ coverage: .75, elevation: 32 });
    if (preset === 'iso') expect(measuredElevation).toBeCloseTo(32, 6);
    expect(visibleWidthFraction).toBeLessThanOrEqual(.751);
    expect(visibleHeightFraction).toBeLessThanOrEqual(.751);
    expect(Math.max(visibleWidthFraction, visibleHeightFraction)).toBeCloseTo(.75, 3);
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
