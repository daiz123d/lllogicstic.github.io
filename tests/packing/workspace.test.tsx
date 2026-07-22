import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PackingWorkspace } from '@/components/packing/packing-workspace';

afterEach(cleanup);

describe('PackingWorkspace', () => {
  it('summarizes the selected sample containers when optimisation starts', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));

    expect(screen.getByText(/\u0110\u00e3 t\u1ef1 ch\u1ecdn 2 \u00d7 1\.25T \(VN\) \u0111\u1ec3 x\u1ebfp 4 ki\u1ec7n/i)).toBeInTheDocument();
  });

  it('packs the sample cartons when the user starts optimization', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));

    expect(screen.getByText(/xếp 4 ki.n/i)).toBeInTheDocument();
  });
});
