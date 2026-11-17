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

it.each([
  ['label', { label: 'Fragile A' }],
  ['name', { name: 'Fragile B' }],
  ['Tên', { 'Tên': 'Kiện C' }],
  ['Tên hàng', { 'Tên hàng': 'Kiện D' }],
])('preserves carton labels from the %s alias', (_alias, labelField) => {
  const parsed = parseCartonRows([{ ...labelField, Dài: 2, Rộng: 1, Cao: 1 }]);
  expect(parsed.boxes[0]).toMatchObject({ label: Object.values(labelField)[0] });
});

it('parses Vietnamese Có thể chồng as false', () => {
  const parsed = parseCartonRows([{ Dài: 2, Rộng: 1, Cao: 1, 'Có thể chồng': 'không' }]);
  expect(parsed.boxes[0].stackable).toBe(false);
});

it.each([
  ['zero quantity', { quantity: 0 }],
  ['fractional quantity', { quantity: 1.5 }],
  ['unsafe quantity', { quantity: Number.MAX_SAFE_INTEGER + 1 }],
  ['negative weight', { weight: -1 }],
  ['infinite weight', { weight: Number.POSITIVE_INFINITY }],
])('rejects a carton with an explicit invalid %s', (_case, invalidField) => {
  const parsed = parseCartonRows([{ length: 2, width: 1, height: 1, ...invalidField }]);
  expect(parsed).toEqual({ boxes: [], skipped: 1 });
});

it('keeps defaults for omitted optional carton values', () => {
  const parsed = parseCartonRows([{ length: 2, width: 1, height: 1 }]);
  expect(parsed.boxes[0]).toMatchObject({ quantity: 1, weight: 0, stackable: true });
});
