import type { PlacementOverride } from './manual-layout';
import type {
  CartonInput,
  ContainerInput,
  ContainerSelectionMode,
  Leftover,
  PackedContainer,
  PackingResult,
  PackingStrategy,
  Placement,
} from './types';

export const WORKSPACE_STORAGE_KEY = 'packing-workspace-v1';

export type WorkspaceSnapshot = {
  version: 1;
  containers: ContainerInput[];
  cartons: CartonInput[];
  containerMode: ContainerSelectionMode;
  allowRotation: boolean;
  strategy: PackingStrategy;
  result: PackingResult | null;
  placementOverrides: Record<string, PlacementOverride>;
};

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

const strategies = new Set<PackingStrategy>(['minContainers', 'maxFill', 'inputOrder', 'heavyBottom']);
const leftoverReasons = new Set(['oversize', 'overweight', 'no-space']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string { return typeof value === 'string'; }
function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

function hasFiniteNumbers(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => isFiniteNumber(value[key]));
}

function isContainer(value: unknown, includeQuantity = true): value is ContainerInput {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name)) return false;
  const numericKeys = ['width', 'height', 'length', 'maxWeight', ...(includeQuantity ? ['quantity'] : [])];
  return hasFiniteNumbers(value, numericKeys);
}

function isCarton(value: unknown, includeQuantity = true): value is CartonInput {
  if (!isRecord(value) || !isString(value.id) || !isString(value.label) || !isString(value.color) || typeof value.stackable !== 'boolean') return false;
  const numericKeys = ['width', 'height', 'length', 'weight', ...(includeQuantity ? ['quantity'] : [])];
  return hasFiniteNumbers(value, numericKeys);
}

function isPlacement(value: unknown): value is Placement {
  return isCarton(value, false)
    && isRecord(value)
    && hasFiniteNumbers(value, ['x', 'y', 'z', 'order', 'sourceIndex', 'itemIndex']);
}

function isLeftover(value: unknown): value is Leftover {
  if (!isCarton(value, false) || !isRecord(value)) return false;
  const reason = (value as unknown as Record<string, unknown>).reason;
  if (!isString(reason) || !leftoverReasons.has(reason) || !hasFiniteNumbers(value, ['sourceIndex', 'itemIndex'])) return false;

  const placementKeys = ['x', 'y', 'z', 'order'];
  const hasPlacementData = placementKeys.some((key) => Object.hasOwn(value, key));
  return !hasPlacementData || hasFiniteNumbers(value, placementKeys);
}

function isPackedContainer(value: unknown): value is PackedContainer {
  return isRecord(value)
    && isContainer(value.container, false)
    && Array.isArray(value.packed)
    && value.packed.every(isPlacement)
    && Array.isArray(value.unpacked)
    && value.unpacked.every(isLeftover);
}

function isPackingResult(value: unknown): value is PackingResult {
  return isRecord(value)
    && Array.isArray(value.results)
    && value.results.every(isPackedContainer)
    && Array.isArray(value.leftover)
    && value.leftover.every(isLeftover);
}

function isPlacementOverride(value: unknown): value is PlacementOverride {
  return isRecord(value) && hasFiniteNumbers(value, ['x', 'y', 'z', 'width', 'height', 'length']);
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  return isRecord(value)
    && value.version === 1
    && Array.isArray(value.containers)
    && value.containers.every((container) => isContainer(container))
    && Array.isArray(value.cartons)
    && value.cartons.every((carton) => isCarton(carton))
    && (value.containerMode === 'presets' || value.containerMode === 'manual')
    && typeof value.allowRotation === 'boolean'
    && isString(value.strategy)
    && strategies.has(value.strategy as PackingStrategy)
    && (value.result === null || isPackingResult(value.result))
    && isRecord(value.placementOverrides)
    && Object.values(value.placementOverrides).every(isPlacementOverride);
}

export function readWorkspaceSnapshot(storage: ReadStorage): WorkspaceSnapshot | null {
  const stored = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (stored === null) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    return isWorkspaceSnapshot(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot, storage: WriteStorage): void {
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
}
