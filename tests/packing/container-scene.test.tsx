import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContainerScene, getDoorOpenAngle, getManualDraftRenderPosition, getPlacementDraftFromSceneTransform, getPlacementEntryRenderPosition, getPlacementRenderColor, getShellMaterialProps, isFrontDoorVisible, watchWebglContextLoss } from '@/components/packing/container-scene';
import { createPlacementDraft } from '@/lib/packing/manual-layout';
import { PackingViewer } from '@/components/packing/packing-viewer';
import type { PackedContainer } from '@/lib/packing/types';

const dreiSpies = vi.hoisted(() => ({ transformControls: vi.fn(() => null) }));
const threeSpies = vi.hoisted(() => ({ positionSet: vi.fn(), lookAt: vi.fn(), updateProjectionMatrix: vi.fn(), zoomSet: vi.fn() }));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="scene-canvas">{children}</div>,
  useThree: () => ({
    camera: { position: { set: threeSpies.positionSet }, lookAt: threeSpies.lookAt, updateProjectionMatrix: threeSpies.updateProjectionMatrix, get zoom() { return 1; }, set zoom(value: number) { threeSpies.zoomSet(value); } },
    size: { width: 1200, height: 700 },
  }),
}));

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  Edges: ({ color }: { color: string }) => <i data-edge-color={color} />,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OrbitControls: () => null,
  OrthographicCamera: () => null,
  TransformControls: dreiSpies.transformControls,
}));

