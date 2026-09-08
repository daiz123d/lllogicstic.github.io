import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { getPlacementEntryRenderPosition, getPlacementRenderPosition } from '@/components/packing/container-scene';
import { hasWebglSupport, PackingViewer, SceneErrorBoundary } from '@/components/packing/packing-viewer';
import type { PlaybackTransitionDescriptor } from '@/components/packing/viewer-types';
import type { PackedContainer } from '@/lib/packing/types';

const modelSpies = vi.hoisted(() => ({
  getEmptyRegions: vi.fn(() => [{ id: 'empty-0', x: 1, y: 0, z: 0, width: 1, height: 2, length: 4 }]),
  getHeatColor: vi.fn((mode: 'weight' | 'height') => mode === 'weight' ? '#ef4444' : '#fb7185'),
}));
const canvasSpies = vi.hoisted(() => ({ render: vi.fn(), active: 0, peak: 0 }));

vi.mock('@/components/packing/viewer-model', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/packing/viewer-model')>(),
  getEmptyRegions: modelSpies.getEmptyRegions,
  getHeatColor: modelSpies.getHeatColor,
}));

vi.mock('@react-three/fiber', async () => {
  const { useEffect: useReactEffect } = await import('react');
  return {
    Canvas: ({ children, onPointerMissed }: { children: React.ReactNode; onPointerMissed?: () => void }) => {
      canvasSpies.render();
      useReactEffect(() => {
        canvasSpies.active += 1;
        canvasSpies.peak = Math.max(canvasSpies.peak, canvasSpies.active);
        return () => { canvasSpies.active -= 1; };
      }, []);
      return <div data-testid="scene-canvas" onClick={onPointerMissed}>{children}</div>;
    },
    useThree: () => ({
      invalidate: vi.fn(),
      camera: { position: { set: vi.fn() }, lookAt: vi.fn(), updateProjectionMatrix: vi.fn(), zoom: 1 },
      size: { width: 1200, height: 700 },
    }),
  };
});

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  Edges: ({ color }: { color: string }) => <i data-edge-color={color} />,
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

function setWebglSupport(supported: boolean) {
  Reflect.deleteProperty(window, 'WebGLRenderingContext');
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn((contextId: string) => supported && (contextId === 'webgl2' || contextId === 'webgl') ? {} : null),
  });
}

beforeAll(() => {
  setWebglSupport(true);
});

afterEach(() => {
  cleanup();
  modelSpies.getEmptyRegions.mockClear();
  modelSpies.getHeatColor.mockClear();
  canvasSpies.render.mockClear();
  canvasSpies.active = 0;
  canvasSpies.peak = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mockMobile(false);
  setWebglSupport(true);
});

