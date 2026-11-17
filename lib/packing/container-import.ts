import type { ImportedContainers } from './types';

const aliases = {
  name: ['name', 'ten', 'container'],
  length: ['length', 'dai', 'chieudai'],
  width: ['width', 'rong', 'chieurong'],
  height: ['height', 'cao', 'chieucao'],
  quantity: ['quantity', 'soluong', 'sl'],
  maxWeight: ['maxweight', 'taitrong', 'taichong', 'kg'],
};

function normalizeKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function valueFor(row: Record<string, unknown>, field: keyof typeof aliases) {
  const entry = Object.entries(row).find(([key]) => aliases[field].includes(normalizeKey(key)));
  return entry?.[1];
}

function metric(value: unknown) {
  if (typeof value === 'number') return value;
  const input = String(value ?? '').trim().replace(/\s/g, '');
  return Number(input.includes(',') && !input.includes('.') ? input.replace(',', '.') : input);
}

function isBlank(row: Record<string, unknown>) {
  return Object.values(row).every((value) => value === null || value === undefined || String(value).trim() === '');
}

function isBlankValue(value: unknown) {
  return value === null || value === undefined || String(value).trim() === '';
}

export function parseContainerRows(rows: Record<string, unknown>[]): ImportedContainers {
  const containers: ImportedContainers['containers'] = [];
  let skipped = 0;

  for (const row of rows ?? []) {
    if (isBlank(row)) continue;
    const length = metric(valueFor(row, 'length'));
    const width = metric(valueFor(row, 'width'));
    const height = metric(valueFor(row, 'height'));
    if (![length, width, height].every((value) => Number.isFinite(value) && value > 0)) {
      skipped += 1;
      continue;
    }
    const rawQuantity = valueFor(row, 'quantity');
    const rawMaxWeight = valueFor(row, 'maxWeight');
    const quantityValue = isBlankValue(rawQuantity) ? 1 : metric(rawQuantity);
    const maxWeightValue = isBlankValue(rawMaxWeight) ? 0 : metric(rawMaxWeight);
    if (!Number.isSafeInteger(quantityValue) || quantityValue <= 0 || !Number.isFinite(maxWeightValue) || maxWeightValue < 0) {
      skipped += 1;
      continue;
    }
    containers.push({
      name: String(valueFor(row, 'name') ?? `Container ${containers.length + 1}`).trim() || `Container ${containers.length + 1}`,
      length,
      width,
      height,
      quantity: quantityValue,
      maxWeight: maxWeightValue,
    });
  }
  return { containers, skipped };
}
