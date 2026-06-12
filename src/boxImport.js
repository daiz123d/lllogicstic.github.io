const DEFAULT_BOX_COLOR = '#6dd3ff';

const FIELD_ALIASES = {
  length: ['length', 'dai', 'chieudai'],
  width: ['width', 'rong', 'chieurong'],
  height: ['height', 'cao', 'chieucao'],
  quantity: ['quantity', 'soluong', 'sl'],
  weight: ['weight', 'khoiluong', 'kg'],
  stackable: ['stackable', 'xepchong'],
  color: ['color', 'mau']
};

function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getValue(record, field) {
  const aliases = FIELD_ALIASES[field] || [field];
  const normalizedAliases = aliases.map(normalizeKey);
  const entry = Object.entries(record || {}).find(([key]) =>
    normalizedAliases.includes(normalizeKey(key))
  );
  return entry ? entry[1] : undefined;
}

export function isBoxFieldKey(key) {
  const normalized = normalizeKey(key);
  return Object.values(FIELD_ALIASES).some(aliases =>
    aliases.some(alias => normalizeKey(alias) === normalized)
  );
}

function isBlankValue(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isBlankRow(record) {
  return !record || Object.values(record).every(isBlankValue);
}

function parseMetric(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return NaN;
  const normalized = text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text;
  return Number(normalized);
}

function parseQuantity(value) {
  const quantity = Math.floor(parseMetric(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function parseWeight(value) {
  const weight = parseMetric(value);
  return Number.isFinite(weight) && weight >= 0 ? weight : 0;
}

function parseStackable(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeKey(value);
  if (['0', 'false', 'no', 'n', 'khong', 'ko', 'k'].includes(normalized)) return false;
  if (['1', 'true', 'yes', 'y', 'co', 'ok', 'x'].includes(normalized)) return true;
  return Boolean(value);
}

export function normalizeBoxRecord(record) {
  if (!record || isBlankRow(record)) return null;

  const length = parseMetric(getValue(record, 'length'));
  const width = parseMetric(getValue(record, 'width'));
  const height = parseMetric(getValue(record, 'height'));

  if ([width, height, length].some(value => !Number.isFinite(value) || value <= 0)) {
    return null;
  }

  return {
    width,
    height,
    length,
    quantity: parseQuantity(getValue(record, 'quantity')),
    color: getValue(record, 'color') || DEFAULT_BOX_COLOR,
    weight: parseWeight(getValue(record, 'weight')),
    stackable: parseStackable(getValue(record, 'stackable'))
  };
}

export function parseBoxRows(rows) {
  const result = { boxes: [], skipped: 0 };

  (rows || []).forEach(row => {
    if (isBlankRow(row)) return;
    const normalized = normalizeBoxRecord(row);
    if (normalized) {
      result.boxes.push(normalized);
    } else {
      result.skipped += 1;
    }
  });

  return result;
}
