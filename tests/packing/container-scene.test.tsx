import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PackingViewer } from '@/components/packing/packing-viewer';
import type { PackedContainer } from '@/lib/packing/types';

const packedContainer: PackedContainer = {
  container: { id: 'container-1', name: '5T (VN)', width: 2, height: 2, length: 4, maxWeight: 4800 },
  packed: [{ id: 'box-1', label: 'Kiện mẫu', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 100, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
  unpacked: [],
};

function renderViewer({ packedContainers = [packedContainer], step = 1 }: Partial<React.ComponentProps<typeof PackingViewer>> = {}) {
  return render(<PackingViewer packedContainers={packedContainers} selectedPlacementId={null} onSelectPlacement={() => {}} step={step} />);
}

afterEach(cleanup);

describe('ContainerScene viewer contract', () => {
  it('exposes the cutaway canvas and fit control without WebGL-only text loss', () => {
    renderViewer({ packedContainers: [packedContainer], step: 1 });

    expect(screen.getByRole('button', { name: 'Vừa khung hình' })).toBeInTheDocument();
    expect(screen.getByText('Isometric')).toBeInTheDocument();
  });

  it('keeps shell layer controls accessible', () => {
    renderViewer({ packedContainers: [packedContainer], step: 1 });

    expect(screen.getByRole('checkbox', { name: 'Thành trái' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Nóc container' })).toBeChecked();
  });
});
