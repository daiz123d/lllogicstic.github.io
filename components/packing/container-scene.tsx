'use client';

import { ContactShadows, Edges, Html, OrbitControls, OrthographicCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import type { PackedContainer, Placement } from '@/lib/packing/types';

import { getCameraFrame, getEmptyRegions, getHeatColor } from './viewer-model';
import type { EmptyRegion, RenderMode, ShellVisibility, ViewPreset } from './viewer-types';

export type ContainerSceneProps = {
  packedContainer: PackedContainer;
  placements: Placement[];
  selectedPlacementId: string | null;
  hoveredPlacementId: string | null;
  preset: ViewPreset;
  mode: RenderMode;
  shell: ShellVisibility;
  focusToken: string;
  emptyRegions?: EmptyRegion[];
  showLabels?: boolean;
  onSelectPlacement: (key: string) => void;
  onHoverPlacement: (key: string | null) => void;
  onRequestFocus: (key: string) => void;
};

type CameraControllerProps = Pick<ContainerSceneProps, 'preset' | 'focusToken' | 'placements' | 'packedContainer' | 'mode'> & {
  activeContainerId: string;
  controls: React.RefObject<OrbitControlsImpl | null>;
};

function placementKey(containerId: string, placement: Placement) {
  return `${containerId}:${placement.order}`;
}

function CameraController({ preset, focusToken, packedContainer, placements, mode, activeContainerId, controls }: CameraControllerProps) {
  const { camera, size } = useThree();
  const { width, height, length } = packedContainer.container;

  useEffect(() => {
    const frame = getCameraFrame({ width, height, length }, preset, size.width, size.height);
    const focusKey = focusToken.startsWith('placement:') ? focusToken.slice('placement:'.length, focusToken.lastIndexOf(':')) : null;
    const focusedPlacement = focusKey
      ? placements.find((placement) => placementKey(activeContainerId, placement) === focusKey)
      : undefined;
    const target: [number, number, number] = focusedPlacement
      ? getPlacementRenderPosition(packedContainer, placements, focusedPlacement, mode)
      : [frame.target[0] - width / 2, frame.target[1], frame.target[2] - length / 2];
    const containerTarget: [number, number, number] = [frame.target[0] - width / 2, frame.target[1], frame.target[2] - length / 2];
    const position: [number, number, number] = [
      target[0] + frame.position[0] - width / 2 - containerTarget[0],
      target[1] + frame.position[1] - containerTarget[1],
      target[2] + frame.position[2] - length / 2 - containerTarget[2],
    ];

    camera.position.set(...position);
    camera.zoom = focusedPlacement ? frame.zoom * 1.12 : frame.zoom;
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
    controls.current?.target.set(...target);
    controls.current?.update();
  }, [preset, focusToken, activeContainerId, width, height, length, placements.length, size.width, size.height]);

  return null;
}

type ShellLayer = 'floor' | 'rear' | 'left' | 'right' | 'roof' | 'front';

export function getShellMaterialProps(mode: RenderMode, layer: ShellLayer) {
  const baseOpacity: Record<ShellLayer, number> = { floor: 1, rear: .42, left: .15, right: .15, roof: .10, front: .15 };
  const xray = mode === 'xray';
  return {
    transparent: layer !== 'floor' || xray,
    opacity: baseOpacity[layer] * (xray ? .45 : 1),
    depthWrite: !xray,
  };
}

function Shell({ packedContainer, shell, mode }: Pick<ContainerSceneProps, 'packedContainer' | 'shell' | 'mode'>) {
  const { width, height, length } = packedContainer.container;
  const visible = (layer: keyof ShellVisibility) => shell.all && shell[layer];

  return <group>
    {shell.all && <mesh position={[0, -.04, 0]} receiveShadow>
      <boxGeometry args={[width, .08, length]} />
      <meshStandardMaterial color="#123b55" roughness={.9} {...getShellMaterialProps(mode, 'floor')} />
    </mesh>}
    {shell.all && <mesh position={[0, height / 2, -length / 2]}>
      <boxGeometry args={[width, height, .05]} />
      <meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'rear')} />
    </mesh>}
    {visible('left') && <mesh position={[-width / 2, height / 2, 0]}>
      <boxGeometry args={[.05, height, length]} />
      <meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'left')} />
    </mesh>}
    {visible('right') && <mesh position={[width / 2, height / 2, 0]}>
      <boxGeometry args={[.05, height, length]} />
      <meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'right')} />
    </mesh>}
    {visible('roof') && <mesh position={[0, height, 0]}>
      <boxGeometry args={[width, .05, length]} />
      <meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'roof')} />
    </mesh>}
    {visible('front') && <mesh position={[0, height / 2, length / 2]}>
      <boxGeometry args={[width, height, .05]} />
      <meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'front')} />
    </mesh>}
    {shell.all && <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, length]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#67e8f9" transparent opacity={.38} />
    </mesh>}
  </group>;
}

