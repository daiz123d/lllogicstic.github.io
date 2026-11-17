import { selectBestPresetContainers } from '@/src/binPacking.js';

import type { CartonInput, Leftover, PackedContainer, PackingOptions, PackingResult, Placement } from './types';

type LegacyPlacement = Partial<Placement> & {
  width: number;
  height: number;
  length: number;
  reason?: Leftover['reason'];
};

function normalizePlacement(box: LegacyPlacement, containerIndex: number, placementIndex: number): Placement {
  return {
    id: box.id ?? `preset-${containerIndex + 1}-box-${placementIndex + 1}`,
    label: box.label ?? `Kiện ${placementIndex + 1}`,
    width: box.width,
    height: box.height,
    length: box.length,
    color: box.color ?? '#22d3ee',
    weight: box.weight ?? 0,
    stackable: box.stackable !== false,
    x: box.x ?? 0,
    y: box.y ?? 0,
    z: box.z ?? 0,
    order: box.order ?? placementIndex + 1,
    sourceIndex: box.sourceIndex ?? 0,
    itemIndex: box.itemIndex ?? placementIndex,
  };
}

function normalizeLeftover(box: LegacyPlacement, index: number): Leftover {
  return {
    ...normalizePlacement(box, 0, index),
    reason: box.reason ?? 'no-space',
  };
}

export function packPresetContainers(cartons: CartonInput[], options: PackingOptions = {}): PackingResult {
  const legacy = selectBestPresetContainers(cartons, options) as {
    results: Array<{ container: { name: string; width: number; height: number; length: number; maxWeight?: number; presetName?: string }; packed: LegacyPlacement[]; unpacked: LegacyPlacement[] }>;
    leftover: LegacyPlacement[];
  };

  const results: PackedContainer[] = legacy.results.map((item, containerIndex) => ({
    container: {
      id: `preset-${containerIndex + 1}`,
      name: item.container.presetName ?? item.container.name,
      width: item.container.width,
      height: item.container.height,
      length: item.container.length,
      maxWeight: item.container.maxWeight ?? 0,
    },
    packed: item.packed.map((box, placementIndex) => normalizePlacement(box, containerIndex, placementIndex)),
    unpacked: item.unpacked.map((box, placementIndex) => normalizeLeftover(box, placementIndex)),
  }));

  return {
    results,
    leftover: legacy.leftover.map((box, index) => normalizeLeftover(box, index)),
  };
}
