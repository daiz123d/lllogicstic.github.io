import { afterEach, describe, expect, it, vi } from 'vitest';

import { startPackingJob, type PackingJobInput } from '@/lib/packing/packing-job';

const input: PackingJobInput = {
  containers: [{ id: 'c1', name: 'Container', width: 2, height: 2, length: 2, quantity: 1, maxWeight: 100 }],
  cartons: [{ id: 'b1', label: 'Box', width: 1, height: 1, length: 1, quantity: 1, color: '#fff', weight: 1, stackable: true }],
  containerMode: 'manual',
  options: { allowRotation: true, strategy: 'maxFill' },
};

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(public url: URL, public options?: WorkerOptions) { FakeWorker.instances.push(this); }
}

describe('startPackingJob', () => {
  afterEach(() => {
    FakeWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it('posts work to a module worker and completes once', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const cancel = startPackingJob(input, { onSuccess, onError });
    const worker = FakeWorker.instances[0];

    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.url.pathname).toMatch(/packing\.worker\.ts$/);
    expect(worker.postMessage).toHaveBeenCalledWith(input);

    const result = { results: [], leftover: [] };
    worker.onmessage?.({ data: { type: 'success', result } } as MessageEvent);
    expect(onSuccess).toHaveBeenCalledWith(result);
    expect(onError).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();

    cancel();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('reports worker failures and terminates it', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    startPackingJob(input, { onSuccess: vi.fn(), onError });
    const worker = FakeWorker.instances[0];

    worker.onerror?.({ message: 'worker exploded' } as ErrorEvent);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'worker exploded' }));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('reports Worker construction failures', () => {
    class ThrowingWorker {
      constructor() { throw new Error('worker unavailable'); }
    }
    vi.stubGlobal('Worker', ThrowingWorker);
    const onError = vi.fn();

    const cancel = startPackingJob(input, { onSuccess: vi.fn(), onError });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'worker unavailable' }));
    expect(() => cancel()).not.toThrow();
  });

  it('reports postMessage failures and cleans up the created worker', () => {
    class PostFailingWorker extends FakeWorker {
      postMessage = vi.fn(() => { throw new Error('could not clone input'); });
    }
    vi.stubGlobal('Worker', PostFailingWorker);
    const onError = vi.fn();

    startPackingJob(input, { onSuccess: vi.fn(), onError });
    const worker = FakeWorker.instances[0];

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'could not clone input' }));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });

  it('reports serialized engine errors', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    startPackingJob(input, { onSuccess: vi.fn(), onError });
    const worker = FakeWorker.instances[0];

    worker.onmessage?.({ data: { type: 'error', error: 'bad input' } } as MessageEvent);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'bad input' }));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('cancels and suppresses late worker callbacks', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const cancel = startPackingJob(input, { onSuccess, onError });
    const worker = FakeWorker.instances[0];
    const lateMessage = worker.onmessage;
    const lateError = worker.onerror;

    cancel();
    lateMessage?.({ data: { type: 'success', result: { results: [], leftover: [] } } } as MessageEvent);
    lateError?.({ message: 'late' } as ErrorEvent);

    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('uses the synchronous engine when Worker is unavailable', () => {
    vi.stubGlobal('Worker', undefined);
    const onSuccess = vi.fn();

    startPackingJob(input, { onSuccess, onError: vi.fn() });

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      results: [expect.objectContaining({ packed: [expect.objectContaining({ id: 'b1' })] })],
    }));
  });
});
