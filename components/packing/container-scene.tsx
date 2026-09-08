'use client';

import { ContactShadows, Edges, Html, OrbitControls, OrthographicCamera, TransformControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { getAxisAlignedDimensions } from '@/lib/packing/manual-layout';
import type { ManualAxis, ManualSnap, ManualTransformMode, PlacementDraft, PlacementValidation } from '@/lib/packing/manual-layout';
import type { PackedContainer, Placement } from '@/lib/packing/types';

import { getCameraFrame, getEmptyRegions, getHeatColor } from './viewer-model';
import type { EmptyRegion, PlaybackTransitionDescriptor, RenderMode, ShellVisibility, ViewPreset } from './viewer-types';

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
  manualEditing?: boolean;
  manualDraft?: PlacementDraft | null;
  manualValidation?: PlacementValidation;
  manualMode?: ManualTransformMode;
  manualAxis?: ManualAxis;
  manualSnap?: ManualSnap;
  onManualDraftChange?: (draft: PlacementDraft) => void;
  onSelectPlacement: (key: string) => void;
  onHoverPlacement: (key: string | null) => void;
  onRequestFocus: (key: string) => void;
  onBackgroundClick?: () => void;
  onRenderingFailure?: () => void;
  playbackState?: PlaybackVisualState;
};

export type PlaybackVisualState = {
  visibleCount: number;
  enteringPlacementId: string | null;
  nextPlacement: Placement | null;
  transition: PlaybackTransitionDescriptor | null;
};

type CameraControllerProps = Pick<ContainerSceneProps, 'preset' | 'focusToken' | 'packedContainer' | 'mode'> & {
  activeContainerId: string;
  controls: React.RefObject<OrbitControlsImpl | null>;
};

function placementKey(containerId: string, placement: Placement) {
  return `${containerId}:${placement.order}`;
}

