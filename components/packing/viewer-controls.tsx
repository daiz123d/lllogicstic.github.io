'use client';

import { Box } from 'lucide-react';

import type { Leftover, Placement } from '@/lib/packing/types';

import type { RenderMode, ShellVisibility, ViewerMetrics, ViewPreset } from './viewer-types';

export type ViewerControlsProps = {
  mode: RenderMode;
  shell: ShellVisibility;
  preset: ViewPreset;
  metrics: ViewerMetrics;
  selected: Placement | null;
  leftovers: Leftover[];
  onModeChange: (mode: RenderMode) => void;
  onShellChange: (next: ShellVisibility) => void;
  onPresetChange: (preset: ViewPreset) => void;
  onFit: () => void;
  observationDisabled?: boolean;
};

type ViewerHudProps = Pick<ViewerControlsProps, 'metrics' | 'selected' | 'leftovers'>;

const leftoverReasonLabels: Record<Leftover['reason'], string> = {
  oversize: 'Quá kích thước',
  overweight: 'Vượt tải trọng',
  'no-space': 'Không còn chỗ phù hợp',
};

function formatWeight(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
}

export function ViewerHud({ metrics, selected, leftovers }: ViewerHudProps) {
  return <div className="viewer-metrics" aria-label="Chỉ số mô phỏng">
    <span>Thể tích {metrics.volumePercent.toFixed(1)}%</span>
    <span>Tải trọng {formatWeight(metrics.usedWeight)} / {formatWeight(metrics.maxWeight)} kg</span>
    <span aria-live="polite" aria-atomic="true">Đã xếp {metrics.packed} / {metrics.total} kiện</span>
    <span className={`leftover-status ${leftovers.length ? 'coral' : 'gray'}`}>Chưa xếp {leftovers.length} kiện</span>
    {selected && <span aria-label="Tọa độ kiện đã chọn">X {selected.x.toFixed(2)} · Y {selected.y.toFixed(2)} · Z {selected.z.toFixed(2)}</span>}
    {leftovers.length > 0 && <div className="viewer-leftover-warnings" aria-label="Cảnh báo kiện chưa xếp">
      {leftovers.map((leftover, index) => <span className="viewer-leftover-warning" key={`${leftover.id}-${leftover.sourceIndex}-${leftover.itemIndex}-${index}`}>{leftover.label}: {leftoverReasonLabels[leftover.reason]}</span>)}
    </div>}
  </div>;
}

export function ViewerControls({ mode, shell, preset, metrics, selected, leftovers, onModeChange, onShellChange, onPresetChange, onFit, observationDisabled = false }: ViewerControlsProps) {
  const updateShell = (layer: keyof ShellVisibility, checked: boolean) => onShellChange({ ...shell, [layer]: checked });

  return <>
    <div className="simulation-toolbar" role="toolbar" aria-label="Điều khiển mô phỏng">
      {([['iso', 'Isometric'], ['top', 'Mặt trên'], ['front', 'Mặt trước'], ['side', 'Mặt bên']] as const).map(([value, label]) => <button type="button" aria-pressed={preset === value} className={preset === value ? 'active' : ''} key={value} onClick={() => onPresetChange(value)}>{label}</button>)}
      <button type="button" onClick={onFit}>Vừa khung hình</button>
      {([['solid', 'Solid'], ['xray', 'X-Ray'], ['wireframe', 'Wireframe'], ['weight', 'Tải trọng'], ['height', 'Chiều cao'], ['space', 'Khoảng trống'], ['exploded', 'Exploded View']] as const).map(([value, label]) => <button type="button" aria-pressed={mode === value} className={mode === value ? 'active' : ''} disabled={observationDisabled} key={value} onClick={() => onModeChange(value)}><Box size={15} aria-hidden="true" />{label}</button>)}
    </div>
    <fieldset className="simulation-toolbar" aria-label="Lớp vỏ container">
      <label><input type="checkbox" checked={shell.all} onChange={(event) => updateShell('all', event.target.checked)} />Tất cả vỏ</label>
      <label><input type="checkbox" checked={shell.left} onChange={(event) => updateShell('left', event.target.checked)} />Thành trái</label>
      <label><input type="checkbox" checked={shell.right} onChange={(event) => updateShell('right', event.target.checked)} />Thành phải</label>
      <label><input type="checkbox" checked={shell.roof} onChange={(event) => updateShell('roof', event.target.checked)} />Nóc container</label>
      <label><input type="checkbox" checked={shell.front} onChange={(event) => updateShell('front', event.target.checked)} />Mặt trước</label>
    </fieldset>
    <ViewerHud metrics={metrics} selected={selected} leftovers={leftovers} />
  </>;
}
