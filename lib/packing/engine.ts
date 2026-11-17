import {
  containerPresets,
  packMultipleContainers as legacyPackMultipleContainers,
} from '@/src/binPacking.js';

import { packPresetContainers } from './presets';
import type { CartonInput, ContainerInput, PackingOptions, PackingResult } from './types';

export const sampleContainers: Omit<ContainerInput, 'id'>[] = containerPresets.map((preset) => ({
  ...preset,
  quantity: 1,
}));

function expandContainers(containers: ContainerInput[]) {
  return containers.flatMap(({ quantity, ...container }) =>
    Array.from({ length: Math.max(1, Math.floor(quantity || 1)) }, (_, index) => ({
      ...container,
      id: quantity > 1 ? `${container.id}-${index + 1}` : container.id,
      name: quantity > 1 ? `${container.name} ${index + 1}` : container.name,
    })),
  );
}

export function packMultipleContainers(
  containers: ContainerInput[],
  cartons: CartonInput[],
  options: PackingOptions = {},
): PackingResult {
  return legacyPackMultipleContainers(expandContainers(containers), cartons, options) as PackingResult;
}

export function packWithPresetContainers(cartons: CartonInput[], options: PackingOptions = {}): PackingResult {
  return packPresetContainers(cartons, options);
}
