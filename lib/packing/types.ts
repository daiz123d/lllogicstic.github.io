export type PackingStrategy = 'minContainers' | 'maxFill' | 'inputOrder' | 'heavyBottom';
export type ContainerSelectionMode = 'presets' | 'manual';
export type LeftoverReason = 'oversize' | 'overweight' | 'no-space';

export type ContainerInput = {
  id: string;
  name: string;
  width: number;
  height: number;
  length: number;
  quantity: number;
  maxWeight: number;
};

export type CartonInput = {
  id: string;
  label: string;
  width: number;
  height: number;
  length: number;
  quantity: number;
  color: string;
  weight: number;
  stackable: boolean;
};

export type PackingOptions = {
  allowRotation?: boolean;
  strategy?: PackingStrategy;
};

export type Placement = Omit<CartonInput, 'quantity'> & {
  x: number;
  y: number;
  z: number;
  order: number;
  sourceIndex: number;
  itemIndex: number;
};

export type Leftover = Placement & { reason: LeftoverReason };
export type PackedContainer = { container: Omit<ContainerInput, 'quantity'>; packed: Placement[]; unpacked: Leftover[] };
export type PackingResult = { results: PackedContainer[]; leftover: Leftover[] };
export type ImportedCartons = { boxes: Omit<CartonInput, 'id' | 'label'>[]; skipped: number };
export type ImportedContainers = { containers: Omit<ContainerInput, 'id'>[]; skipped: number };