describe('WebGL fallback', () => {
  it('reports a scene render error to the viewer failure callback', () => {
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const BrokenScene = () => { throw new Error('scene failed'); };

    render(<SceneErrorBoundary onError={onError}><BrokenScene /></SceneErrorBoundary>);

    expect(onError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('uses a hydration-stable checking state before client effects run', () => {
    vi.stubGlobal('window', undefined);
    try {
      expect(renderToString(<PackingViewer packedContainers={[packedContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={2} />)).toContain('Đang kiểm tra hỗ trợ WebGL');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('probes a real canvas context instead of trusting the WebGL constructor', () => {
    setWebglSupport(true);

    renderViewer();

    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(3);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('webgl2');
  });

  it('releases the scratch WebGL probe context immediately', () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({ getExtension })),
    });

    expect(hasWebglSupport(document)).toBe(true);
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('automatically shows the 2D plan and metrics after an unsupported probe', () => {
    setWebglSupport(false);

    renderViewer({ leftovers: [{ ...packedContainer.packed[0], label: 'Kiện dư thật', reason: 'oversize' }] });

    expect(screen.getByRole('status')).toHaveTextContent('Thiết bị này chưa hỗ trợ WebGL');
    expect(screen.getByLabelText('Sơ đồ xếp 2D')).toBeInTheDocument();
    expect(screen.getByText('Thể tích 12.5%')).toBeInTheDocument();
    expect(screen.getByLabelText('Cảnh báo kiện chưa xếp')).toHaveTextContent('Kiện dư thật: Quá kích thước');
    expect(screen.queryByLabelText(/viewport/i)).not.toBeInTheDocument();
  });
});

describe('ViewerViewports', () => {
  it('starts in compact mode on a mobile media query without rendering desktop canvases first', () => {
    mockMobile(true);

    renderViewer();

    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(1);
    expect(canvasSpies.peak).toBe(1);
  });

  it('does not animate or outline a manual step and hides next cargo while paused', () => {
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const manualTransition = { source: 'manual', fromStep: 0, toStep: 1, ownerContainerId: 'container-1', nonce: 1, issuedAt: performance.now() } satisfies PlaybackTransitionDescriptor;

    const { container } = renderViewer({
      step: 1,
      playbackTransition: manualTransition,
      playbackActive: false,
    });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(container.querySelector('[name^="playback-next-"]')).not.toBeInTheDocument();
    const placementGroup = [...container.querySelectorAll('group')].find((element) => element.getAttribute('name') === 'placement-container-1:1-idle');
    expect(placementGroup?.querySelector('i')).toHaveAttribute('data-edge-color', '#164e63');
  });

  it('ignores a non-unit playback descriptor instead of treating a jump as an entry', () => {
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const jumpTransition = { source: 'playback', fromStep: 0, toStep: 2, ownerContainerId: 'container-1', nonce: 1, issuedAt: performance.now() } satisfies PlaybackTransitionDescriptor;

    const { container } = renderViewer({
      step: 2,
      playbackTransition: jumpTransition,
      playbackActive: false,
    });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    const secondPlacement = [...container.querySelectorAll('group')].find((element) => element.getAttribute('name') === 'placement-container-1:2-idle');
    expect(secondPlacement?.querySelector('i')).toHaveAttribute('data-edge-color', '#164e63');
  });

  it('rejects a playback descriptor whose owner does not match its global step', () => {
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const secondContainer: PackedContainer = {
      ...packedContainer,
      container: { ...packedContainer.container, id: 'container-2', name: 'Container 2' },
      packed: [{ ...packedContainer.packed[0], id: 'box-3', order: 1 }],
    };
    const wrongOwnerTransition = { source: 'playback', fromStep: 0, toStep: 1, ownerContainerId: 'container-2', nonce: 1, issuedAt: performance.now() } satisfies PlaybackTransitionDescriptor;

    render(<PackingViewer packedContainers={[packedContainer, secondContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} playbackTransition={wrongOwnerTransition} playbackActive={false} />);

    expect(screen.getByRole('heading', { name: '5T (VN)' })).toBeInTheDocument();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('does not replay a completed timer transition after switching layouts', () => {
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const completedTransition = { source: 'playback', fromStep: 0, toStep: 1, ownerContainerId: 'container-1', nonce: 1, issuedAt: performance.now() - 1_000 } satisfies PlaybackTransitionDescriptor;

    const { container } = renderViewer({
      step: 1,
      playbackTransition: completedTransition,
      playbackActive: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Single View' }));
    fireEvent.click(screen.getByRole('button', { name: 'PIP' }));

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    const placementGroups = [...container.querySelectorAll('group')].filter((element) => element.getAttribute('name') === 'placement-container-1:1-idle');
    expect(placementGroups).toHaveLength(3);
    placementGroups.forEach((group) => expect(group.querySelector('i')).toHaveAttribute('data-edge-color', '#164e63'));
  });

  it('resumes an active timer transition from its issued time after switching layouts', () => {
    vi.useFakeTimers();
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const activeTransition = { source: 'playback', fromStep: 0, toStep: 1, ownerContainerId: 'container-1', nonce: 1, issuedAt: -225 } satisfies PlaybackTransitionDescriptor;
    const target = getPlacementRenderPosition(packedContainer, packedContainer.packed, packedContainer.packed[0], 'solid');
    const halfwayPosition = getPlacementEntryRenderPosition(packedContainer, packedContainer.packed[0], target, .5).join(',');

    const { container } = renderViewer({
      step: 1,
      playbackTransition: activeTransition,
      playbackActive: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Single View' }));
    fireEvent.click(screen.getByRole('button', { name: 'PIP' }));

    expect(requestAnimationFrame).toHaveBeenCalled();
    const placementGroups = [...container.querySelectorAll('group')].filter((element) => element.getAttribute('name') === 'placement-container-1:1-idle');
    expect(placementGroups).toHaveLength(3);
    placementGroups.forEach((group) => expect(group).toHaveAttribute('position', halfwayPosition));
  });

  it('switches at a timer-driven container boundary and preserves the final entry while pausing', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const secondContainer: PackedContainer = {
      ...packedContainer,
      container: { ...packedContainer.container, id: 'container-2', name: 'Container 2' },
      packed: [
        { ...packedContainer.packed[0], id: 'box-3', label: 'Kiện container hai', order: 1 },
        { ...packedContainer.packed[1], id: 'box-4', label: 'Kiện tiếp theo', order: 2 },
      ],
    };
    const firstContainer = { ...packedContainer, packed: [packedContainer.packed[0]] };
    const initialTransition = { source: 'manual', fromStep: 0, toStep: 1, ownerContainerId: 'container-1', nonce: 1, issuedAt: performance.now() } satisfies PlaybackTransitionDescriptor;
    const boundaryTransition = { source: 'playback', fromStep: 1, toStep: 2, ownerContainerId: 'container-2', nonce: 2, issuedAt: performance.now() + 1_000 } satisfies PlaybackTransitionDescriptor;
    const finalTransition = { source: 'playback', fromStep: 2, toStep: 3, ownerContainerId: 'container-2', nonce: 3, issuedAt: performance.now() + 1_000 } satisfies PlaybackTransitionDescriptor;
    const baseProps = { packedContainers: [firstContainer, secondContainer], selectedPlacementId: null, onSelectPlacement: () => {} };
    const { container, rerender } = render(<PackingViewer {...baseProps} step={1} playbackTransition={initialTransition} playbackActive={false} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mặt trước' }));
    callbacks.splice(0);

    rerender(<PackingViewer {...baseProps} step={2} playbackTransition={boundaryTransition} playbackActive />);

    expect(screen.getByRole('heading', { name: 'Container 2' })).toBeInTheDocument();
    const enteringGroups = [...container.querySelectorAll('group')].filter((element) => element.getAttribute('name') === 'placement-container-2:1-idle');
    expect(enteringGroups).toHaveLength(3);
    enteringGroups.forEach((group) => expect(group.querySelector('i')).toHaveAttribute('data-edge-color', '#22d3ee'));
    expect(container.querySelectorAll('[name="playback-next-container-2:2"]')).toHaveLength(3);
    expect(container.querySelector('[name="front-door-right"]')).toHaveAttribute('rotation', '0,0,0');
    act(() => callbacks.splice(0).forEach((callback) => callback(performance.now() + 2_000)));
    expect(container.querySelector('[name="front-door-right"]')).not.toHaveAttribute('rotation', '0,0,0');

    rerender(<PackingViewer {...baseProps} step={3} playbackTransition={finalTransition} playbackActive={false} />);
    const finalEntryGroups = [...container.querySelectorAll('group')].filter((element) => element.getAttribute('name') === 'placement-container-2:2-idle');
    expect(finalEntryGroups).toHaveLength(3);
    finalEntryGroups.forEach((group) => expect(group.querySelector('i')).toHaveAttribute('data-edge-color', '#22d3ee'));
    expect(container.querySelector('[name^="playback-next-"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '5T (VN)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));
    expect(screen.getByRole('heading', { name: '5T (VN)' })).toBeInTheDocument();
  });

  it('defaults desktop to PIP and switches to single or Quad View with only enabled canvases mounted', () => {
    renderViewer();

    expect(screen.getByRole('button', { name: 'PIP' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(3);
    expect(screen.getByLabelText('Mặt trên viewport PIP')).toBeInTheDocument();
    expect(screen.getByLabelText('Mặt trước viewport PIP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Single View' }));
    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(1);
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

  it('exchanges a clicked PIP panel without swallowing cargo selection', () => {
    function SelectionHarness() {
      const [selected, setSelected] = useState<string | null>(null);
      return <PackingViewer packedContainers={[packedContainer]} selectedPlacementId={selected} onSelectPlacement={setSelected} step={2} />;
    }
    const { container } = render(<SelectionHarness />);
    const topPanel = screen.getByLabelText('Mặt trên viewport PIP');

    fireEvent.click(topPanel.querySelector('[data-testid="scene-canvas"]')!);

    expect(screen.getByLabelText('Mặt trên viewport chính')).toBeInTheDocument();
    const isoPanel = screen.getByLabelText('Isometric viewport PIP');
    fireEvent.click(isoPanel.querySelector('group[name="placement-container-1:1-idle"] mesh')!);
    expect(container.querySelectorAll('group[name="placement-container-1:1-selected"]')).toHaveLength(3);
    expect(screen.getByLabelText('Mặt trên viewport chính')).toBeInTheDocument();
  });

  it.each([['Mặt trên', 'Mặt trước'], ['Mặt trước', 'Mặt trên']] as const)('reconciles PIP presets after a %s main viewport remount and still swaps them', (mainLabel, otherLabel) => {
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: mainLabel }));
    fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));
    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    fireEvent.click(screen.getByRole('button', { name: 'PIP' }));

    expect(screen.getByLabelText(`${mainLabel} viewport chính`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`${mainLabel} viewport PIP`)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Isometric viewport PIP')).toBeInTheDocument();
    expect(screen.getByLabelText(`${otherLabel} viewport PIP`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dùng Isometric làm khung chính' }));
    expect(screen.getByLabelText('Isometric viewport chính')).toBeInTheDocument();
    expect(screen.getByLabelText(`${mainLabel} viewport PIP`)).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'PIP' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(1);
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

    fireEvent.click(screen.getByRole('button', { name: 'Solid' }));
    expect(modelSpies.getEmptyRegions).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[name^="empty-region-"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Thể tích chưa sử dụng' })).not.toBeInTheDocument();
  });

  it('shares one Space calculation across four Quad View canvases', () => {
    const { container } = renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));

    fireEvent.click(screen.getByRole('button', { name: 'Khoảng trống' }));

    expect(modelSpies.getEmptyRegions).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('[name="empty-region-empty-0"]')).toHaveLength(4);
  });

  it('does not compute Space geometry while the 2D plan is active', () => {
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Khoảng trống' }));

    expect(modelSpies.getEmptyRegions).not.toHaveBeenCalled();
  });

  it('does not compute Space geometry without WebGL support', () => {
    setWebglSupport(false);
    renderViewer();

    fireEvent.click(screen.getByRole('button', { name: 'Khoảng trống' }));

    expect(modelSpies.getEmptyRegions).not.toHaveBeenCalled();
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
