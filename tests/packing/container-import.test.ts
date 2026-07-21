import { expect, it } from 'vitest';

import { parseContainerRows } from '@/lib/packing/container-import';

it('accepts Vietnamese container headers and rejects invalid dimensions', () => {
  const parsed = parseContainerRows([
    { 'Tên': 'Cont 20', 'Dài': '6,1', 'Rộng': 2.4, 'Cao': 2.6, 'Số lượng': 2, 'Tải trọng': 12000 },
    { 'Tên': 'Không hợp lệ', 'Dài': 0, 'Rộng': 2.4, 'Cao': 2.6 },
  ]);

  expect(parsed.containers).toEqual([{
    name: 'Cont 20', length: 6.1, width: 2.4, height: 2.6, quantity: 2, maxWeight: 12000,
  }]);
  expect(parsed.skipped).toBe(1);
});
