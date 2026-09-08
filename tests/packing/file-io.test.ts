import { expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { downloadPackingWorkbook, readRowsFromFile } from '@/lib/packing/file-io';
import type { CartonInput, ContainerInput, PackingResult } from '@/lib/packing/types';

vi.mock('xlsx', async (importOriginal) => ({
  ...await importOriginal<typeof import('xlsx')>(),
  writeFile: vi.fn(),
}));

it('reads quoted CSV values into import rows', async () => {
  const file = new File(['Tên,Dài,Rộng\n"Hộp, dễ vỡ",1,2'], 'hang-hoa.csv', { type: 'text/csv' });

  await expect(readRowsFromFile(file)).resolves.toEqual([{ Tên: 'Hộp, dễ vỡ', Dài: '1', Rộng: '2' }]);
});

it('preserves newlines and escaped quotes inside CSV cells', async () => {
  const file = new File(['\uFEFFTên,Dài,Rộng\r\n"Hộp ""dễ vỡ""\r\ntầng 2",1,2\r\n'], 'hang.csv');
  await expect(readRowsFromFile(file)).resolves.toEqual([{ Tên: 'Hộp "dễ vỡ"\r\ntầng 2', Dài: '1', Rộng: '2' }]);
});

it('reads empty quoted CSV cells without adding a quote', async () => {
  await expect(readRowsFromFile(new File(['Tên,Dài\n"",1'], 'hang.csv')))
    .resolves.toEqual([{ Tên: '', Dài: '1' }]);
});

it('rejects CSV with an unfinished quoted cell', async () => {
  await expect(readRowsFromFile(new File(['Tên,Dài\n"Hộp,1'], 'hang.csv')))
    .rejects.toThrow(/CSV/);
});

it.each(['null', '{}', '{"rows":42}', '"hello"'])('rejects invalid JSON row containers: %s', async (contents) => {
  await expect(readRowsFromFile(new File([contents], 'hang.json'))).rejects.toThrow(/JSON/);
});

it.each(['[]', '{"rows":[]}'])('accepts empty JSON row lists: %s', async (contents) => {
  await expect(readRowsFromFile(new File([contents], 'hang.json'))).resolves.toEqual([]);
});

function workbookFile(sheets: Record<string, Record<string, unknown>[]>) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  }
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const file = new File([bytes], 'packing.xlsx');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes });
  return file;
}

it('selects generated workbook sheets for the requested import target', async () => {
  const file = workbookFile({
    'Ket qua xep': [{ label: 'ignore' }],
    Container: [{ name: 'Result container', length: 6 }],
    'Hang hoa': [{ label: 'Result carton', length: 2 }],
  });

  await expect(readRowsFromFile(file, 'cartons')).resolves.toMatchObject([{ label: 'Result carton', length: 2 }]);
  await expect(readRowsFromFile(file, 'containers')).resolves.toMatchObject([{ name: 'Result container', length: 6 }]);
});

it('falls back to the first workbook sheet when the matching generated sheet is absent', async () => {
  const file = workbookFile({ Data: [{ value: 42 }], Other: [{ value: 99 }] });
  await expect(readRowsFromFile(file, 'cartons')).resolves.toEqual([{ value: 42 }]);
});

it('exports displayed result containers and human-readable final leftovers', async () => {
  const inputCartons: CartonInput[] = [{ id: 'carton-1', label: 'Input', length: 1, width: 1, height: 1, quantity: 2, weight: 1, color: '#fff', stackable: true }];
  const inputContainers: ContainerInput[] = [{ id: 'input-container', name: 'Hidden manual input', length: 12, width: 3, height: 3, quantity: 4, maxWeight: 20000 }];
  const placement = { id: 'carton-1-0', label: 'Packed', length: 1, width: 1, height: 1, weight: 1, color: '#fff', stackable: true, x: 0, y: 0, z: 0, order: 0, sourceIndex: 0, itemIndex: 0 };
  const result: PackingResult = {
    results: [{ container: { id: 'used-container', name: 'Used 20ft', length: 6, width: 2, height: 2, maxWeight: 10000 }, packed: [placement], unpacked: [] }],
    leftover: [{ ...placement, id: 'carton-1-1', label: 'Too heavy', itemIndex: 1, reason: 'overweight' }],
  };
  const writeFile = vi.mocked(XLSX.writeFile);
  writeFile.mockClear();

  await downloadPackingWorkbook(inputCartons, inputContainers, result);

  const workbook = writeFile.mock.calls[0][0];
  expect(XLSX.utils.sheet_to_json(workbook.Sheets.Container, { defval: '' }))
    .toEqual([{ name: 'Used 20ft', width: 2, height: 2, length: 6, quantity: 1, maxWeight: 10000 }]);
  expect(XLSX.utils.sheet_to_json(workbook.Sheets['Hang chua xep'], { defval: '' }))
    .toEqual([expect.objectContaining({ label: 'Too heavy', reason: 'Vượt tải trọng' })]);
  expect(JSON.stringify(workbook.Sheets.Container)).not.toContain('Hidden manual input');
});
