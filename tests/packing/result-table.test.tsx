import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PackingResultTable } from '@/components/packing/packing-result-table';
import type { PackingResult } from '@/lib/packing/types';

const result: PackingResult = {
  leftover: [],
  results: [{
    container: { id: 'container-1', name: 'Container 1', length: 4, width: 2, height: 2, maxWeight: 1000 },
    unpacked: [],
    packed: [{ id: 'box-1', label: 'Kiện A', length: 1, width: 1, height: 1, weight: 10, color: '#22d3ee', stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
  }],
};

it('selects the matching 3D placement from a result row', () => {
  const onSelectPlacement = vi.fn();
  render(<PackingResultTable result={result} selectedPlacementId={null} onSelectPlacement={onSelectPlacement} />);

  fireEvent.click(screen.getByRole('button', { name: /kiện a/i }));

  expect(onSelectPlacement).toHaveBeenCalledWith('container-1:1');
});
