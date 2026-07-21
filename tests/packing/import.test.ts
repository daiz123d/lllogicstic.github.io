import { expect, it } from 'vitest';

import { parseCartonRows } from '@/lib/packing/import';

it('accepts Vietnamese carton headers and reports invalid rows', () => {
  const parsed = parseCartonRows([
    { 'Dài': 2, 'Rộng': 1, 'Cao': 1, 'Số lượng': 2, 'Khối lượng': 3, 'Có thể chồng': 'có' },
    { 'Dài': 0, 'Rộng': 1, 'Cao': 1 },
  ]);

  expect(parsed.boxes).toHaveLength(1);
  expect(parsed.skipped).toBe(1);
  expect(parsed.boxes[0]).toMatchObject({ length: 2, width: 1, height: 1, quantity: 2, weight: 3, stackable: true });
});
