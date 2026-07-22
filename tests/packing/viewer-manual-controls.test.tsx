import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PackingViewer } from '@/components/packing/packing-viewer';
import { ViewerManualControls } from '@/components/packing/viewer-manual-controls';
import { createPlacementDraft } from '@/lib/packing/manual-layout';
import type { PackedContainer } from '@/lib/packing/types';

const dreiSpies = vi.hoisted(() => ({ transformControls: vi.fn(() => null) }));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="scene-canvas">{children}</div>,
  useThree: () => ({
    camera: { position: { set: vi.fn() }, lookAt: vi.fn(), updateProjectionMatrix: vi.fn(), zoom: 1 },
    size: { width: 1200, height: 700 },
  }),
}));

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  Edges: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OrbitControls: () => null,
  OrthographicCamera: () => null,
  TransformControls: dreiSpies.transformControls,
}));

const packedContainer: PackedContainer = {
  container: { id: 'container-1', name: 'Container 1', width: 3, height: 2, length: 4, maxWeight: 100 },
  packed: [{
    id: 'box-1', label: 'Kiện mẫu', width: 1, height: 1, length: 2, color: '#36c5f0', weight: 10,
    stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0,
  }],
  unpacked: [],
};

const selected = createPlacementDraft(packedContainer.packed[0]);
const callbacks = {
  onEnabledChange: vi.fn(),
  onModeChange: vi.fn(),
  onAxisChange: vi.fn(),
  onSnapChange: vi.fn(),
  onDraftChange: vi.fn(),
  onOverrideChange: vi.fn(),
  onApply: vi.fn(),
  onCancel: vi.fn(),
};

beforeAll(() => {
  Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: class WebGLRenderingContext {} });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});

afterEach(() => {
  cleanup();
  Object.values(callbacks).forEach((callback) => callback.mockClear());
  dreiSpies.transformControls.mockClear();
});

describe('ViewerManualControls', () => {
  it('requires explicit override before applying an invalid placement', () => {
    render(<ViewerManualControls enabled selectedKey="container-1:1" selected={selected} validation={{ valid: false, errors: ['Va chạm kiện khác'] }} override={false} mode="translate" axis="X" snap={.01} {...callbacks} />);

    expect(screen.getByRole('button', { name: 'Áp dụng vị trí' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cho phép ghi đè cảnh báo' }));
    expect(callbacks.onOverrideChange).toHaveBeenLastCalledWith(true);
  });

  it('emits exact metre snap values and exposes translate, rotate and axes', () => {
    render(<ViewerManualControls enabled selectedKey="container-1:1" selected={selected} validation={{ valid: true, errors: [] }} override={false} mode="translate" axis="X" snap={.01} {...callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: '5 cm' }));
    fireEvent.click(screen.getByRole('button', { name: '10 cm' }));
    fireEvent.click(screen.getByRole('button', { name: /rotate/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Trục Z' }));

    expect(callbacks.onSnapChange.mock.calls.map(([value]) => value)).toEqual([.05, .10]);
    expect(callbacks.onModeChange).toHaveBeenCalledWith('rotate');
    expect(callbacks.onAxisChange).toHaveBeenCalledWith('Z');
  });

  it('applies valid drafts, cancels without applying, and edits numeric coordinates', () => {
    render(<ViewerManualControls enabled selectedKey="container-1:1" selected={selected} validation={{ valid: true, errors: [] }} override={false} mode="translate" axis="X" snap={.01} {...callbacks} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'X (m)' }), { target: { value: '.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng vị trí' }));

    expect(callbacks.onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ x: .25 }));
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);
    expect(callbacks.onApply).toHaveBeenCalledTimes(1);
  });

  it('keeps an empty coordinate invalid instead of coercing it to zero', () => {
    render(<ViewerManualControls enabled selectedKey="container-1:1" selected={selected} validation={{ valid: true, errors: [] }} override={false} mode="translate" axis="X" snap={.01} {...callbacks} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'X (m)' }), { target: { value: '' } });

    expect(callbacks.onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ x: Number.NaN }));
  });

  it('resets explicit override when the selected draft changes', () => {
    const { rerender } = render(<ViewerManualControls enabled selectedKey="container-1:1" selected={selected} validation={{ valid: false, errors: ['Va chạm kiện khác'] }} override mode="translate" axis="X" snap={.01} {...callbacks} />);
    callbacks.onOverrideChange.mockClear();

    rerender(<ViewerManualControls enabled selectedKey="container-1:1" selected={{ ...selected, x: .5 }} validation={{ valid: false, errors: ['Va chạm kiện khác'] }} override mode="translate" axis="X" snap={.01} {...callbacks} />);

    expect(callbacks.onOverrideChange).toHaveBeenCalledWith(false);
  });
});

describe('manual TransformControls integration', () => {
  it('returns to Solid and locks observation-mode switching while editing', () => {
    render(<PackingViewer packedContainers={[packedContainer]} selectedPlacementId="container-1:1" onSelectPlacement={() => {}} onApplyPlacementOverride={() => {}} step={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exploded View' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh tay' }));

    expect(screen.getByRole('button', { name: 'Solid' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Exploded View' })).toBeDisabled();
  });

  it('mounts one gizmo only in the primary viewport in Quad View', () => {
    render(<PackingViewer packedContainers={[packedContainer]} selectedPlacementId="container-1:1" onSelectPlacement={() => {}} onApplyPlacementOverride={() => {}} step={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh tay' }));
    dreiSpies.transformControls.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));

    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(4);
    expect(dreiSpies.transformControls).toHaveBeenCalledTimes(1);
  });

  it('mounts one gizmo only in the primary viewport in PIP', () => {
    render(<PackingViewer packedContainers={[packedContainer]} selectedPlacementId="container-1:1" onSelectPlacement={() => {}} onApplyPlacementOverride={() => {}} step={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh tay' }));
    dreiSpies.transformControls.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'PIP' }));

    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(3);
    expect(dreiSpies.transformControls).toHaveBeenCalledTimes(1);
  });
});
