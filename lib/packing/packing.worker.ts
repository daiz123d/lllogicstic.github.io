import { packMultipleContainers, packWithPresetContainers } from './engine';
import type { PackingJobInput } from './packing-job';

type WorkerResponse =
  | { type: 'success'; result: ReturnType<typeof packMultipleContainers> }
  | { type: 'error'; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PackingJobInput>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

workerScope.onmessage = ({ data }) => {
  try {
    const result = data.containerMode === 'presets'
      ? packWithPresetContainers(data.cartons, data.options)
      : packMultipleContainers(data.containers, data.cartons, data.options);
    workerScope.postMessage({ type: 'success', result });
  } catch (error) {
    workerScope.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
  }
};
