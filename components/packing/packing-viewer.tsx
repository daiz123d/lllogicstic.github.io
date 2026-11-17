'use client';

import { Box, Expand, Map } from 'lucide-react';
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { Leftover, PackedContainer, Placement } from '@/lib/packing/types';
import { createPlacementDraft, toPlacementOverride, validatePlacementDraft } from '@/lib/packing/manual-layout';
import type { ManualAxis, ManualSnap, ManualTransformMode, PlacementDraft } from '@/lib/packing/manual-layout';

import { ViewerControls, ViewerHud } from './viewer-controls';
import { ViewerManualControls } from './viewer-manual-controls';
import { ViewerViewports } from './viewer-viewports';
import type { ViewportLayout } from './viewer-viewports';
import { getEmptyRegions, getViewerMetrics } from './viewer-model';
import type { PlaybackTransitionDescriptor, RenderMode, ShellVisibility, ViewPreset } from './viewer-types';

type ViewerProps = {
  packedContainers: PackedContainer[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
  step: number;
  leftovers?: Leftover[];
  playbackTransition?: PlaybackTransitionDescriptor | null;
  playbackActive?: boolean;
  reducedMotion?: boolean;
  focusToken?: string;
  onRequestFocus?: (key: string) => void;
  onApplyPlacementOverride?: (placementId: string, override: ReturnType<typeof toPlacementOverride>) => void;
};

export class SceneErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function placementKey(containerId: string, placement: Placement) {
  return `${containerId}:${placement.order}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getContainerPlaybackOffset(packedContainers: PackedContainer[], containerId: string) {
  const containerIndex = packedContainers.findIndex((item) => item.container.id === containerId);
  if (containerIndex < 0) return 0;
  return packedContainers.slice(0, containerIndex).reduce((count, item) => count + item.packed.length, 0);
}

export function getVisiblePlacementCount(packedContainers: PackedContainer[], containerId: string, globalStep: number) {
  const container = packedContainers.find((item) => item.container.id === containerId);
  if (!container) return 0;
  return clamp(globalStep - getContainerPlaybackOffset(packedContainers, containerId), 0, container.packed.length);
}

export function getGlobalPlacementStep(packedContainers: PackedContainer[], containerId: string, placementIndex: number) {
  const container = packedContainers.find((item) => item.container.id === containerId);
  if (!container) return 0;
  return getContainerPlaybackOffset(packedContainers, containerId) + clamp(placementIndex, 0, Math.max(0, container.packed.length - 1)) + 1;
}

export function getGlobalPlacementOwner(packedContainers: PackedContainer[], globalStep: number) {
  if (globalStep < 1) return null;
  let remaining = Math.floor(globalStep);
  for (const packedContainer of packedContainers) {
    if (remaining <= packedContainer.packed.length) {
      return { containerId: packedContainer.container.id, placementIndex: remaining - 1 };
    }
    remaining -= packedContainer.packed.length;
  }
  return null;
}

function getPackingInsights(container: PackedContainer) {
  const count = container.packed.length;
  const packedVolume = container.packed.reduce((total, placement) => total + placement.width * placement.height * placement.length, 0);
  const containerVolume = container.container.width * container.container.height * container.container.length;

  return { count, fillPercentage: containerVolume ? Math.min(100, (packedVolume / containerVolume) * 100) : 0, floorOnlyCount: container.packed.filter((placement) => !placement.stackable).length };
}

export function getCargoFocus(container: PackedContainer, placements: Placement[]) {
  const { width, height, length } = container.container;
  if (!placements.length) return { target: [0, height * .35, 0] as [number, number, number], span: Math.max(width, height, length) };

  const bounds = placements.reduce((result, placement) => ({
    minX: Math.min(result.minX, placement.x - width / 2),
    maxX: Math.max(result.maxX, placement.x + placement.width - width / 2),
    minY: Math.min(result.minY, placement.y),
    maxY: Math.max(result.maxY, placement.y + placement.height),
    minZ: Math.min(result.minZ, placement.z - length / 2),
    maxZ: Math.max(result.maxZ, placement.z + placement.length - length / 2),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const target: [number, number, number] = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, (bounds.minZ + bounds.maxZ) / 2];

  return { target, span: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, Math.max(width, height, length) * .45) };
}

export function PlanView({ container, placements, selectedPlacementId, onSelectPlacement }: {
  container: PackedContainer;
  placements: Placement[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
}) {
  const { width, length } = container.container;
  return <div className="plan-view" aria-label="Sơ đồ xếp 2D">
    <div className="plan-grid" style={{ aspectRatio: `${width} / ${length}` }}>
      {placements.map((placement) => {
        const key = placementKey(container.container.id, placement);
        return <button type="button" aria-label={`Kiện ${placement.label}, thứ tự ${placement.order}${!placement.stackable ? ', không chồng — nằm sàn' : ''}`} className={`plan-box${selectedPlacementId === key ? ' selected' : ''}${!placement.stackable ? ' floor-only' : ''}`} key={key} onClick={() => onSelectPlacement(key)} style={{ left: `${(placement.x / width) * 100}%`, top: `${(placement.z / length) * 100}%`, width: `${(placement.width / width) * 100}%`, height: `${(placement.length / length) * 100}%`, background: placement.color || '#22D3EE' }}>{placement.order}</button>;
      })}
    </div>
    <p>Nhấn vào kiện để xem thông tin. Mặt bằng hiển thị theo trục dài × rộng.</p>
  </div>;
}

export function hasWebglSupport(documentObject: Pick<Document, 'createElement'>) {
  try {
    const canvas = documentObject.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!context) return false;
    context.getExtension?.('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function PackingViewer({ packedContainers, selectedPlacementId, onSelectPlacement, step, leftovers = [], playbackTransition = null, playbackActive = false, reducedMotion = false, focusToken = 'fit:0', onRequestFocus = () => {}, onApplyPlacementOverride = () => {} }: ViewerProps) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preset, setPreset] = useState<ViewPreset>('iso');
  const [viewportLayout, setViewportLayout] = useState<ViewportLayout>('pip');
  const [collapsedPip, setCollapsedPip] = useState<ViewPreset[]>([]);
  const [renderMode, setRenderMode] = useState<RenderMode>('solid');
  const [shell, setShell] = useState<ShellVisibility>({ all: true, left: true, right: true, roof: true, front: false });
  const [hoveredPlacementId, setHoveredPlacementId] = useState<string | null>(null);
  const [manualEditing, setManualEditing] = useState(false);
  const [manualMode, setManualMode] = useState<ManualTransformMode>('translate');
  const [manualAxis, setManualAxis] = useState<ManualAxis>('X');
  const [manualSnap, setManualSnap] = useState<ManualSnap>(.01);
  const [manualDraftState, setManualDraftState] = useState<{ key: string; draft: PlacementDraft } | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [webglStatus, setWebglStatus] = useState<'checking' | 'supported' | 'unsupported'>('checking');
  const viewerRef = useRef<HTMLElement>(null);
  const usedContainers = packedContainers.filter((item) => item.packed.length > 0);
  const supportsWebgl = webglStatus === 'supported';
  const handleRenderingFailure = useCallback(() => setWebglStatus('unsupported'), []);
  useEffect(() => {
    setWebglStatus(hasWebglSupport(document) ? 'supported' : 'unsupported');
  }, []);
  useEffect(() => {
    const selectedContainer = usedContainers.find((item) => selectedPlacementId?.startsWith(`${item.container.id}:`));
    if (selectedContainer) setActiveId(selectedContainer.container.id);
  }, [packedContainers, selectedPlacementId]);
  const playbackEntry = playbackTransition?.source === 'playback'
    && playbackTransition.toStep === step
    && playbackTransition.toStep === playbackTransition.fromStep + 1
    ? playbackTransition
    : null;
  const candidatePlaybackEntryOwner = playbackEntry ? getGlobalPlacementOwner(packedContainers, playbackEntry.toStep) : null;
  const playbackEntryOwner = candidatePlaybackEntryOwner?.containerId === playbackEntry?.ownerContainerId ? candidatePlaybackEntryOwner : null;
  const transitionBoundaryOwnerId = useMemo(() => {
    if (!playbackEntry || !playbackEntryOwner) return null;
    const fromOwner = getGlobalPlacementOwner(packedContainers, playbackEntry.fromStep);
    return fromOwner?.containerId === playbackEntryOwner.containerId ? null : playbackEntryOwner.containerId;
  }, [packedContainers, playbackEntry, playbackEntryOwner]);
  useEffect(() => {
    if (transitionBoundaryOwnerId && usedContainers.some((item) => item.container.id === transitionBoundaryOwnerId)) setActiveId(transitionBoundaryOwnerId);
  }, [transitionBoundaryOwnerId]);
  const active = usedContainers.find((item) => item.container.id === activeId) ?? usedContainers[0];
  const visibleCount = active ? getVisiblePlacementCount(packedContainers, active.container.id, step) : 0;
  const visiblePlacements = useMemo(() => active ? active.packed.slice(0, visibleCount) : [], [active, visibleCount]);
  const enteringPlacement = active && playbackEntryOwner?.containerId === active.container.id
    ? active.packed[playbackEntryOwner.placementIndex] ?? null
    : null;
  const nextOwner = playbackActive ? getGlobalPlacementOwner(packedContainers, step + 1) : null;
  const nextPlacement = active && nextOwner?.containerId === active.container.id ? active.packed[nextOwner.placementIndex] ?? null : null;
  const playbackState = active ? {
    visibleCount,
    enteringPlacementId: enteringPlacement ? placementKey(active.container.id, enteringPlacement) : null,
    nextPlacement,
    transition: enteringPlacement ? playbackEntry : null,
  } : undefined;
  const insights = active ? getPackingInsights(active) : null;
  const globalPackedTotal = packedContainers.reduce((total, packedContainer) => total + packedContainer.packed.length, 0);
  const activeMetrics = active ? getViewerMetrics(active, visiblePlacements.length) : null;
  const metrics = activeMetrics ? {
    ...activeMetrics,
    packed: clamp(step, 0, globalPackedTotal),
    total: globalPackedTotal + leftovers.length,
  } : leftovers.length ? {
    usedVolume: 0,
    volumePercent: 0,
    usedWeight: 0,
    maxWeight: 0,
    weightPercent: 0,
    packed: 0,
    total: leftovers.length,
    floorOnly: 0,
  } : null;
  const selected = active ? visiblePlacements.find((placement) => placementKey(active.container.id, placement) === selectedPlacementId) ?? null : null;
  const manualDraft = manualDraftState?.key === selectedPlacementId ? manualDraftState.draft : null;
  const manualValidation = useMemo(() => active && selected && manualDraft
    ? validatePlacementDraft(active.container, active.packed, selected, manualDraft)
    : { valid: true, errors: [] }, [active, selected, manualDraft]);
  const emptyRegions = useMemo(() => {
    if (!active || renderMode !== 'space' || mode !== '3d' || !supportsWebgl) return undefined;
    return getEmptyRegions({ ...active, packed: visiblePlacements }, true);
  }, [active, mode, renderMode, supportsWebgl, visiblePlacements]);

  useEffect(() => {
    setManualDraftState(selected && selectedPlacementId ? { key: selectedPlacementId, draft: createPlacementDraft(selected) } : null);
    setManualOverride(false);
  }, [selectedPlacementId, selected?.x, selected?.y, selected?.z, selected?.width, selected?.height, selected?.length]);

  function enterFullscreen() {
    void viewerRef.current?.requestFullscreen?.();
  }

  function selectLayout(layout: ViewportLayout) {
    setMode('3d');
    setViewportLayout(layout);
  }

  function selectPreset(nextPreset: ViewPreset) {
    setMode('3d');
    setPreset(nextPreset);
  }

  function togglePip(pipPreset: ViewPreset) {
    setCollapsedPip((current) => current.includes(pipPreset) ? current.filter((presetName) => presetName !== pipPreset) : [...current, pipPreset]);
  }

  function applyManualDraft() {
    if (!selectedPlacementId || !manualDraft || (!manualValidation.valid && !manualOverride)) return;
    onApplyPlacementOverride(selectedPlacementId, toPlacementOverride(manualDraft));
    setManualOverride(false);
  }

  function updateManualDraft(draft: PlacementDraft) {
    if (selectedPlacementId) setManualDraftState({ key: selectedPlacementId, draft });
  }

  function cancelManualDraft() {
    setManualDraftState(selected && selectedPlacementId ? { key: selectedPlacementId, draft: createPlacementDraft(selected) } : null);
    setManualOverride(false);
    setManualEditing(false);
  }

  function updateManualEditing(enabled: boolean) {
    if (enabled) setRenderMode('solid');
    setManualEditing(enabled);
  }

  return <section className="viewer-panel" aria-label="Hybrid Isometric Cutaway" ref={viewerRef}>
    <div className="viewer-toolbar"><div><p className="section-kicker">KHÔNG GIAN XẾP</p><h2>{active?.container.name ?? 'Chưa có phương án'}</h2>{insights && <div className="viewer-metrics" aria-label="Chỉ số xếp hàng"><span>{insights.count} kiện</span><span>Lấp đầy {insights.fillPercentage.toFixed(1)}%</span>{insights.floorOnlyCount > 0 && <span className="floor-only-metric">{insights.floorOnlyCount} kiện nằm sàn</span>}</div>}</div><div className="view-toggle" role="group" aria-label="Chế độ xem"><button type="button" aria-pressed={mode === '3d'} className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}><Box size={15} aria-hidden="true" />3D</button><button type="button" aria-pressed={mode === '2d'} className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}><Map size={15} aria-hidden="true" />Mặt bằng</button></div></div>
    {active && metrics && <ViewerControls mode={renderMode} shell={shell} preset={preset} metrics={metrics} selected={selected} leftovers={leftovers} observationDisabled={manualEditing} onModeChange={(nextMode) => { if (!manualEditing) setRenderMode(nextMode); }} onShellChange={setShell} onPresetChange={selectPreset} onFit={() => onRequestFocus('fit')} />}
    {!active && metrics && <ViewerHud metrics={metrics} selected={null} leftovers={leftovers} />}
    {active && <ViewerManualControls enabled={manualEditing} selectedKey={selectedPlacementId} selected={manualDraft} validation={manualValidation} override={manualOverride} mode={manualMode} axis={manualAxis} snap={manualSnap} onEnabledChange={updateManualEditing} onModeChange={setManualMode} onAxisChange={setManualAxis} onSnapChange={setManualSnap} onDraftChange={updateManualDraft} onOverrideChange={setManualOverride} onApply={applyManualDraft} onCancel={cancelManualDraft} />}
    <div className="simulation-toolbar viewport-layout-controls" role="group" aria-label="Bố cục khung nhìn">
      {([['single', 'Single View'], ['pip', 'PIP'], ['quad', 'Quad View']] as const).map(([layout, label]) => <button key={layout} type="button" aria-pressed={viewportLayout === layout} className={viewportLayout === layout ? 'active' : ''} onClick={() => selectLayout(layout)}>{label}</button>)}
      <button type="button" aria-label="Mở toàn màn hình" onClick={enterFullscreen}><Expand size={15} aria-hidden="true" />Toàn màn hình</button>
    </div>
    {usedContainers.length > 1 && <div className="container-tabs">{usedContainers.map((item) => <button className={item.container.id === active?.container.id ? 'active' : ''} type="button" key={item.container.id} onClick={() => setActiveId(item.container.id)}>{item.container.name}</button>)}</div>}
    {!active && mode === '3d' && <div className="viewer-empty">Xếp hàng để mở mô hình container 3D.</div>}
    {!active && mode === '2d' && <div className="plan-view viewer-empty" aria-label="Sơ đồ xếp 2D">Chưa có kiện nào để hiển thị trên mặt bằng.</div>}
    {active && mode === '2d' && <PlanView container={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} onSelectPlacement={onSelectPlacement} />}
    {active && mode === '3d' && renderMode === 'exploded' && <div className="viewer-observation-warning" role="status">Chế độ quan sát – không phải vị trí thực tế</div>}
    {active && mode === '3d' && renderMode === 'space' && <div className="viewer-mode-status" role="status" aria-live="polite" aria-label="Thể tích chưa sử dụng">Khoảng trống · Thể tích chưa sử dụng</div>}
    {active && mode === '3d' && supportsWebgl && <SceneErrorBoundary onError={handleRenderingFailure}><ViewerViewports layout={viewportLayout} mainPreset={preset} collapsedPip={collapsedPip} sceneProps={{ packedContainer: active, placements: visiblePlacements, selectedPlacementId, hoveredPlacementId, mode: renderMode, shell, focusToken, reducedMotion, emptyRegions, playbackState, manualEditing, manualDraft, manualValidation, manualMode, manualAxis, manualSnap, onManualDraftChange: updateManualDraft, onSelectPlacement, onHoverPlacement: setHoveredPlacementId, onRequestFocus, onRenderingFailure: handleRenderingFailure }} onMainPresetChange={selectPreset} onTogglePip={togglePip} /></SceneErrorBoundary>}
    {active && mode === '3d' && webglStatus === 'checking' && <div className="viewer-empty" role="status" aria-live="polite">Đang kiểm tra hỗ trợ WebGL…</div>}
    {active && mode === '3d' && webglStatus === 'unsupported' && <div className="viewer-fallback">
      <div className="viewer-mode-status" role="status" aria-live="polite">Thiết bị này chưa hỗ trợ WebGL. Đang hiển thị mặt bằng 2D.</div>
      <PlanView container={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} onSelectPlacement={onSelectPlacement} />
    </div>}
  </section>;
}
