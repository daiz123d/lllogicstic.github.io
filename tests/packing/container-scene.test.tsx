import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContainerScene } from '@/components/packing/container-scene';
import { PackingViewer } from '@/components/packing/packing-viewer';
import type { PackedContainer } from '@/lib/packing/types';

const dreiSpies = vi.hoisted(() => ({ transformControls: vi.fn(() => null) }));
const threeSpies = vi.hoisted(() => ({ positionSet: vi.fn(), lookAt: vi.fn(), updateProjectionMatrix: vi.fn() }));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="scene-canvas">{children}</div>,
  useThree: () => ({
    camera: { position: { set: threeSpies.positionSet }, lookAt: threeSpies.lookAt, updateProjectionMatrix: threeSpies.updateProjectionMatrix, zoom: 1 },
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
  container: { id: 'container-1', name: '5T (VN)', width: 2, height: 2, length: 4, maxWeight: 4800 },
  packed: [{ id: 'box-1', label: 'Kiện mẫu', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 100, stackable: true, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
  unpacked: [],
};

function renderViewer({ packedContainers = [packedContainer], step = 1 }: Partial<React.ComponentProps<typeof PackingViewer>> = {}) {
  return render(<PackingViewer packedContainers={packedContainers} selectedPlacementId={null} onSelectPlacement={() => {}} step={step} />);
}

afterEach(cleanup);

describe('ContainerScene viewer contract', () => {
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
});
