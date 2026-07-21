import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PackingViewer } from '@/components/packing/packing-viewer';

describe('PackingViewer', () => {
  it('switches to a readable 2D plan', () => {
    render(<PackingViewer packedContainers={[]} selectedPlacementId={null} onSelectPlacement={() => {}} step={0} />);

    fireEvent.click(screen.getByRole('button', { name: /mặt bằng 2d/i }));

    expect(screen.getByLabelText(/sơ đồ xếp 2d/i)).toBeInTheDocument();
  });
});
