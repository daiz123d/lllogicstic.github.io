import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PackingWorkspace } from '@/components/packing/packing-workspace';

afterEach(cleanup);

describe('PackingWorkspace', () => {
  it('uses a standard sample container when optimisation starts', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));

    expect(screen.getAllByText('2.5T (VN)')[0]).toBeVisible();
  });

  it('packs the sample cartons when the user starts optimization', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));

    expect(screen.getByText(/xếp 4 ki.n/i)).toBeInTheDocument();
  });
});
