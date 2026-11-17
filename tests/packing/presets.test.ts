import { expect, it } from 'vitest';

import { packPresetContainers } from '@/lib/packing/presets';
import type { CartonInput } from '@/lib/packing/types';

const carton = (overrides: Partial<CartonInput> = {}): CartonInput => ({
  id: 'box', label: 'Box', length: 1, width: 1, height: 1, quantity: 2, weight: 1, color: '#22d3ee', stackable: true, ...overrides,
});

it('selects the smallest preset that fits all cartons', () => {
  const result = packPresetContainers([carton()]);

  expect(result.results).toHaveLength(1);
  expect(result.results[0].container.name).toBe('1.25T (VN)');
  expect(result.leftover).toHaveLength(0);
});

it('adds another preset until all cartons are packed', () => {
  const result = packPresetContainers([carton({ id: 'oversize', label: 'Oversize', length: 10, width: 2.4, height: 2.8, quantity: 2, weight: 10 })]);

  expect(result.results.length).toBeGreaterThan(1);
  expect(result.results.reduce((sum, item) => sum + item.packed.length, 0)).toBe(2);
  expect(result.leftover).toHaveLength(0);
});
