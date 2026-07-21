import { describe, expect, it } from 'vitest';

import { packMultipleContainers } from '@/lib/packing/engine';

describe('packMultipleContainers', () => {
  it('places a fitting carton and reports an oversized carton', () => {
    const result = packMultipleContainers(
      [{ id: 'c1', name: '20ft', length: 4, width: 2, height: 2, quantity: 1, maxWeight: 100 }],
      [
        { id: 'box-1', label: 'Hộp vừa', length: 1, width: 1, height: 1, quantity: 1, weight: 2, stackable: true, color: '#22c55e' },
        { id: 'box-2', label: 'Hộp quá khổ', length: 5, width: 1, height: 1, quantity: 1, weight: 2, stackable: true, color: '#f43f5e' },
      ],
      { allowRotation: true },
    );

    expect(result.results[0].packed).toHaveLength(1);
    expect(result.leftover).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'box-2', reason: 'oversize' }),
    ]));
  });
});
