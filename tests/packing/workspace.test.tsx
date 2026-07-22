import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PackingWorkspace } from '@/components/packing/packing-workspace';

afterEach(cleanup);

describe('PackingWorkspace', () => {
  it('applies a presentation override to the table and resets it before re-optimizing', () => {
    render(<PackingWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /t.i .u x.p h.ng/i }));
    const firstResultRow = screen.getAllByRole('row')[1];
    fireEvent.click(within(firstResultRow).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: /ch.nh tay/i }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'X (m)' }), { target: { value: '.25' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /cho ph.p ghi .. c.nh b.o/i }));
    fireEvent.click(screen.getByRole('button', { name: /.p d.ng v. tr./i }));

    expect(firstResultRow).toHaveTextContent(/0\.3 . 0\.0 . 0\.0/);

    fireEvent.click(screen.getByRole('tab', { name: /chi.n l..c/i }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'maxFill' } });
    fireEvent.click(screen.getByRole('button', { name: /t.i .u x.p h.ng/i }));

    expect(screen.getAllByRole('row')[1]).toHaveTextContent(/0\.0 . 0\.0 . 0\.0/);
  });

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

    expect(screen.getByText(/bước 4\/4/i)).toBeInTheDocument();
    expect(screen.getByText(/đang chọn:/i)).toBeInTheDocument();
  });
});
