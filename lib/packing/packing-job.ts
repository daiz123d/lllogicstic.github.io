import { packMultipleContainers, packWithPresetContainers } from './engine';
import type { CartonInput, ContainerInput, ContainerSelectionMode, PackingOptions, PackingResult } from './types';

export type PackingJobInput = {
  containers: ContainerInput[];
  cartons: CartonInput[];
  containerMode: ContainerSelectionMode;
  options: PackingOptions;
};

export type PackingJobCallbacks = {
  onSuccess(result: PackingResult): void;
  onError(error: Error): void;
};

type WorkerResponse =
  | { type: 'success'; result: PackingResult }
  | { type: 'error'; error: string };

function runSynchronously(input: PackingJobInput, callbacks: PackingJobCallbacks) {
  try {
    const result = input.containerMode === 'presets'
      ? packWithPresetContainers(input.cartons, input.options)
      : packMultipleContainers(input.containers, input.cartons, input.options);
    callbacks.onSuccess(result);
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export function startPackingJob(input: PackingJobInput, callbacks: PackingJobCallbacks): () => void {
  if (typeof Worker === 'undefined') {
    let cancelled = false;
    runSynchronously(input, {
      onSuccess: (result) => { if (!cancelled) callbacks.onSuccess(result); },
      onError: (error) => { if (!cancelled) callbacks.onError(error); },
    });
    return () => { cancelled = true; };
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('./packing.worker.ts', import.meta.url), { type: 'module' });
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
  let settled = false;

  const finish = (callback?: () => void) => {
    if (settled) return;
    settled = true;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    callback?.();
  };

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    if (response.type === 'success') {
      finish(() => callbacks.onSuccess(response.result));
    } else {
      finish(() => callbacks.onError(new Error(response.error)));
    }
  };
  worker.onerror = (event) => {
    finish(() => callbacks.onError(event.error instanceof Error ? event.error : new Error(event.message || 'Packing worker failed')));
  };
  try {
    worker.postMessage(input);
  } catch (error) {
    finish(() => callbacks.onError(error instanceof Error ? error : new Error(String(error))));
  }

  return () => finish();
}
