import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ViewerControls, ViewerHud } from '@/components/packing/viewer-controls';
import type { Placement } from '@/lib/packing/types';
import type { ViewerMetrics } from '@/components/packing/viewer-types';

const metrics: ViewerMetrics = {
  usedVolume: 1,
  volumePercent: 6.25,
  usedWeight: 100,
  maxWeight: 4800,
  weightPercent: 2.083,
  packed: 1,
  total: 2,
  floorOnly: 0,
};

const placement: Placement = {
  id: 'box-1', label: 'Kiện A', width: 1, height: 2, length: 3, weight: 100,
  color: '#22d3ee', stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0,
};

afterEach(cleanup);

it('shows complete HUD metrics and selected coordinates', () => {
  render(<ViewerHud metrics={metrics} selected={placement} leftovers={[]} />);

  expect(screen.getByText('Thể tích 6.3%')).toBeInTheDocument();
  expect(screen.getByText('Tải trọng 100 / 4.800 kg')).toBeInTheDocument();
  expect(screen.getByText('X 0.00 · Y 0.00 · Z 0.00')).toBeInTheDocument();
});

it('announces only the changing packed count instead of the complete HUD', () => {
  render(<ViewerHud metrics={metrics} selected={placement} leftovers={[]} />);

  expect(screen.getByLabelText('Chỉ số mô phỏng')).not.toHaveAttribute('aria-live');
  expect(screen.getByText('Đã xếp 1 / 2 kiện')).toHaveAttribute('aria-live', 'polite');
  expect(screen.getByText('Đã xếp 1 / 2 kiện')).toHaveAttribute('aria-atomic', 'true');
});

it('exposes pressed view controls and checked shell controls', () => {
  const onModeChange = vi.fn();
  render(<ViewerControls
    mode="solid"
    shell={{ all: true, left: true, right: true, roof: true, front: false }}
    preset="iso"
    metrics={metrics}
    selected={placement}
    leftovers={[]}
    onModeChange={onModeChange}
    onShellChange={() => {}}
    onPresetChange={() => {}}
    onFit={() => {}}
  />);

  fireEvent.click(screen.getByRole('button', { name: 'Wireframe' }));

  expect(onModeChange).toHaveBeenCalledWith('wireframe');
  expect(screen.getByRole('button', { name: 'Isometric' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('checkbox', { name: 'Thành trái' })).toBeChecked();
});
