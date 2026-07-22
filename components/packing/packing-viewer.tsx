'use client';

import { Box, Expand, Map, Tags } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { ContainerScene } from '@/components/packing/container-scene';
import type { PackedContainer, Placement } from '@/lib/packing/types';

import type { RenderMode, ShellVisibility, ViewPreset } from './viewer-types';

type ViewerProps = {
  packedContainers: PackedContainer[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
  step: number;
};

export function placementKey(containerId: string, placement: Placement) {
  return `${containerId}:${placement.order}`;
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

function PlanView({ container, placements, selectedPlacementId, onSelectPlacement }: {
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

export function PackingViewer({ packedContainers, selectedPlacementId, onSelectPlacement, step }: ViewerProps) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preset, setPreset] = useState<ViewPreset>('iso');
  const [renderMode, setRenderMode] = useState<RenderMode>('solid');
  const [shell, setShell] = useState<ShellVisibility>({ all: true, left: true, right: true, roof: true, front: false });
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredPlacementId, setHoveredPlacementId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState('fit:0');
  const viewerRef = useRef<HTMLElement>(null);
  const supportsWebgl = useMemo(() => typeof window !== 'undefined' && 'WebGLRenderingContext' in window, []);
  const usedContainers = packedContainers.filter((item) => item.packed.length > 0);
  const active = usedContainers.find((item) => item.container.id === activeId) ?? usedContainers[0];
  const visiblePlacements = useMemo(() => active ? active.packed.slice(0, Math.max(0, step)) : [], [active, step]);
  const insights = active ? getPackingInsights(active) : null;

  function enterFullscreen() {
    void viewerRef.current?.requestFullscreen?.();
  }

  function updateShell(layer: keyof ShellVisibility, checked: boolean) {
    setShell((current) => ({ ...current, [layer]: checked }));
  }

  function fitContainer() {
    setFocusToken((current) => `fit:${Number(current.split(':')[1] ?? 0) + 1}`);
  }

  return <section className="viewer-panel" aria-label="Trình xem xếp thùng" ref={viewerRef}>
    <div className="viewer-toolbar"><div><p className="section-kicker">KHÔNG GIAN XẾP</p><h2>{active?.container.name ?? 'Chưa có phương án'}</h2>{insights && <div className="viewer-metrics" aria-label="Chỉ số xếp hàng"><span>{insights.count} kiện</span><span>Lấp đầy {insights.fillPercentage.toFixed(1)}%</span>{insights.floorOnlyCount > 0 && <span className="floor-only-metric">{insights.floorOnlyCount} kiện nằm sàn</span>}</div>}</div><div className="view-toggle" role="group" aria-label="Chế độ xem"><button type="button" className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}><Box size={15} aria-hidden="true" />3D</button><button type="button" className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}><Map size={15} aria-hidden="true" />Mặt bằng</button></div></div>
    <div className="simulation-toolbar" role="toolbar" aria-label="Điều khiển mô phỏng">
      {([['iso', 'Isometric'], ['top', 'Mặt trên'], ['front', 'Mặt trước'], ['side', 'Mặt bên']] as const).map(([value, label]) => <button type="button" aria-pressed={preset === value} className={preset === value ? 'active' : ''} key={value} onClick={() => { setMode('3d'); setPreset(value); }}>{label}</button>)}
      <button type="button" onClick={fitContainer}>Vừa khung hình</button>
      <button type="button" aria-pressed={showLabels} className={showLabels ? 'active' : ''} onClick={() => setShowLabels((value) => !value)}><Tags size={15} />Nhãn</button>
      <button type="button" aria-pressed={renderMode === 'wireframe'} className={renderMode === 'wireframe' ? 'active' : ''} onClick={() => setRenderMode((value) => value === 'wireframe' ? 'solid' : 'wireframe')}><Box size={15} />Wireframe</button>
      <button type="button" aria-label="Mở toàn màn hình" onClick={enterFullscreen}><Expand size={15} />Toàn màn hình</button>
    </div>
    <fieldset className="simulation-toolbar" aria-label="Lớp vỏ container">
      <label><input type="checkbox" checked={shell.all} onChange={(event) => updateShell('all', event.target.checked)} />Tất cả vỏ</label>
      <label><input type="checkbox" checked={shell.left} onChange={(event) => updateShell('left', event.target.checked)} />Thành trái</label>
      <label><input type="checkbox" checked={shell.right} onChange={(event) => updateShell('right', event.target.checked)} />Thành phải</label>
      <label><input type="checkbox" checked={shell.roof} onChange={(event) => updateShell('roof', event.target.checked)} />Nóc container</label>
      <label><input type="checkbox" checked={shell.front} onChange={(event) => updateShell('front', event.target.checked)} />Mặt trước</label>
    </fieldset>
    {usedContainers.length > 1 && <div className="container-tabs">{usedContainers.map((item) => <button className={item.container.id === active?.container.id ? 'active' : ''} type="button" key={item.container.id} onClick={() => setActiveId(item.container.id)}>{item.container.name}</button>)}</div>}
    {!active && mode === '3d' && <div className="viewer-empty">Xếp hàng để mở mô hình container 3D.</div>}
    {!active && mode === '2d' && <div className="plan-view viewer-empty" aria-label="Sơ đồ xếp 2D">Chưa có kiện nào để hiển thị trên mặt bằng.</div>}
    {active && mode === '2d' && <PlanView container={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} onSelectPlacement={onSelectPlacement} />}
    {active && mode === '3d' && supportsWebgl && <ContainerScene packedContainer={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} hoveredPlacementId={hoveredPlacementId} preset={preset} mode={renderMode} shell={shell} focusToken={focusToken} showLabels={showLabels} onSelectPlacement={onSelectPlacement} onHoverPlacement={setHoveredPlacementId} onRequestFocus={(key) => setFocusToken(`placement:${key}`)} />}
    {active && mode === '3d' && !supportsWebgl && <div className="viewer-empty">Thiết bị này chưa hỗ trợ WebGL. Hãy dùng “Mặt bằng” để xem phương án xếp.</div>}
  </section>;
}
