import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PackingViewer } from '@/components/packing/packing-viewer';
import type { PackedContainer } from '@/lib/packing/types';

const floorOnlyContainer: PackedContainer = {
  container: { id: 'container-1', name: '5T (VN)', width: 2, height: 2, length: 4, maxWeight: 4800 },
  packed: [{ id: 'box-1', label: 'Kiện sàn', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 1, stackable: false, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
  unpacked: [],
};

afterEach(cleanup);

describe('PackingViewer', () => {
  it('switches to a readable 2D plan', () => {
    render(<PackingViewer packedContainers={[floorOnlyContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} />);

    fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));

    expect(screen.getByLabelText(/sơ đồ xếp 2d/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kiện sàn.*không chồng.*nằm sàn/i })).toBeInTheDocument();
  });

  it('shows fill and floor-only status for the active container', () => {
    render(<PackingViewer packedContainers={[floorOnlyContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} />);

    expect(screen.getByText('1 kiện')).toBeInTheDocument();
    expect(screen.getByText('Lấp đầy 6.3%')).toBeInTheDocument();
    expect(screen.getByText('1 kiện nằm sàn')).toBeInTheDocument();
  });
});
