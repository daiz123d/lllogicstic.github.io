import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { getPlacementRenderPosition } from '@/components/packing/container-scene';
import { PackingViewer } from '@/components/packing/packing-viewer';
import type { PackedContainer } from '@/lib/packing/types';

const modelSpies = vi.hoisted(() => ({
  getEmptyRegions: vi.fn(() => [{ id: 'empty-0', x: 1, y: 0, z: 0, width: 1, height: 2, length: 4 }]),
  getHeatColor: vi.fn((mode: 'weight' | 'height') => mode === 'weight' ? '#ef4444' : '#fb7185'),
}));

vi.mock('@/components/packing/viewer-model', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/packing/viewer-model')>(),
  getEmptyRegions: modelSpies.getEmptyRegions,
  getHeatColor: modelSpies.getHeatColor,
}));

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
}));

const packedContainer: PackedContainer = {
  container: { id: 'container-1', name: '5T (VN)', width: 2, height: 2, length: 4, maxWeight: 4800 },
  packed: [
    { id: 'box-1', label: 'Kiện mẫu', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 100, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 },
    { id: 'box-2', label: 'Kiện tầng hai', width: 1, height: 1, length: 1, color: '#f59e0b', weight: 200, stackable: true, x: 0, y: 1, z: 0, order: 2, sourceIndex: 1, itemIndex: 0 },
  ],
  unpacked: [],
};

function renderViewer(props: Partial<React.ComponentProps<typeof PackingViewer>> = {}) {
  return render(<PackingViewer packedContainers={[packedContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={2} {...props} />);
}

function mockMobile(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(max-width: 639px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeAll(() => {
  Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: class WebGLRenderingContext {} });
});

afterEach(() => {
  cleanup();
  modelSpies.getEmptyRegions.mockClear();
  modelSpies.getHeatColor.mockClear();
  mockMobile(false);
});

describe('ViewerViewports', () => {
  it('switches between single, PIP and Quad View and only mounts enabled canvases', () => {
    renderViewer();

    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'PIP' }));
    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));

    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(4);
    expect(screen.getByLabelText('Isometric viewport')).toBeInTheDocument();
    expect(screen.getByLabelText('Mặt trên viewport')).toBeInTheDocument();
    expect(screen.getByLabelText('Mặt trước viewport')).toBeInTheDocument();
    expect(screen.getByLabelText('Mặt bên viewport')).toBeInTheDocument();
  });

  it('collapses and restores an individual PIP without mounting its canvas', () => {
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'PIP' }));

    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn Mặt trên' }));
    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Mở Mặt trên PIP' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mở Mặt trên PIP' }));
    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(3);
  });

  it('exchanges a clicked PIP preset with the main viewport', () => {
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'PIP' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dùng Mặt trên làm khung chính' }));

    expect(screen.getByLabelText('Mặt trên viewport chính')).toBeInTheDocument();
    expect(screen.getByLabelText('Isometric viewport PIP')).toBeInTheDocument();
  });

  it('shares selection across all Quad View scenes', () => {
    function SelectionHarness() {
      const [selected, setSelected] = useState<string | null>(null);
      return <PackingViewer packedContainers={[packedContainer]} selectedPlacementId={selected} onSelectPlacement={setSelected} step={2} />;
    }
    const { container } = render(<SelectionHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));

    const idlePlacements = container.querySelectorAll('group[name="placement-container-1:1-idle"]');
    expect(idlePlacements).toHaveLength(4);
    fireEvent.click(idlePlacements[0].querySelector('mesh')!);

    expect(container.querySelectorAll('group[name="placement-container-1:1-selected"]')).toHaveLength(4);
  });

  it('uses one canvas plus preset tabs for Quad View below 640px', () => {
    mockMobile(true);
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));

    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Mặt trước' }));
    expect(screen.getByLabelText('Mặt trước viewport')).toBeInTheDocument();
  });
});

describe('observation modes', () => {
  it.each(['Solid', 'X-Ray', 'Wireframe', 'Tải trọng', 'Chiều cao', 'Khoảng trống', 'Exploded View'])('exposes %s mode', (label) => {
    renderViewer();
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('computes and renders empty regions only while Space mode is active', () => {
    const { container } = renderViewer();
    expect(modelSpies.getEmptyRegions).not.toHaveBeenCalled();
    expect(container.querySelector('[name^="empty-region-"]')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Khoảng trống' }));

    expect(modelSpies.getEmptyRegions).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[name="empty-region-empty-0"]')).toBeInTheDocument();
  });

  it('shares one Space calculation across four Quad View canvases', () => {
    const { container } = renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));

    fireEvent.click(screen.getByRole('button', { name: 'Khoảng trống' }));

    expect(modelSpies.getEmptyRegions).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('[name="empty-region-empty-0"]')).toHaveLength(4);
  });

  it('uses heat colors without changing source placement colors', () => {
    const originalColors = packedContainer.packed.map((placement) => placement.color);
    renderViewer();

    fireEvent.click(screen.getByRole('button', { name: 'Tải trọng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiều cao' }));

    expect(modelSpies.getHeatColor).toHaveBeenCalledWith('weight', expect.any(Number));
    expect(modelSpies.getHeatColor).toHaveBeenCalledWith('height', expect.any(Number));
    expect(packedContainer.packed.map((placement) => placement.color)).toEqual(originalColors);
  });

  it('shows the exact observation warning only in Exploded View', () => {
    renderViewer();
    expect(screen.queryByText('Chế độ quan sát – không phải vị trí thực tế')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exploded View' }));
    expect(screen.getByText('Chế độ quan sát – không phải vị trí thực tế')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Solid' }));
    expect(screen.queryByText('Chế độ quan sát – không phải vị trí thực tế')).not.toBeInTheDocument();
  });

  it('offsets exploded layers by 0.28 without mutating placement coordinates', () => {
    const originalPlacements = structuredClone(packedContainer.packed);
    const upperPlacement = packedContainer.packed[1];

    const solidPosition = getPlacementRenderPosition(packedContainer, packedContainer.packed, upperPlacement, 'solid');
    const explodedPosition = getPlacementRenderPosition(packedContainer, packedContainer.packed, upperPlacement, 'exploded');

    expect(explodedPosition[1] - solidPosition[1]).toBeCloseTo(.28);
    expect(packedContainer.packed).toEqual(originalPlacements);
  });
});
