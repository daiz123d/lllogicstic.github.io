import { describe, expect, it } from 'vitest';

import { packMultipleContainers } from '@/lib/packing/engine';
import {
  WORKSPACE_STORAGE_KEY,
  readWorkspaceSnapshot,
  writeWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '@/lib/packing/workspace-storage';

const snapshot: WorkspaceSnapshot = {
  version: 1,
  containers: [{ id: 'c1', name: 'Draft', width: 0, height: -1, length: 2.5, quantity: .5, maxWeight: 0 }],
  cartons: [{ id: 'b1', label: '', width: 0, height: -2, length: .5, quantity: 0, color: '', weight: -1, stackable: false }],
  containerMode: 'manual',
  allowRotation: true,
  strategy: 'heavyBottom',
  result: null,
  placementOverrides: { 'c1:1': { x: 0, y: -1, z: 2, width: 1, height: 1, length: 1 } },
};

describe('workspace storage', () => {
  it('roundtrips finite editable drafts', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    writeWorkspaceSnapshot(snapshot, storage);
    expect(values.has(WORKSPACE_STORAGE_KEY)).toBe(true);
    expect(readWorkspaceSnapshot(storage)).toEqual(snapshot);
  });

  it('roundtrips an actual engine result containing rejected cartons', () => {
    const result = packMultipleContainers(
      [{ id: 'small', name: 'Small', width: 1, height: 1, length: 1, quantity: 1, maxWeight: 10 }],
      [{ id: 'large', label: 'Large', width: 2, height: 2, length: 2, quantity: 1, color: '#fff', weight: 1, stackable: true }],
    );
    const actualSnapshot: WorkspaceSnapshot = { ...snapshot, result };
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(result.leftover[0]).not.toHaveProperty('x');
    writeWorkspaceSnapshot(actualSnapshot, storage);
    expect(readWorkspaceSnapshot(storage)).toEqual(actualSnapshot);
  });

  it.each([
    '{',
    JSON.stringify({ ...snapshot, version: 2 }),
    JSON.stringify({ ...snapshot, strategy: 'fastest' }),
    JSON.stringify({ ...snapshot, cartons: [{ ...snapshot.cartons[0], width: Infinity }] }),
    JSON.stringify({ ...snapshot, result: { results: [], leftover: [{ reason: 'mystery' }] } }),
    JSON.stringify({ ...snapshot, placementOverrides: { key: { ...snapshot.placementOverrides['c1:1'], x: '0' } } }),
  ])('returns null for corrupt or unsupported data', (stored) => {
    expect(readWorkspaceSnapshot({ getItem: () => stored })).toBeNull();
  });

  it('returns null when no snapshot exists', () => {
    expect(readWorkspaceSnapshot({ getItem: () => null })).toBeNull();
  });

  it('lets storage read and write failures reach the caller', () => {
    const readFailure = new Error('read denied');
    const writeFailure = new Error('quota exceeded');
    expect(() => readWorkspaceSnapshot({ getItem: () => { throw readFailure; } })).toThrow(readFailure);
    expect(() => writeWorkspaceSnapshot(snapshot, { setItem: () => { throw writeFailure; } })).toThrow(writeFailure);
  });
});
