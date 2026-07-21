import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PackingWorkspace } from '@/components/packing/packing-workspace';

describe('PackingWorkspace', () => {
  it('packs the sample cartons when the user presses Xếp thùng', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /^xếp thùng$/i }));

    expect(screen.getByText(/đã xếp 4 kiện/i)).toBeInTheDocument();
  });
});
