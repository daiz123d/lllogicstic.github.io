import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const multiContainerResult = vi.hoisted(() => ({
  results: [
    {
      container: { id: 'container-1', name: 'Container 1', width: 2, height: 2, length: 4, maxWeight: 1000 },
      packed: [{ id: 'box-1', label: 'Kiện đầu', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
      unpacked: [
        { id: 'box-2', label: 'Kiện sau', width: 1, height: 1, length: 1, color: '#a78bfa', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 1, itemIndex: 0, reason: 'no-space' },
        { id: 'box-3', label: 'Kiện dư thật', width: 3, height: 3, length: 5, color: '#fb7185', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 2, sourceIndex: 2, itemIndex: 0, reason: 'oversize' },
      ],
    },
    {
      container: { id: 'container-2', name: 'Container 2', width: 2, height: 2, length: 4, maxWeight: 1000 },
      packed: [{ id: 'box-2', label: 'Kiện sau', width: 1, height: 1, length: 1, color: '#a78bfa', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 1, itemIndex: 0 }],
      unpacked: [{ id: 'box-3', label: 'Kiện dư thật', width: 3, height: 3, length: 5, color: '#fb7185', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 2, sourceIndex: 2, itemIndex: 0, reason: 'oversize' }],
    },
  ],
  leftover: [{ id: 'box-3', label: 'Kiện dư thật', width: 3, height: 3, length: 5, color: '#fb7185', weight: 1, stackable: true, x: 0, y: 0, z: 0, order: 2, sourceIndex: 2, itemIndex: 0, reason: 'oversize' }],
}));

vi.mock('@/lib/packing/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/packing/engine')>();
  return { ...actual, packWithPresetContainers: vi.fn(() => multiContainerResult) };
});

import { PackingWorkspace } from '@/components/packing/packing-workspace';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PackingWorkspace global playback', () => {
  it('advances a selected second-container table row to its global playback offset', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));
    expect(screen.getByText('Bước 0/2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kiện sau' }));

    expect(screen.getByText('Bước 2/2')).toBeInTheDocument();
  });

  it('shows global packed progress and only final leftovers in the viewer HUD', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));
    fireEvent.change(screen.getByRole('slider', { name: 'Tiến trình xếp hàng' }), { target: { value: '2' } });

    const hud = screen.getByLabelText('Chỉ số mô phỏng');
    expect(hud).toHaveTextContent('Đã xếp 2 / 3 kiện');
    expect(within(hud).getByText('Chưa xếp 1 kiện')).toHaveClass('coral');
    const warnings = within(hud).getByLabelText('Cảnh báo kiện chưa xếp');
    expect(warnings).toHaveTextContent('Kiện dư thật: Quá kích thước');
    expect(warnings).not.toHaveTextContent('Kiện sau');
  });

  it('keeps paused manual tabs and follows timer-driven container boundaries', () => {
    vi.useFakeTimers();
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Container 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Tiến trình xếp hàng' }), { target: { value: '0' } });
    const viewer = screen.getByLabelText('Hybrid Isometric Cutaway');
    expect(within(viewer).getByRole('heading', { name: 'Container 2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByText('Bước 1/2')).toBeInTheDocument();
    expect(within(viewer).getByRole('heading', { name: 'Container 1' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByText('Bước 2/2')).toBeInTheDocument();
    expect(within(viewer).getByRole('heading', { name: 'Container 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phát' })).toBeInTheDocument();
  });
});
