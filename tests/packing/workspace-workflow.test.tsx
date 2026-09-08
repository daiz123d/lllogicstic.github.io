import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { packWithPresetContainers } from '@/lib/packing/engine';
import type { PackingJobCallbacks } from '@/lib/packing/packing-job';
import { WORKSPACE_STORAGE_KEY } from '@/lib/packing/workspace-storage';

const runtime = vi.hoisted(() => ({
  callbacks: [] as PackingJobCallbacks[],
  cancel: vi.fn(),
  readRows: vi.fn<() => Promise<Record<string, unknown>[]>>(),
}));
vi.mock('@/lib/packing/packing-job', () => ({
  startPackingJob: (_input: unknown, callbacks: PackingJobCallbacks) => {
    runtime.callbacks.push(callbacks);
    return runtime.cancel;
  },
}));
vi.mock('@/lib/packing/file-io', () => ({ readRowsFromFile: runtime.readRows, downloadPackingWorkbook: vi.fn() }));

import { PackingWorkspace } from '@/components/packing/packing-workspace';

const result = packWithPresetContainers([{ id: 'test-box', label: 'Hộp mẫu', length: 1, width: 1, height: 1, weight: 1, quantity: 4, color: '#36c5f0', stackable: true }]);

beforeEach(() => {
  runtime.callbacks.length = 0;
  runtime.cancel.mockClear();
  runtime.readRows.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function optimize() {
  fireEvent.click(screen.getByRole('button', { name: 'Tối ưu xếp hàng' }));
}

it('ignores a late result after editing cargo during computation', () => {
  render(<PackingWorkspace />);
  optimize();
  expect(screen.getByRole('button', { name: 'Hủy tối ưu' })).toBeVisible();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Số lượng' }), { target: { value: '7' } });
  act(() => runtime.callbacks[0].onSuccess(result));
  expect(runtime.cancel).toHaveBeenCalled();
  expect(screen.queryByText('Bước 4/4')).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: 'Số lượng' })).toHaveValue(7);
  expect(screen.getByRole('button', { name: 'Xuất XLSX' })).toBeDisabled();
});

it('keeps the last completed plan when cancelling a rerun and ignores its late callback', () => {
  render(<PackingWorkspace />);
  optimize();
  act(() => runtime.callbacks[0].onSuccess(result));
  optimize();
  expect(screen.getByRole('button', { name: 'Xuất XLSX' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy tối ưu' }));
  act(() => runtime.callbacks[1].onSuccess({ results: [], leftover: [] }));
  expect(screen.getByText('Bước 4/4')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xuất XLSX' })).toBeEnabled();
});

it('reports worker errors and makes optimization available again', () => {
  render(<PackingWorkspace />);
  optimize();
  act(() => runtime.callbacks[0].onError(new Error('Lỗi tính toán')));
  expect(screen.getByText('Không thể tính phương án: Lỗi tính toán')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tối ưu xếp hàng' })).toBeEnabled();
});

it('cancels pending computation on unmount', () => {
  const { unmount } = render(<PackingWorkspace />);
  optimize();
  unmount();
  expect(runtime.cancel).toHaveBeenCalledTimes(1);
});

it('ignores an import finishing after reset', async () => {
  let finish!: (rows: Record<string, unknown>[]) => void;
  runtime.readRows.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const { container } = render(<PackingWorkspace />);
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['fixture'], 'hang.csv')] } });
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
  await act(async () => finish([{ label: 'Không được thêm', length: 1, width: 1, height: 1 }]));
  expect(screen.queryByDisplayValue('Không được thêm')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Tên / nhãn' })).toHaveValue('Hộp mẫu');
});

it('saves and restores inputs, computed results and manual adjustments without rerunning', () => {
  vi.useFakeTimers();
  const first = render(<PackingWorkspace />);
  optimize();
  act(() => runtime.callbacks[0].onSuccess(result));
  fireEvent.click(within(screen.getAllByRole('row')[1]).getByRole('button'));
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh tay' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'X (m)' }), { target: { value: '.25' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cho phép ghi đè cảnh báo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng vị trí' }));
  act(() => vi.advanceTimersByTime(450));
  expect(screen.getByText('Đã lưu trên máy')).toBeInTheDocument();
  first.unmount();
  render(<PackingWorkspace />);
  expect(screen.getByText('Bước 4/4')).toBeInTheDocument();
  expect(screen.getAllByRole('row')[1]).toHaveTextContent(/0\.3 . 0\.0 . 0\.0/);
  expect(runtime.callbacks).toHaveLength(1);
});

it('flushes the latest inputs on pagehide before the debounce expires', () => {
  render(<PackingWorkspace />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Số lượng' }), { target: { value: '9' } });
  fireEvent(window, new Event('pagehide'));
  const saved = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!);
  expect(saved.cartons[0].quantity).toBe(9);
});

it('shows a persistence failure without discarding the active plan', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded'); });
  render(<PackingWorkspace />);
  optimize();
  act(() => runtime.callbacks[0].onSuccess(result));
  await waitFor(() => expect(screen.getByText('Chưa lưu được trên máy')).toBeInTheDocument());
  expect(screen.getByText('Bước 4/4')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xuất XLSX' })).toBeEnabled();
});