export function getPlacementRenderPosition(packedContainer: PackedContainer, placements: Placement[], placement: Placement, mode: RenderMode, layerLevels?: number[]): [number, number, number] {
  const { width, length } = packedContainer.container;
  const levels = layerLevels ?? [...new Set(placements.map((item) => item.y))].sort((a, b) => a - b);
  const layerIndex = Math.max(0, levels.indexOf(placement.y));
  const explodedOffset = mode === 'exploded' ? layerIndex * .28 : 0;

  return [
    placement.x + placement.width / 2 - width / 2,
    placement.y + placement.height / 2 + explodedOffset,
    placement.z + placement.length / 2 - length / 2,
  ];
}

export function getPlacementRenderColor(packedContainer: PackedContainer, placements: Placement[], placement: Placement, mode: RenderMode, maximumWeight?: number) {
  if (mode === 'weight') {
    const maxWeight = maximumWeight && maximumWeight > 0 ? maximumWeight : Math.max(Number.EPSILON, ...placements.map((item) => item.weight).filter((weight) => weight > 0));
    return getHeatColor('weight', placement.weight / maxWeight);
  }
  if (mode === 'height') {
    const top = placement.y + placement.height;
    return getHeatColor('height', packedContainer.container.height ? top / packedContainer.container.height : 0);
  }
  return placement.color || '#22d3ee';
}

function Cargo({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, mode, showLabels, onSelectPlacement, onHoverPlacement, onRequestFocus }: Omit<ContainerSceneProps, 'preset' | 'shell' | 'focusToken'>) {
  const xray = mode === 'xray';
  const wireframe = mode === 'wireframe';
  const layerLevels = useMemo(() => [...new Set(placements.map((item) => item.y))].sort((a, b) => a - b), [placements]);
  const maximumWeight = useMemo(() => Math.max(Number.EPSILON, ...placements.map((item) => item.weight).filter((weight) => weight > 0)), [placements]);

  return <group>
    {placements.map((placement) => {
      const key = placementKey(packedContainer.container.id, placement);
      const selected = selectedPlacementId === key;
      const hovered = hoveredPlacementId === key;
      const faded = selectedPlacementId !== null && !selected;
      const position = getPlacementRenderPosition(packedContainer, placements, placement, mode, layerLevels);
      const color = getPlacementRenderColor(packedContainer, placements, placement, mode, maximumWeight);

      return <group key={key} name={`placement-${key}-${selected ? 'selected' : 'idle'}`} position={position}>
        <mesh
          castShadow
          receiveShadow
          onClick={(event) => { event.stopPropagation(); onSelectPlacement(key); }}
          onDoubleClick={(event) => { event.stopPropagation(); onSelectPlacement(key); onRequestFocus(key); }}
          onPointerOver={(event) => { event.stopPropagation(); onHoverPlacement(key); }}
          onPointerOut={() => onHoverPlacement(null)}
        >
          <boxGeometry args={[placement.width, placement.height, placement.length]} />
          <meshStandardMaterial
            color={color}
            roughness={.52}
            metalness={0}
            transparent={xray || faded}
            opacity={xray ? .34 : faded ? .55 : 1}
            depthWrite={!xray}
            wireframe={wireframe}
            emissive={selected ? '#f59e0b' : hovered ? '#67e8f9' : '#000000'}
            emissiveIntensity={selected ? .35 : hovered ? .16 : 0}
          />
          <Edges color={selected ? '#fbbf24' : hovered ? '#a5f3fc' : '#164e63'} lineWidth={1} />
        </mesh>
        {showLabels && <Html center distanceFactor={8}><span className={selected ? 'scene-label selected' : 'scene-label'}>{placement.order}</span></Html>}
        {hovered && <Html position={[0, placement.height / 2 + .28, 0]} center distanceFactor={8}><span role="tooltip" className="scene-floor-only">{placement.label} · D {placement.length.toFixed(2)} × R {placement.width.toFixed(2)} × C {placement.height.toFixed(2)} · {placement.weight.toFixed(1)} kg</span></Html>}
        {selected && <Html position={[0, placement.height / 2 + .54, 0]} center distanceFactor={8}><span className="scene-floor-only" aria-label="Thông tin kiện đã chọn">D {placement.length.toFixed(2)} × R {placement.width.toFixed(2)} × C {placement.height.toFixed(2)} · X {placement.x.toFixed(2)} · Y {placement.y.toFixed(2)} · Z {placement.z.toFixed(2)} · ↻ Trục D–R–C</span></Html>}
        {!placement.stackable && <Html position={[0, placement.height / 2 + .22, 0]} center distanceFactor={8}><span className="scene-floor-only">SÀN</span></Html>}
      </group>;
    })}
  </group>;
}

