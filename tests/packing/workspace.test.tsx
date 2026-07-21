import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PackingWorkspace } from '@/components/packing/packing-workspace';

describe('PackingWorkspace', () => {
  it('packs the sample cartons when the user starts optimization', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));

    expect(screen.getByText(/đã xếp 4 kiện/i)).toBeInTheDocument();
  });
});
