import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const multiContainerResult = vi.hoisted(() => ({
  results: [
    {
      container: { id: 'container-1', name: 'Container 1', width: 2, height: 2, length: 4, maxWeight: 1000 },
      packed: [{ id: 'box-1', label: 'Kiện đầu', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
      unpacked: [],
    },
    {
      container: { id: 'container-2', name: 'Container 2', width: 2, height: 2, length: 4, maxWeight: 1000 },
      packed: [{ id: 'box-2', label: 'Kiện sau', width: 1, height: 1, length: 1, color: '#a78bfa', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 1, itemIndex: 0 }],
      unpacked: [],
    },
  ],
  leftover: [],
}));

vi.mock('@/lib/packing/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/packing/engine')>();
  return { ...actual, packWithPresetContainers: vi.fn(() => multiContainerResult) };
});

import { PackingWorkspace } from '@/components/packing/packing-workspace';

afterEach(cleanup);

describe('PackingWorkspace global playback', () => {
  it('advances a selected second-container table row to its global playback offset', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));
    expect(screen.getByText('Bước 0/2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kiện sau' }));

    expect(screen.getByText('Bước 2/2')).toBeInTheDocument();
  });
});