function EmptyRegions({ packedContainer, regions }: { packedContainer: PackedContainer; regions: EmptyRegion[] }) {
  const { width, length } = packedContainer.container;

  return <group>
    {regions.map((region) => <mesh key={region.id} name={`empty-region-${region.id}`} position={[
      region.x + region.width / 2 - width / 2,
      region.y + region.height / 2,
      region.z + region.length / 2 - length / 2,
    ]}>
      <boxGeometry args={[region.width, region.height, region.length]} />
      <meshStandardMaterial color="#67e8f9" transparent opacity={.18} depthWrite={false} roughness={.7} />
      <Edges color="#a5f3fc" transparent opacity={.5} />
    </mesh>)}
  </group>;
}

export function ContainerScene({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, preset, mode, shell, focusToken, emptyRegions: sharedEmptyRegions, showLabels = true, onSelectPlacement, onHoverPlacement, onRequestFocus }: ContainerSceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { width, height, length } = packedContainer.container;
  const emptyRegions = useMemo(() => {
    if (mode !== 'space') return [];
    return sharedEmptyRegions ?? getEmptyRegions({ ...packedContainer, packed: placements }, true);
  }, [mode, packedContainer, placements, sharedEmptyRegions]);

  return <div className="scene-canvas" onContextMenu={(event) => event.preventDefault()}>
    <Canvas shadows dpr={[1, 2]}>
      <color attach="background" args={['#07131f']} />
      <OrthographicCamera makeDefault />
      <CameraController preset={preset} focusToken={focusToken} packedContainer={packedContainer} placements={placements} mode={mode} activeContainerId={packedContainer.container.id} controls={controls} />
      <hemisphereLight intensity={1.1} color="#d9f7ff" groundColor="#10283d" />
      <directionalLight castShadow intensity={1.8} position={[width, height * 2 + 3, length]} />
      <Shell packedContainer={packedContainer} shell={shell} mode={mode} />
      <Cargo
        packedContainer={packedContainer}
        placements={placements}
        selectedPlacementId={selectedPlacementId}
        hoveredPlacementId={hoveredPlacementId}
        mode={mode}
        showLabels={showLabels}
        onSelectPlacement={onSelectPlacement}
        onHoverPlacement={onHoverPlacement}
        onRequestFocus={onRequestFocus}
      />
      {mode === 'space' && <EmptyRegions packedContainer={packedContainer} regions={emptyRegions} />}
      <ContactShadows position={[0, 0, 0]} opacity={.38} scale={Math.max(width, length) * 2.5} blur={2.4} far={height + 6} />
      <OrbitControls ref={controls} makeDefault enablePan />
    </Canvas>
  </div>;
}
