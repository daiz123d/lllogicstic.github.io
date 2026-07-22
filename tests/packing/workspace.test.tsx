import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fileIoMocks = vi.hoisted(() => ({
  downloadPackingWorkbook: vi.fn(async () => {}),
  readRowsFromFile: vi.fn(async () => [] as Record<string, unknown>[]),
}));

vi.mock('@/lib/packing/file-io', () => fileIoMocks);

import { PackingWorkspace } from '@/components/packing/packing-workspace';

beforeEach(() => {
  fileIoMocks.downloadPackingWorkbook.mockClear();
  fileIoMocks.readRowsFromFile.mockReset();
  fileIoMocks.readRowsFromFile.mockResolvedValue([]);
});

afterEach(cleanup);

function optimizeAndApplyOverride() {
  fireEvent.click(screen.getByRole('button', { name: /t.i .u x.p h.ng/i }));
  const firstResultRow = screen.getAllByRole('row')[1];
  fireEvent.click(within(firstResultRow).getByRole('button'));
  fireEvent.click(screen.getByRole('button', { name: /ch.nh tay/i }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'X (m)' }), { target: { value: '.25' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /cho ph.p ghi .. c.nh b.o/i }));
  fireEvent.click(screen.getByRole('button', { name: /.p d.ng v. tr./i }));
  expect(firstResultRow).toHaveTextContent(/0\.3 . 0\.0 . 0\.0/);
}

function expectAutomaticCoordinates() {
  expect(screen.getAllByRole('row')[1]).toHaveTextContent(/0\.0 . 0\.0 . 0\.0/);
}

describe('PackingWorkspace', () => {
  it('scopes status announcements instead of nesting the entire simulation stage', () => {
    const { container } = render(<PackingWorkspace />);

    expect(container.querySelector('.simulation-stage')).not.toHaveAttribute('aria-live');
    expect(container.querySelector('.stage-status')).toHaveAttribute('role', 'status');
    expect(container.querySelector('.stage-status')).toHaveAttribute('aria-live', 'polite');
  });

  it('applies a presentation override to the table and resets it before re-optimizing', () => {
    render(<PackingWorkspace />);

    optimizeAndApplyOverride();

    fireEvent.click(screen.getByRole('tab', { name: /chi.n l..c/i }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'maxFill' } });
    fireEvent.click(screen.getByRole('button', { name: /t.i .u x.p h.ng/i }));

    expectAutomaticCoordinates();
  });

  it.each([
    ['workspace reset', () => fireEvent.click(screen.getByRole('button', { name: /..t l.i/i }))],
    ['container-mode change', () => {
      fireEvent.click(screen.getByRole('tab', { name: /^container$/i }));
      fireEvent.click(screen.getByRole('radio', { name: /d.ng container t. nh.p/i }));
      fireEvent.click(screen.getByRole('radio', { name: /t. ch.n container m.u/i }));
    }],
    ['rotation-policy change', () => {
      fireEvent.click(screen.getByRole('tab', { name: /chi.n l..c/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /cho ph.p xoay ki.n/i }));
    }],
  ] as const)('clears a presentation override after %s', (_label, resetAction) => {
    render(<PackingWorkspace />);
    optimizeAndApplyOverride();

    resetAction();
    fireEvent.click(screen.getByRole('button', { name: /t.i .u x.p h.ng/i }));

    expectAutomaticCoordinates();
  });

  it('clears a presentation override after a successful carton import', async () => {
    fileIoMocks.readRowsFromFile.mockResolvedValue([{ 'Dài': 1, 'Rộng': 1, 'Cao': 1, 'Số lượng': 1, 'Khối lượng': 1, 'Có thể chồng': 'có' }]);
    const { container } = render(<PackingWorkspace />);
    optimizeAndApplyOverride();

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['fixture'], 'cartons.csv', { type: 'text/csv' })] } });
    await waitFor(() => expect(fileIoMocks.readRowsFromFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Bảng chi tiết phương án xếp' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /t.i .u x.p h.ng/i }));

    expectAutomaticCoordinates();
  });

  it('exports the immutable automatic result while keeping presentation coordinates local', async () => {
    render(<PackingWorkspace />);
    optimizeAndApplyOverride();

    fireEvent.click(screen.getByRole('button', { name: /xu.t xlsx/i }));
    await waitFor(() => expect(fileIoMocks.downloadPackingWorkbook).toHaveBeenCalledTimes(1));

    const exportedResult = fileIoMocks.downloadPackingWorkbook.mock.calls[0][2];
    expect(exportedResult?.results[0].packed[0]).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(screen.getAllByRole('row')[1]).toHaveTextContent(/0\.3 . 0\.0 . 0\.0/);
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