const packedContainer: PackedContainer = {
  container: { id: 'container-1', name: '5T (VN)', width: 2, height: 2, length: 4, maxWeight: 4800 },
  packed: [{ id: 'box-1', label: 'Kiện mẫu', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 100, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
  unpacked: [],
};

function renderViewer({ packedContainers = [packedContainer], step = 1 }: Partial<React.ComponentProps<typeof PackingViewer>> = {}) {
  return render(<PackingViewer packedContainers={packedContainers} selectedPlacementId={null} onSelectPlacement={() => {}} step={step} />);
}

afterEach(() => {
  cleanup();
  dreiSpies.transformControls.mockClear();
  threeSpies.lookAt.mockClear();
  threeSpies.positionSet.mockClear();
  threeSpies.zoomSet.mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ContainerScene viewer contract', () => {
  it('reports a lost WebGL context once and prevents the browser default', () => {
    const canvas = document.createElement('canvas');
    const onFailure = vi.fn();
    const stopWatching = watchWebglContextLoss(canvas, onFailure);
    const contextLost = new Event('webglcontextlost', { cancelable: true });

    canvas.dispatchEvent(contextLost);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));

    expect(contextLost.defaultPrevented).toBe(true);
    expect(onFailure).toHaveBeenCalledTimes(1);
    stopWatching();
  });

  it('keeps exploded presentation Y out of an X-only manual draft nudge', () => {
    const upperPlacement = { ...packedContainer.packed[0], id: 'box-2', order: 2, y: 1, width: 1, height: 1, length: 2 };
    const stackedContainer = { ...packedContainer, packed: [packedContainer.packed[0], upperPlacement] };
    const draft = createPlacementDraft(upperPlacement);
    const physicalPosition = getManualDraftRenderPosition(stackedContainer, draft);
    const explodedPosition = [-.5, 1.78, -1] as [number, number, number];
    const { container } = render(<ContainerScene
      packedContainer={stackedContainer}
      placements={stackedContainer.packed}
      selectedPlacementId="container-1:2"
      hoveredPlacementId={null}
      preset="iso"
      mode="exploded"
      shell={{ all: true, left: true, right: true, roof: true, front: false }}
      focusToken="fit:0"
      reducedMotion
      manualEditing
      manualDraft={draft}
      onSelectPlacement={() => {}}
      onHoverPlacement={() => {}}
      onRequestFocus={() => {}}
    />);

    expect(physicalPosition[1]).not.toBe(explodedPosition[1]);
    expect(container.querySelector('[name="placement-container-1:2-selected"]')).toHaveAttribute('position', physicalPosition.join(','));
    expect(getPlacementDraftFromSceneTransform(stackedContainer, upperPlacement, [physicalPosition[0] + .05, physicalPosition[1], physicalPosition[2]], draft.rotation, .01)).toMatchObject({ x: .05, y: 1, z: 0 });
  });

  it('keeps entry-animation Z out of an X-only manual draft nudge', () => {
    const entryPlacement = { ...packedContainer.packed[0], length: 2, z: .5 };
    const entryContainer = { ...packedContainer, packed: [entryPlacement] };
    const draft = createPlacementDraft(entryPlacement);
    const physicalPosition = getManualDraftRenderPosition(entryContainer, draft);
    const entryPosition = getPlacementEntryRenderPosition(entryContainer, entryPlacement, physicalPosition, 0);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { container } = render(<ContainerScene
      packedContainer={entryContainer}
      placements={entryContainer.packed}
      selectedPlacementId="container-1:1"
      hoveredPlacementId={null}
      preset="iso"
      mode="solid"
      shell={{ all: true, left: true, right: true, roof: true, front: false }}
      focusToken="fit:0"
      manualEditing
      manualDraft={draft}
      onSelectPlacement={() => {}}
      onHoverPlacement={() => {}}
      onRequestFocus={() => {}}
    />);

    expect(physicalPosition[2]).not.toBe(entryPosition[2]);
    expect(container.querySelector('[name="placement-container-1:1-selected"]')).toHaveAttribute('position', physicalPosition.join(','));
    expect(getPlacementDraftFromSceneTransform(entryContainer, entryPlacement, [physicalPosition[0] + .05, physicalPosition[1], physicalPosition[2]], draft.rotation, .01)).toMatchObject({ x: .05, y: 0, z: .5 });
  });

  it('keeps fit and preset controls available in the WebGL fallback', () => {
    renderViewer({ packedContainers: [packedContainer], step: 1 });

    expect(screen.getByRole('button', { name: 'Vừa khung hình' })).toBeInTheDocument();
    expect(screen.getByText('Isometric')).toBeInTheDocument();
  });

  it('keeps shell layer controls accessible', () => {
    renderViewer({ packedContainers: [packedContainer], step: 1 });

    expect(screen.getByRole('checkbox', { name: 'Thành trái' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Nóc container' })).toBeChecked();
  });

  it('does not mount a manual transform layer while manual editing is absent', () => {
    render(<ContainerScene
      packedContainer={packedContainer}
      placements={packedContainer.packed}
      selectedPlacementId={null}
      hoveredPlacementId={null}
      preset="iso"
      mode="solid"
      shell={{ all: true, left: true, right: true, roof: true, front: false }}
      focusToken="fit:0"
      onSelectPlacement={() => {}}
      onHoverPlacement={() => {}}
      onRequestFocus={() => {}}
    />);

    expect(dreiSpies.transformControls).not.toHaveBeenCalled();
  });

  it('reapplies the camera frame when switching equal-dimension containers', () => {
    const sameSizedContainer: PackedContainer = {
      ...packedContainer,
      container: { ...packedContainer.container, id: 'container-2', name: '5T (VN) 2' },
      packed: [{ ...packedContainer.packed[0], x: 1 }],
    };
    const sceneProps = {
      placements: packedContainer.packed,
      selectedPlacementId: null,
      hoveredPlacementId: null,
      preset: 'iso' as const,
      mode: 'solid' as const,
      shell: { all: true, left: true, right: true, roof: true, front: false },
      focusToken: 'fit:0',
      onSelectPlacement: () => {},
      onHoverPlacement: () => {},
      onRequestFocus: () => {},
    };
    const { rerender } = render(<ContainerScene packedContainer={packedContainer} {...sceneProps} />);

    threeSpies.positionSet.mockClear();
    rerender(<ContainerScene packedContainer={sameSizedContainer} placements={sameSizedContainer.packed} {...sceneProps} />);

    expect(threeSpies.positionSet).toHaveBeenCalled();
  });

  it('does not reapply the camera when playback reveals another placement', () => {
    const secondPlacement = { ...packedContainer.packed[0], id: 'box-2', order: 2, z: 1 };
    const fullContainer = { ...packedContainer, packed: [packedContainer.packed[0], secondPlacement] };
    const sceneProps = {
      selectedPlacementId: null,
      hoveredPlacementId: null,
      preset: 'iso' as const,
      mode: 'solid' as const,
      shell: { all: true, left: true, right: true, roof: true, front: false },
      focusToken: 'fit:0',
      onSelectPlacement: () => {},
      onHoverPlacement: () => {},
      onRequestFocus: () => {},
    };
    const { rerender } = render(<ContainerScene packedContainer={fullContainer} placements={[fullContainer.packed[0]]} {...sceneProps} />);

    threeSpies.positionSet.mockClear();
    threeSpies.lookAt.mockClear();
    threeSpies.zoomSet.mockClear();
    rerender(<ContainerScene packedContainer={fullContainer} placements={fullContainer.packed} {...sceneProps} />);

    expect(threeSpies.positionSet).not.toHaveBeenCalled();
    expect(threeSpies.lookAt).not.toHaveBeenCalled();
    expect(threeSpies.zoomSet).not.toHaveBeenCalled();
  });

  it('reschedules the entry animation after Strict Mode restarts an effect', () => {
    const requestAnimationFrame = vi.fn(() => 1);
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

    render(<StrictMode><ContainerScene
      packedContainer={packedContainer}
      placements={packedContainer.packed}
      playbackState={{
        visibleCount: 1,
        enteringPlacementId: 'container-1:1',
        nextPlacement: null,
        transition: { source: 'playback', fromStep: 0, toStep: 1, ownerContainerId: 'container-1', nonce: 1, issuedAt: performance.now() },
      }}
      selectedPlacementId={null}
      hoveredPlacementId={null}
      preset="iso"
      mode="solid"
      shell={{ all: true, left: true, right: true, roof: true, front: false }}
      focusToken="fit:0"
      onSelectPlacement={() => {}}
      onHoverPlacement={() => {}}
      onRequestFocus={() => {}}
    /></StrictMode>);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('focuses an exploded placement at its displayed Y offset only when focus changes', () => {
    const upperPlacement = { ...packedContainer.packed[0], id: 'box-2', order: 2, y: 1 };
    const stackedContainer = { ...packedContainer, packed: [packedContainer.packed[0], upperPlacement] };
    const sceneProps = {
      placements: stackedContainer.packed,
      selectedPlacementId: null,
      hoveredPlacementId: null,
      preset: 'iso' as const,
      shell: { all: true, left: true, right: true, roof: true, front: false },
      onSelectPlacement: () => {},
      onHoverPlacement: () => {},
      onRequestFocus: () => {},
    };
    const { rerender } = render(<ContainerScene packedContainer={stackedContainer} {...sceneProps} mode="solid" focusToken="fit:0" />);

    threeSpies.lookAt.mockClear();
    rerender(<ContainerScene packedContainer={stackedContainer} {...sceneProps} mode="exploded" focusToken="placement:container-1:2:1" />);

    expect(threeSpies.lookAt).toHaveBeenLastCalledWith(-.5, 1.78, -1.5);

    threeSpies.lookAt.mockClear();
    rerender(<ContainerScene packedContainer={stackedContainer} {...sceneProps} mode="solid" focusToken="placement:container-1:2:1" />);
    expect(threeSpies.lookAt).not.toHaveBeenCalled();
  });

  it('uses transparent non-depth-writing material props for the X-Ray floor', () => {
    expect(getShellMaterialProps('xray', 'floor')).toMatchObject({ transparent: true, opacity: .45, depthWrite: false });
  });

  it('normalizes sub-kilogram weight heat by the actual positive maximum', () => {
    const lightweightPlacements = [
      { ...packedContainer.packed[0], weight: .25 },
      { ...packedContainer.packed[0], id: 'box-2', order: 2, weight: .5 },
    ];

    expect(getPlacementRenderColor(packedContainer, lightweightPlacements, lightweightPlacements[1], 'weight')).toBe('#ef4444');
  });

  it('keeps the landing position and respects front-door visibility', () => {
    const target: [number, number, number] = [-.5, .5, -1.5];

    expect(getPlacementEntryRenderPosition(packedContainer, packedContainer.packed[0], target, 1)).toEqual(target);
    expect(isFrontDoorVisible({ all: true, left: true, right: true, roof: true, front: false })).toBe(false);
    expect(isFrontDoorVisible({ all: true, left: true, right: true, roof: true, front: true })).toBe(true);
    expect(getDoorOpenAngle(0)).toBe(0);
    expect(getDoorOpenAngle(1)).toBeCloseTo(.82);
  });

  it('opens the front doors once at the first visible placement and keeps them open above zero', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const secondPlacement = { ...packedContainer.packed[0], id: 'box-2', order: 2, z: 1 };
    const fullContainer = { ...packedContainer, packed: [packedContainer.packed[0], secondPlacement] };
    const baseProps = {
      packedContainer: fullContainer,
      selectedPlacementId: null,
      hoveredPlacementId: null,
      preset: 'iso' as const,
      mode: 'solid' as const,
      shell: { all: true, left: true, right: true, roof: true, front: true },
      focusToken: 'fit:0',
      onSelectPlacement: () => {},
      onHoverPlacement: () => {},
      onRequestFocus: () => {},
    };
    const { container, rerender } = render(<ContainerScene {...baseProps} placements={[]} playbackState={{ visibleCount: 0, enteringPlacementId: null, nextPlacement: fullContainer.packed[0], transition: null }} />);

    expect(container.querySelector('[name="front-door-right"]')).toHaveAttribute('rotation', '0,0,0');

    rerender(<ContainerScene {...baseProps} placements={[fullContainer.packed[0]]} playbackState={{ visibleCount: 1, enteringPlacementId: 'container-1:1', nextPlacement: secondPlacement, transition: { source: 'playback', fromStep: 0, toStep: 1, ownerContainerId: 'container-1', nonce: 1, issuedAt: performance.now() } }} />);
    const afterAnimation = performance.now() + 1_000;
    act(() => callbacks.splice(0).forEach((callback) => callback(afterAnimation)));
    expect(container.querySelector('[name="front-door-right"]')).toHaveAttribute('rotation', `0,${getDoorOpenAngle(1)},0`);

    rerender(<ContainerScene {...baseProps} placements={fullContainer.packed} playbackState={{ visibleCount: 2, enteringPlacementId: 'container-1:2', nextPlacement: null, transition: { source: 'playback', fromStep: 1, toStep: 2, ownerContainerId: 'container-1', nonce: 2, issuedAt: performance.now() } }} />);
    expect(container.querySelector('[name="front-door-right"]')).toHaveAttribute('rotation', `0,${getDoorOpenAngle(1)},0`);

    rerender(<ContainerScene {...baseProps} placements={[fullContainer.packed[0]]} playbackState={{ visibleCount: 1, enteringPlacementId: null, nextPlacement: secondPlacement, transition: { source: 'manual', fromStep: 2, toStep: 1, ownerContainerId: 'container-1', nonce: 3, issuedAt: performance.now() } }} />);
    expect(container.querySelector('[name="front-door-right"]')).toHaveAttribute('rotation', `0,${getDoorOpenAngle(1)},0`);

    rerender(<ContainerScene {...baseProps} placements={[]} playbackState={{ visibleCount: 0, enteringPlacementId: null, nextPlacement: fullContainer.packed[0], transition: { source: 'manual', fromStep: 1, toStep: 0, ownerContainerId: null, nonce: 4, issuedAt: performance.now() } }} />);
    expect(container.querySelector('[name="front-door-right"]')).toHaveAttribute('rotation', '0,0,0');
  });

  it('renders an explicit cyan next outline distinct from selected, hovered and ordinary edges', () => {
    const selectedPlacement = packedContainer.packed[0];
    const hoveredPlacement = { ...selectedPlacement, id: 'box-2', order: 2, x: 1 };
    const ordinaryPlacement = { ...selectedPlacement, id: 'box-3', order: 3, z: 1 };
    const nextPlacement = { ...selectedPlacement, id: 'box-4', order: 4, x: 1, z: 1 };
    const outlineContainer = { ...packedContainer, packed: [selectedPlacement, hoveredPlacement, ordinaryPlacement, nextPlacement] };
    const { container } = render(<ContainerScene
      packedContainer={outlineContainer}
      placements={[selectedPlacement, hoveredPlacement, ordinaryPlacement]}
      playbackState={{ visibleCount: 3, enteringPlacementId: null, nextPlacement, transition: null }}
      selectedPlacementId="container-1:1"
      hoveredPlacementId="container-1:2"
      preset="iso"
      mode="solid"
      shell={{ all: true, left: true, right: true, roof: true, front: false }}
      focusToken="fit:0"
      reducedMotion
      onSelectPlacement={() => {}}
      onHoverPlacement={() => {}}
      onRequestFocus={() => {}}
    />);

    expect(container.querySelector('[name="placement-container-1:1-selected"] i')).toHaveAttribute('data-edge-color', '#fbbf24');
    expect(container.querySelector('[name="placement-container-1:2-idle"] i')).toHaveAttribute('data-edge-color', '#a5f3fc');
    expect(container.querySelector('[name="placement-container-1:3-idle"] i')).toHaveAttribute('data-edge-color', '#164e63');
    expect(container.querySelector('[name="playback-next-container-1:4"] i')).toHaveAttribute('data-edge-color', '#22d3ee');
  });

  it('removes the cyan entering outline after the landing glow ends', () => {
    vi.useFakeTimers();
    let animationFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      animationFrame = callback;
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const entryKey = 'container-1:1';
    const { container } = render(<ContainerScene
      packedContainer={packedContainer}
      placements={packedContainer.packed}
      playbackState={{ visibleCount: 1, enteringPlacementId: entryKey, nextPlacement: null, transition: { source: 'playback', fromStep: 0, toStep: 1, ownerContainerId: 'container-1', nonce: 1, issuedAt: performance.now() } }}
      selectedPlacementId={null}
      hoveredPlacementId={null}
      preset="iso"
      mode="solid"
      shell={{ all: true, left: true, right: true, roof: true, front: false }}
      focusToken="fit:0"
      onSelectPlacement={() => {}}
      onHoverPlacement={() => {}}
      onRequestFocus={() => {}}
    />);

    expect(container.querySelector('[name="placement-container-1:1-idle"] i')).toHaveAttribute('data-edge-color', '#22d3ee');
    act(() => animationFrame?.(450));
    act(() => vi.advanceTimersByTime(240));
    expect(container.querySelector('[name="placement-container-1:1-idle"] i')).toHaveAttribute('data-edge-color', '#164e63');
  });

  it('skips entry animation frames when reduced motion is enabled', () => {
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { container } = render(<ContainerScene
      packedContainer={packedContainer}
      placements={packedContainer.packed}
      selectedPlacementId={null}
      hoveredPlacementId={null}
      preset="iso"
      mode="solid"
      shell={{ all: true, left: true, right: true, roof: true, front: true }}
      focusToken="fit:0"
      reducedMotion
      onSelectPlacement={() => {}}
      onHoverPlacement={() => {}}
      onRequestFocus={() => {}}
    />);

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(container.querySelector('[name="front-door-right"]')).toHaveAttribute('rotation', `0,${getDoorOpenAngle(1)},0`);
  });
});
