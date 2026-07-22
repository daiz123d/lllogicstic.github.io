import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { getCargoFocus, getGlobalPlacementStep, getVisiblePlacementCount, PackingViewer } from '@/components/packing/packing-viewer';
import type { PackedContainer } from '@/lib/packing/types';

const floorOnlyContainer: PackedContainer = {
  container: { id: 'container-1', name: '5T (VN)', width: 2, height: 2, length: 4, maxWeight: 4800 },
  packed: [{ id: 'box-1', label: 'Kiện sàn', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 1, stackable: false, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
  unpacked: [],
};

afterEach(cleanup);

describe('PackingViewer', () => {
  it('keeps an empty plan distinct from a packed plan', () => {
    render(<PackingViewer packedContainers={[]} selectedPlacementId={null} onSelectPlacement={() => {}} step={0} />);

    fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));

    expect(screen.getByLabelText(/sơ đồ xếp 2d/i)).toHaveTextContent(/chưa có kiện nào để hiển thị/i);
  });

  it('uses a cargo framing span clamped to 45% of the largest container dimension', () => {
    expect(getCargoFocus(floorOnlyContainer, floorOnlyContainer.packed).span).toBe(1.8);
  });

  it('exposes the floor-only explanation in the packed 2D accessible label', () => {
    render(<PackingViewer packedContainers={[floorOnlyContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} />);

    fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));

    expect(screen.getByLabelText(/sơ đồ xếp 2d/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kiện sàn.*không chồng.*nằm sàn/i })).toBeInTheDocument();
  });

  it('gives floor-only cartons a distinct plan class', () => {
    render(<PackingViewer packedContainers={[floorOnlyContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} />);

    fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));

    expect(screen.getAllByRole('button').find((button) => button.classList.contains('plan-box'))).toHaveClass('floor-only');
  });

  it('shows fill and floor-only status for the active container', () => {
    render(<PackingViewer packedContainers={[floorOnlyContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} />);

    expect(screen.getByText('1 kiện')).toBeInTheDocument();
    expect(screen.getByText('Lấp đầy 6.3%')).toBeInTheDocument();
    expect(screen.getByText('1 kiện nằm sàn')).toBeInTheDocument();
  });

  it('shows the selected placement container when selection comes from the result table', () => {
    const secondContainer: PackedContainer = {
      ...floorOnlyContainer,
      container: { ...floorOnlyContainer.container, id: 'container-2', name: 'Container 2' },
      packed: [{ ...floorOnlyContainer.packed[0], order: 2 }],
    };

    render(<PackingViewer packedContainers={[floorOnlyContainer, secondContainer]} selectedPlacementId="container-2:2" onSelectPlacement={() => {}} step={1} />);

    expect(screen.getByRole('heading', { name: 'Container 2' })).toBeInTheDocument();
  });

  it('reveals containers in global result order instead of applying the step to every container', () => {
    const firstContainer: PackedContainer = {
      ...floorOnlyContainer,
      container: { ...floorOnlyContainer.container, id: 'container-1', name: 'Container 1' },
      packed: [{ ...floorOnlyContainer.packed[0], label: 'Kiện đầu', order: 1 }],
    };
    const secondContainer: PackedContainer = {
      ...floorOnlyContainer,
      container: { ...floorOnlyContainer.container, id: 'container-2', name: 'Container 2' },
      packed: [{ ...floorOnlyContainer.packed[0], id: 'box-2', label: 'Kiện sau', order: 1 }],
    };
    const packedContainers = [firstContainer, secondContainer];

    expect(getVisiblePlacementCount(packedContainers, firstContainer.container.id, 1)).toBe(1);
    expect(getVisiblePlacementCount(packedContainers, secondContainer.container.id, 1)).toBe(0);
    expect(getGlobalPlacementStep(packedContainers, secondContainer.container.id, 0)).toBe(2);

    render(<PackingViewer packedContainers={packedContainers} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} />);
    fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));
    expect(screen.getByRole('button', { name: /kiện đầu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Container 2' }));
    expect(screen.queryByRole('button', { name: /kiện sau/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Đã xếp 1 \/ 2/i)).toBeInTheDocument();
  });
});