function CameraController({ preset, focusToken, packedContainer, mode, activeContainerId, controls }: CameraControllerProps) {
  const { camera, size, invalidate } = useThree();
  const { width, height, length } = packedContainer.container;
  const allPlacements = packedContainer.packed;

  useEffect(() => {
    const frame = getCameraFrame({ width, height, length }, preset, size.width, size.height);
    const focusKey = focusToken.startsWith('placement:') ? focusToken.slice('placement:'.length, focusToken.lastIndexOf(':')) : null;
    const focusedPlacement = focusKey
      ? allPlacements.find((placement) => placementKey(activeContainerId, placement) === focusKey)
      : undefined;
    const target: [number, number, number] = focusedPlacement
      ? getPlacementRenderPosition(packedContainer, allPlacements, focusedPlacement, mode)
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
    invalidate();
  }, [camera, invalidate, preset, focusToken, activeContainerId, width, height, length, allPlacements, size.width, size.height]);

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

const ENTRY_TRAVEL_MS = 450;
const ENTRY_LANDING_MS = 240;
const DOOR_OPEN_MS = 350;

function animationNow() {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

function getEntryAnimation(entryKey: string | undefined, transition: PlaybackTransitionDescriptor | null, reducedMotion: boolean, now: number): EntryAnimation {
  if (!entryKey || transition?.source !== 'playback' || reducedMotion) return { progress: 1, landing: false, active: false };
  const elapsed = Math.max(0, now - transition.issuedAt);
  if (elapsed < ENTRY_TRAVEL_MS) return { progress: elapsed / ENTRY_TRAVEL_MS, landing: false, active: true };
  if (elapsed < ENTRY_TRAVEL_MS + ENTRY_LANDING_MS) return { progress: 1, landing: true, active: true };
  return { progress: 1, landing: false, active: false };
}

function useEntryAnimation(entryKey: string | undefined, transition: PlaybackTransitionDescriptor | null, reducedMotion: boolean): EntryAnimation {
  const transitionKey = entryKey && transition?.source === 'playback' ? `${transition.nonce}:${entryKey}` : undefined;
  const stateKey = `${transitionKey ?? 'idle'}:${reducedMotion ? 'reduced' : 'motion'}`;
  const initialEntry = getEntryAnimation(entryKey, transition, reducedMotion, animationNow());
  const [entryState, setEntryState] = useState(() => ({ key: stateKey, value: initialEntry }));
  const entry = entryState.key === stateKey ? entryState.value : initialEntry;

  useEffect(() => {
    let frame = 0;
    let landingTimer: number | undefined;
    const effectInitialEntry = getEntryAnimation(entryKey, transition, reducedMotion, animationNow());
    const tick = (now: number) => {
      const nextEntry = getEntryAnimation(entryKey, transition, reducedMotion, now);
      setEntryState({ key: stateKey, value: nextEntry });
      const elapsed = transition ? Math.max(0, now - transition.issuedAt) : Infinity;
      if (nextEntry.progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else if (nextEntry.landing) {
        landingTimer = window.setTimeout(() => setEntryState({ key: stateKey, value: { progress: 1, landing: false, active: false } }), Math.max(0, ENTRY_TRAVEL_MS + ENTRY_LANDING_MS - elapsed));
      }
    };
    if (!transitionKey || reducedMotion) {
      setEntryState((current) => current.key === stateKey && current.value.progress === effectInitialEntry.progress && current.value.landing === effectInitialEntry.landing && current.value.active === effectInitialEntry.active ? current : { key: stateKey, value: effectInitialEntry });
    } else {
      setEntryState({ key: stateKey, value: effectInitialEntry });
    }
    if (transitionKey && !reducedMotion && typeof window !== 'undefined' && window.requestAnimationFrame) {
      if (effectInitialEntry.progress < 1) frame = window.requestAnimationFrame(tick);
      else if (effectInitialEntry.landing) landingTimer = window.setTimeout(() => setEntryState({ key: stateKey, value: { progress: 1, landing: false, active: false } }), Math.max(0, ENTRY_TRAVEL_MS + ENTRY_LANDING_MS - (animationNow() - transition!.issuedAt)));
    }

    return () => {
      window.cancelAnimationFrame(frame);
      if (landingTimer !== undefined) window.clearTimeout(landingTimer);
    };
  }, [entryKey, reducedMotion, stateKey, transition?.issuedAt, transitionKey]);

  return entry;
}

export function getDoorOpenAngle(openProgress: number) {
  return easeOutCubic(Math.min(1, Math.max(0, openProgress))) * .82;
}

export function isFrontDoorVisible(shell: ShellVisibility) {
  return shell.all && shell.front;
}

export function watchWebglContextLoss(canvas: HTMLCanvasElement, onFailure: () => void) {
  const handleContextLoss = (event: Event) => {
    event.preventDefault();
    onFailure();
  };
  canvas.addEventListener('webglcontextlost', handleContextLoss, { once: true });
  return () => canvas.removeEventListener('webglcontextlost', handleContextLoss);
}

function useDoorOpenProgress(containerId: string, playbackState: PlaybackVisualState, reducedMotion: boolean, animateDoor: boolean) {
  const { enteringPlacementId, transition, visibleCount } = playbackState;
  const shouldOpen = visibleCount > 0;
  const timerOpensFirstDoor = visibleCount === 1
    && Boolean(enteringPlacementId)
    && transition?.source === 'playback'
    && transition.ownerContainerId === containerId
    && animateDoor;
  const transitionKey = timerOpensFirstDoor ? `${containerId}:${transition!.nonce}` : undefined;
  const getProgress = () => shouldOpen ? timerOpensFirstDoor && !reducedMotion ? Math.min(1, Math.max(0, (animationNow() - transition!.issuedAt) / DOOR_OPEN_MS)) : 1 : 0;
  const stateKey = `${transitionKey ?? `${containerId}:${shouldOpen ? 'open' : 'closed'}`}:${reducedMotion ? 'reduced' : 'motion'}`;
  const initialProgress = getProgress();
  const [progressState, setProgressState] = useState(() => ({ key: stateKey, value: initialProgress }));
  const progress = progressState.key === stateKey ? progressState.value : initialProgress;

  useEffect(() => {
    const effectInitialProgress = getProgress();
    const setProgressForKey = (value: number) => setProgressState((current) => current.key === stateKey && current.value === value ? current : { key: stateKey, value });
    if (!shouldOpen) {
      setProgressForKey(0);
      return;
    }
    if (reducedMotion) {
      setProgressForKey(1);
      return;
    }
    if (!transitionKey) {
      setProgressForKey(1);
      return;
    }

    setProgressForKey(effectInitialProgress);
    let frame = 0;
    const tick = (now: number) => {
      const nextProgress = Math.min(1, Math.max(0, (now - transition!.issuedAt) / DOOR_OPEN_MS));
      setProgressState({ key: stateKey, value: nextProgress });
      if (nextProgress < 1) frame = window.requestAnimationFrame(tick);
    };
    if (effectInitialProgress < 1) frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, shouldOpen, stateKey, transition?.issuedAt, transitionKey]);

  return !shouldOpen ? 0 : reducedMotion ? 1 : progress;
}

function DoorPanels({ width, height, openProgress, mode }: { width: number; height: number; openProgress: number; mode: RenderMode }) {
  const angle = getDoorOpenAngle(openProgress);

  return <group>
    <group name="front-door-left" position={[-width / 2, height / 2, 0]} rotation={[0, -angle, 0]}>
      <mesh position={[width / 4, 0, 0]}><boxGeometry args={[width / 2, height, .05]} /><meshStandardMaterial color="#164764" roughness={.88} {...getShellMaterialProps(mode, 'front')} /></mesh>
    </group>
    <group name="front-door-right" position={[width / 2, height / 2, 0]} rotation={[0, angle, 0]}>
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
    {isFrontDoorVisible(shell) && <group position={[0, 0, length / 2]}><DoorPanels width={width} height={height} mode={mode} openProgress={entryProgress} /></group>}
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

export function getManualDraftRenderPosition(packedContainer: PackedContainer, draft: PlacementDraft): [number, number, number] {
  return [
    draft.x + draft.width / 2 - packedContainer.container.width / 2,
    draft.y + draft.height / 2,
    draft.z + draft.length / 2 - packedContainer.container.length / 2,
  ];
}

export function getPlacementDraftFromSceneTransform(
  packedContainer: PackedContainer,
  placement: Placement,
  position: [number, number, number],
  rotation: [number, number, number],
  snap: ManualSnap,
): PlacementDraft {
  const dimensions = getAxisAlignedDimensions(placement, rotation);
  const round = (value: number) => {
    const rounded = Math.round(value / snap) * snap;
    return Object.is(rounded, -0) ? 0 : rounded;
  };

  return {
    x: round(position[0] + packedContainer.container.width / 2 - dimensions.width / 2),
    y: round(position[1] - dimensions.height / 2),
    z: round(position[2] + packedContainer.container.length / 2 - dimensions.length / 2),
    ...dimensions,
    rotation,
  };
}

function Cargo({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, mode, showLabels, manualEditing = false, manualDraft = null, manualValidation = { valid: true, errors: [] }, manualMode = 'translate', manualAxis = 'X', manualSnap = .01, onManualDraftChange = () => {}, entry, playbackState, onSelectPlacement, onHoverPlacement, onRequestFocus }: Omit<ContainerSceneProps, 'preset' | 'shell' | 'focusToken' | 'reducedMotion'> & { entry: EntryAnimation }) {
  const xray = mode === 'xray';
  const wireframe = mode === 'wireframe';
  const selectedGroup = useRef<Group>(null!);
  const layerLevels = useMemo(() => [...new Set(placements.map((item) => item.y))].sort((a, b) => a - b), [placements]);
  const maximumWeight = useMemo(() => Math.max(Number.EPSILON, ...placements.map((item) => item.weight).filter((weight) => weight > 0)), [placements]);
  const entryPlacement = playbackState?.enteringPlacementId
    ? placements.find((placement) => placementKey(packedContainer.container.id, placement) === playbackState.enteringPlacementId)
    : undefined;
  const editablePlacement = placements.find((placement) => placementKey(packedContainer.container.id, placement) === selectedPlacementId);

  function updateManualDraft() {
    const object = selectedGroup.current;
    if (!object || !editablePlacement || !manualDraft) return;
    const rotation = [object.rotation.x, object.rotation.y, object.rotation.z].map((value) => Math.round(value / (Math.PI / 2)) * Math.PI / 2) as [number, number, number];
    onManualDraftChange(getPlacementDraftFromSceneTransform(packedContainer, editablePlacement, [object.position.x, object.position.y, object.position.z], rotation, manualSnap));
  }

  return <group>
    {placements.map((placement) => {
      const key = placementKey(packedContainer.container.id, placement);
      const selected = selectedPlacementId === key;
      const editing = selected && manualEditing && manualDraft !== null;
      const displayedPlacement = editing ? { ...placement, ...manualDraft } : placement;
      const hovered = hoveredPlacementId === key;
      const faded = selectedPlacementId !== null && !selected;
      const targetPosition = editing ? getManualDraftRenderPosition(packedContainer, manualDraft) : getPlacementRenderPosition(packedContainer, placements, displayedPlacement, mode, layerLevels);
      const entering = !editing && entryPlacement === placement;
      const moving = entering && entry.progress < 1;
      const position = entering ? getPlacementEntryRenderPosition(packedContainer, placement, targetPosition, entry.progress) : targetPosition;
      const color = moving ? '#22d3ee' : getPlacementRenderColor(packedContainer, placements, placement, mode, maximumWeight);

      return <group key={key} ref={editing ? selectedGroup : undefined} name={`placement-${key}-${selected ? 'selected' : 'idle'}`} position={position} rotation={editing ? manualDraft.rotation : undefined}>
        <mesh
          castShadow
          receiveShadow
          onClick={(event) => { event.stopPropagation(); onSelectPlacement(key); }}
          onDoubleClick={(event) => { event.stopPropagation(); onSelectPlacement(key); onRequestFocus(key); }}
          onPointerOver={(event) => { event.stopPropagation(); onHoverPlacement(key); }}
          onPointerOut={() => onHoverPlacement(null)}
        >
          <boxGeometry args={[editing ? placement.width : displayedPlacement.width, editing ? placement.height : displayedPlacement.height, editing ? placement.length : displayedPlacement.length]} />
          <meshStandardMaterial
            color={editing && !manualValidation.valid ? '#fb7185' : color}
            roughness={.52}
            metalness={0}
            transparent={xray || faded}
            opacity={xray ? .34 : faded ? .55 : 1}
            depthWrite={!xray}
            wireframe={wireframe}
            emissive={selected ? '#f59e0b' : moving || (entering && entry.landing) ? '#22d3ee' : hovered ? '#67e8f9' : '#000000'}
            emissiveIntensity={selected ? .35 : moving ? .22 : entering && entry.landing ? .48 : hovered ? .16 : 0}
          />
          <Edges color={selected ? '#fbbf24' : hovered ? '#a5f3fc' : entering && (moving || entry.landing) ? '#22d3ee' : '#164e63'} lineWidth={1} />
        </mesh>
        {showLabels && <Html center><span className={selected ? 'scene-label selected' : 'scene-label'}>{placement.order}</span></Html>}
        {hovered && <Html position={[0, displayedPlacement.height / 2 + .28, 0]} center><span role="tooltip" className="scene-floor-only">{placement.label} · D {displayedPlacement.length.toFixed(2)} × R {displayedPlacement.width.toFixed(2)} × C {displayedPlacement.height.toFixed(2)} · {placement.weight.toFixed(1)} kg</span></Html>}
        {selected && <Html position={[0, displayedPlacement.height / 2 + .54, 0]} center><span className="scene-floor-only" aria-label="Thông tin kiện đã chọn">D {displayedPlacement.length.toFixed(2)} × R {displayedPlacement.width.toFixed(2)} × C {displayedPlacement.height.toFixed(2)} · X {displayedPlacement.x.toFixed(2)} · Y {displayedPlacement.y.toFixed(2)} · Z {displayedPlacement.z.toFixed(2)} · ↻ {editing ? manualDraft.rotation.map((value) => `${Math.round(value * 180 / Math.PI)}°`).join('/') : 'Trục D–R–C'}</span></Html>}
        {!placement.stackable && <Html position={[0, placement.height / 2 + .22, 0]} center><span className="scene-floor-only">SÀN</span></Html>}
      </group>;
    })}
    {playbackState?.nextPlacement && (() => {
      const nextPlacement = playbackState.nextPlacement;
      const key = placementKey(packedContainer.container.id, nextPlacement);
      const target = getPlacementRenderPosition(packedContainer, [...placements, nextPlacement], nextPlacement, mode);
      return <group name={`playback-next-${key}`} position={getPlacementEntryRenderPosition(packedContainer, nextPlacement, target, 0)}>
        <mesh>
          <boxGeometry args={[nextPlacement.width, nextPlacement.height, nextPlacement.length]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0} depthWrite={false} />
          <Edges color="#22d3ee" lineWidth={2} />
        </mesh>
      </group>;
    })()}
    {manualEditing && editablePlacement && manualDraft && <TransformControls
      object={selectedGroup}
      mode={manualMode}
      translationSnap={manualSnap}
      rotationSnap={Math.PI / 2}
      showX={manualAxis === 'X'}
      showY={manualAxis === 'Y'}
      showZ={manualAxis === 'Z'}
      onObjectChange={updateManualDraft}
    />}
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

export function ContainerScene({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, preset, mode, shell, focusToken, reducedMotion = false, emptyRegions: sharedEmptyRegions, showLabels = true, playbackState: playbackVisualState, manualEditing = false, manualDraft = null, manualValidation, manualMode, manualAxis, manualSnap, onManualDraftChange, onSelectPlacement, onHoverPlacement, onRequestFocus, onBackgroundClick, onRenderingFailure }: ContainerSceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const contextLossCleanup = useRef<(() => void) | null>(null);
  const { width, height, length } = packedContainer.container;
  const emptyRegions = useMemo(() => {
    if (mode !== 'space') return [];
    return sharedEmptyRegions ?? getEmptyRegions({ ...packedContainer, packed: placements }, true);
  }, [mode, packedContainer, placements, sharedEmptyRegions]);
  const playbackState: PlaybackVisualState = playbackVisualState ?? {
    visibleCount: placements.length,
    enteringPlacementId: null,
    nextPlacement: null,
    transition: null,
  };
  const entry = useEntryAnimation(playbackState.enteringPlacementId ?? undefined, playbackState.transition, reducedMotion);
  const doorOpenProgress = useDoorOpenProgress(packedContainer.container.id, playbackState, reducedMotion, isFrontDoorVisible(shell));

  useEffect(() => () => contextLossCleanup.current?.(), []);

  return <div className="scene-canvas" data-empty-region-count={mode === 'space' ? emptyRegions.length : 0} onContextMenu={(event) => event.preventDefault()}>
    <Canvas frameloop="demand" shadows dpr={[1, 2]} onPointerMissed={onBackgroundClick} onCreated={({ gl }) => {
      contextLossCleanup.current?.();
      contextLossCleanup.current = onRenderingFailure ? watchWebglContextLoss(gl.domElement, onRenderingFailure) : null;
    }}>
      <color attach="background" args={['#07131f']} />
      <OrthographicCamera makeDefault />
      <CameraController preset={preset} focusToken={focusToken} packedContainer={packedContainer} mode={mode} activeContainerId={packedContainer.container.id} controls={controls} />
      <hemisphereLight intensity={1.1} color="#d9f7ff" groundColor="#10283d" />
      <directionalLight castShadow intensity={1.8} position={[width, height * 2 + 3, length]} />
      <Shell packedContainer={packedContainer} shell={shell} mode={mode} entryProgress={doorOpenProgress} />
      <Cargo
        packedContainer={packedContainer}
        placements={placements}
        selectedPlacementId={selectedPlacementId}
        hoveredPlacementId={hoveredPlacementId}
        mode={mode}
        entry={entry}
        playbackState={playbackState}
        showLabels={showLabels}
        manualEditing={manualEditing}
        manualDraft={manualDraft}
        manualValidation={manualValidation}
        manualMode={manualMode}
        manualAxis={manualAxis}
        manualSnap={manualSnap}
        onManualDraftChange={onManualDraftChange}
        onSelectPlacement={onSelectPlacement}
        onHoverPlacement={onHoverPlacement}
        onRequestFocus={onRequestFocus}
      />
      {mode === 'space' && <EmptyRegions packedContainer={packedContainer} regions={emptyRegions} />}
      <ContactShadows position={[0, .01, 0]} opacity={.3} scale={[width * 1.08, length * 1.08]} blur={2.4} far={height + 6} />
      <OrbitControls ref={controls} makeDefault enablePan />
    </Canvas>
  </div>;
}
