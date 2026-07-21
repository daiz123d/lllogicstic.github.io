import { expect, it } from 'vitest';

import { readRowsFromFile } from '@/lib/packing/file-io';

it('reads quoted CSV values into import rows', async () => {
  const file = new File(['Tên,Dài,Rộng\n"Hộp, dễ vỡ",1,2'], 'hang-hoa.csv', { type: 'text/csv' });

  await expect(readRowsFromFile(file)).resolves.toEqual([{ Tên: 'Hộp, dễ vỡ', Dài: '1', Rộng: '2' }]);
});
