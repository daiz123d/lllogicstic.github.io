import type { CartonInput, ContainerInput, PackingResult } from './types';

function extension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function csvRows(text: string): Record<string, unknown>[] {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!rows.length) return [];
  const split = (line: string) => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
      else cell += char;
    }
    cells.push(cell.trim());
    return cells;
  };
  const headers = split(rows[0]);
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, split(line)[index] ?? ''])));
}

export async function readRowsFromFile(file: File): Promise<Record<string, unknown>[]> {
  const type = extension(file.name);
  if (type === 'csv') return csvRows(await file.text());
  if (type === 'json') {
    const data: unknown = JSON.parse(await file.text());
    const rows = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { rows?: unknown }).rows) ? (data as { rows: unknown[] }).rows : [];
    if (!rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('JSON phải là một danh sách các dòng dữ liệu.');
    return rows as Record<string, unknown>[];
  }
  if (type === 'xlsx' || type === 'xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    return firstSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: '' }) : [];
  }
  throw new Error('Chỉ hỗ trợ tệp CSV, JSON, XLSX hoặc XLS.');
}

export async function downloadPackingWorkbook(cartons: CartonInput[], containers: ContainerInput[], result: PackingResult | null) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cartons.map(({ id, ...carton }) => carton)), 'Hang hoa');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(containers.map(({ id, ...container }) => container)), 'Container');
  if (result) {
    const placements = result.results.flatMap(({ container, packed }) => packed.map((box) => ({ container: container.name, label: box.label, x: box.x, y: box.y, z: box.z, length: box.length, width: box.width, height: box.height, weight: box.weight, order: box.order })));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(placements), 'Ket qua xep');
  }
  XLSX.writeFile(workbook, 'phuong-an-xep-hang.xlsx');
}
