import { parseBoxRows } from '@/src/boxImport.js';

import type { ImportedCartons } from './types';

export function parseCartonRows(rows: Record<string, unknown>[]): ImportedCartons {
  return parseBoxRows(rows) as ImportedCartons;
}
