import { expect, it } from 'vitest';

import { packWithPresetContainers } from '@/lib/packing/engine';

it('prefers one practical sample over multiple smaller containers', () => {
  const result = packWithPresetContainers([{
    id: 'carton-1', label: 'Kiện dài', length: 3, width: 1.5, height: 1.5,
    quantity: 2, weight: 1, stackable: true, color: '#22d3ee',
  }], { allowRotation: false });

  expect(result.results.map((item) => item.container.name)).toEqual(['8T (VN)']);
  expect(result.leftover).toEqual([]);
});

it('adds another sample container while cartons remain', () => {
  const result = packWithPresetContainers([{
    id: 'carton-1', label: 'Kiện dài', length: 18, width: 3, height: 3, quantity: 2, weight: 100, stackable: false, color: '#22d3ee',
  }], { allowRotation: false });

  expect(result.results).toHaveLength(2);
  expect(result.leftover).toEqual([]);
});
