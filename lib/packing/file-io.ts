import type { CartonInput, ContainerInput, PackingResult } from './types';

function extension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function csvRows(text: string): Record<string, unknown>[] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  const finishRow = () => {
    cells.push(cell.trim());
    if (cells.some((value) => value !== '')) rows.push(cells);
    cells = [];
    cell = '';
  };

  // Scan once: quoted fields can contain delimiters and physical newlines.
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      finishRow();
      if (char === '\r' && input[index + 1] === '\n') index += 1;
    } else cell += char;
  }
  if (quoted) throw new Error('CSV có ô chưa đóng dấu ngoặc kép.');
  finishRow();
  const [headers, ...records] = rows;
  if (!headers) return [];
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
}

function readText(file: File) {
  if (typeof file.text === 'function') return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Không thể đọc tệp.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

export async function readRowsFromFile(file: File, target?: 'cartons' | 'containers'): Promise<Record<string, unknown>[]> {
  const type = extension(file.name);
  if (type === 'csv') return csvRows(await readText(file));
  if (type === 'json') {
    const data: unknown = JSON.parse(await readText(file));
    const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? (data as { rows?: unknown }).rows : undefined;
    if (!Array.isArray(rows) || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('JSON phải là một danh sách các dòng dữ liệu.');
    return rows as Record<string, unknown>[];
  }
  if (type === 'xlsx' || type === 'xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const generatedSheet = target === 'cartons' ? 'Hang hoa' : target === 'containers' ? 'Container' : undefined;
    const sheetName = generatedSheet && workbook.Sheets[generatedSheet] ? generatedSheet : workbook.SheetNames[0];
    return sheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' }) : [];
  }
  throw new Error('Chỉ hỗ trợ tệp CSV, JSON, XLSX hoặc XLS.');
}

export async function downloadPackingWorkbook(cartons: CartonInput[], containers: ContainerInput[], result: PackingResult | null) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cartons.map(({ id, ...carton }) => carton)), 'Hang hoa');
  const exportedContainers = result
    ? result.results.map(({ container: { id: _id, ...container } }) => ({ ...container, quantity: 1 }))
    : containers.map(({ id: _id, ...container }) => container);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportedContainers), 'Container');
  if (result) {
    const placements = result.results.flatMap(({ container, packed }) => packed.map((box) => ({ container: container.name, label: box.label, x: box.x, y: box.y, z: box.z, length: box.length, width: box.width, height: box.height, weight: box.weight, order: box.order })));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(placements), 'Ket qua xep');
    const reasonLabels = { oversize: 'Quá khổ', overweight: 'Vượt tải trọng', 'no-space': 'Không đủ chỗ' } as const;
    const leftovers = result.leftover.map(({ id: _id, sourceIndex: _sourceIndex, itemIndex: _itemIndex, ...box }) => ({
      ...box,
      reason: reasonLabels[box.reason],
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(leftovers), 'Hang chua xep');
  }
  XLSX.writeFile(workbook, 'phuong-an-xep-hang.xlsx');
}
