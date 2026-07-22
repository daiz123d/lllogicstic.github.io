import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PackingWorkspace } from '@/components/packing/packing-workspace';

afterEach(cleanup);

describe('PackingWorkspace', () => {
  it('summarizes the selected sample containers when optimisation starts', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));

    expect(screen.getByText(/Đã tự chọn 1 × 2\.5T \(VN\) để xếp 4 kiện/i)).toBeInTheDocument();
  });

  it('packs the sample cartons when the user starts optimization', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));

    expect(screen.getByText(/xếp 4 ki.n/i)).toBeInTheDocument();
  });

  it('reveals a future placement when its result row is selected', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));
    fireEvent.change(screen.getByLabelText(/tiến trình xếp hàng/i), { target: { value: '1' } });
    fireEvent.click(within(screen.getAllByRole('row').at(-1)!).getByRole('button', { name: /hộp mẫu/i }));

    expect(screen.getByText(/kiện 4 \/ 4/i)).toBeInTheDocument();
    expect(screen.getByText(/đang chọn:/i)).toBeInTheDocument();
  });
});
