'use client';

import { ContactShadows, Edges, Html, OrbitControls, OrthographicCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  reducedMotion?: boolean;
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

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

type EntryAnimation = { progress: number; landing: boolean; active: boolean };

function useEntryAnimation(entryKey: string | undefined, reducedMotion: boolean): EntryAnimation {
  const [progress, setProgress] = useState(() => entryKey && !reducedMotion ? 0 : 1);
  const [landing, setLanding] = useState(false);
  const previousEntryKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousEntryKey.current === entryKey) return;
    previousEntryKey.current = entryKey;
    setLanding(false);
    if (!entryKey || reducedMotion || typeof window === 'undefined' || !window.requestAnimationFrame) {
      setProgress(1);
      return;
    }

    setProgress(0);
    const startedAt = performance.now();
    let frame = 0;
    let landingTimer: number | undefined;
    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - startedAt) / 450);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      setLanding(true);
      landingTimer = window.setTimeout(() => setLanding(false), 240);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      if (landingTimer !== undefined) window.clearTimeout(landingTimer);
    };
  }, [entryKey, reducedMotion]);

  return { progress: reducedMotion ? 1 : progress, landing: reducedMotion ? false : landing, active: Boolean(entryKey) };
}

function DoorPanels({ width, height, openProgress, mode }: { width: number; height: number; openProgress: number; mode: RenderMode }) {
  const angle = easeOutCubic(Math.min(1, openProgress * 450 / 350)) * .82;

  return <group>
    <group position={[-width / 2, height / 2, 0]} rotation={[0, -angle, 0]}>
      <mesh position={[width / 4, 0, 0]}><boxGeometry args={[width / 2, height, .05]} /><meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'front')} /></mesh>
    </group>
    <group position={[width / 2, height / 2, 0]} rotation={[0, angle, 0]}>
      <mesh position={[-width / 4, 0, 0]}><boxGeometry args={[width / 2, height, .05]} /><meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'front')} /></mesh>
    </group>
  </group>;
}

function Shell({ packedContainer, shell, mode, entryProgress }: Pick<ContainerSceneProps, 'packedContainer' | 'shell' | 'mode'> & { entryProgress: number }) {
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
    {visible('front') && <group position={[0, 0, length / 2]}><DoorPanels width={width} height={height} mode={mode} openProgress={entryProgress} /></group>}
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

export function getPlacementEntryRenderPosition(packedContainer: PackedContainer, placement: Placement, target: [number, number, number], progress: number): [number, number, number] {
  const loadingStartZ = packedContainer.container.length / 2 + placement.length / 2;
  const easedProgress = easeOutCubic(Math.min(1, Math.max(0, progress)));
  return [target[0], target[1], loadingStartZ + (target[2] - loadingStartZ) * easedProgress];
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

function Cargo({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, mode, showLabels, entry, onSelectPlacement, onHoverPlacement, onRequestFocus }: Omit<ContainerSceneProps, 'preset' | 'shell' | 'focusToken' | 'reducedMotion'> & { entry: EntryAnimation }) {
  const xray = mode === 'xray';
  const wireframe = mode === 'wireframe';
  const layerLevels = useMemo(() => [...new Set(placements.map((item) => item.y))].sort((a, b) => a - b), [placements]);
  const maximumWeight = useMemo(() => Math.max(Number.EPSILON, ...placements.map((item) => item.weight).filter((weight) => weight > 0)), [placements]);
  const entryPlacement = placements.at(-1);

  return <group>
    {placements.map((placement) => {
      const key = placementKey(packedContainer.container.id, placement);
      const selected = selectedPlacementId === key;
      const hovered = hoveredPlacementId === key;
      const faded = selectedPlacementId !== null && !selected;
      const targetPosition = getPlacementRenderPosition(packedContainer, placements, placement, mode, layerLevels);
      const entering = entryPlacement === placement;
      const moving = entering && entry.progress < 1;
      const position = entering ? getPlacementEntryRenderPosition(packedContainer, placement, targetPosition, entry.progress) : targetPosition;
      const color = moving ? '#22d3ee' : getPlacementRenderColor(packedContainer, placements, placement, mode, maximumWeight);

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
            emissive={selected ? '#f59e0b' : moving || (entering && entry.landing) ? '#22d3ee' : hovered ? '#67e8f9' : '#000000'}
            emissiveIntensity={selected ? .35 : moving ? .22 : entering && entry.landing ? .48 : hovered ? .16 : 0}
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

export function ContainerScene({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, preset, mode, shell, focusToken, reducedMotion = false, emptyRegions: sharedEmptyRegions, showLabels = true, onSelectPlacement, onHoverPlacement, onRequestFocus }: ContainerSceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { width, height, length } = packedContainer.container;
  const emptyRegions = useMemo(() => {
    if (mode !== 'space') return [];
    return sharedEmptyRegions ?? getEmptyRegions({ ...packedContainer, packed: placements }, true);
  }, [mode, packedContainer, placements, sharedEmptyRegions]);
  const entryPlacement = placements.at(-1);
  const entry = useEntryAnimation(entryPlacement ? placementKey(packedContainer.container.id, entryPlacement) : undefined, reducedMotion);

  return <div className="scene-canvas" onContextMenu={(event) => event.preventDefault()}>
    <Canvas shadows dpr={[1, 2]}>
      <color attach="background" args={['#07131f']} />
      <OrthographicCamera makeDefault />
      <CameraController preset={preset} focusToken={focusToken} packedContainer={packedContainer} placements={placements} mode={mode} activeContainerId={packedContainer.container.id} controls={controls} />
      <hemisphereLight intensity={1.1} color="#d9f7ff" groundColor="#10283d" />
      <directionalLight castShadow intensity={1.8} position={[width, height * 2 + 3, length]} />
      <Shell packedContainer={packedContainer} shell={shell} mode={mode} entryProgress={entry.active ? entry.progress : 0} />
      <Cargo
        packedContainer={packedContainer}
        placements={placements}
        selectedPlacementId={selectedPlacementId}
        hoveredPlacementId={hoveredPlacementId}
        mode={mode}
        entry={entry}
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
