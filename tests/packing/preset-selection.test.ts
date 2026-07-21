import { expect, it } from 'vitest';

import { packWithPresetContainers } from '@/lib/packing/engine';

it('selects the smallest sample container that packs all cartons', () => {
  const result = packWithPresetContainers([{
    id: 'carton-1', label: 'Hộp mẫu', length: 1, width: 1, height: 1, quantity: 4, weight: 1, stackable: true, color: '#22d3ee',
  }], { allowRotation: false });

  expect(result.results[0].container).toMatchObject({ id: 'preset-1', name: '2.5T (VN)' });
  expect(result.leftover).toEqual([]);
});

it('adds another sample container while cartons remain', () => {
  const result = packWithPresetContainers([{
    id: 'carton-1', label: 'Kiện dài', length: 18, width: 3, height: 3, quantity: 2, weight: 100, stackable: false, color: '#22d3ee',
  }], { allowRotation: false });

  expect(result.results).toHaveLength(2);
  expect(result.leftover).toEqual([]);
});
