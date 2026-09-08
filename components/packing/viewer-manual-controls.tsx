'use client';

import { useEffect } from 'react';

import type {
  ManualAxis,
  ManualSnap,
  ManualTransformMode,
  PlacementDraft,
  PlacementValidation,
} from '@/lib/packing/manual-layout';

export type ViewerManualControlsProps = {
  enabled: boolean;
  selectedKey: string | null;
  selected: PlacementDraft | null;
  validation: PlacementValidation;
  override: boolean;
  mode: ManualTransformMode;
  axis: ManualAxis;
  snap: ManualSnap;
  onEnabledChange: (enabled: boolean) => void;
  onModeChange: (mode: ManualTransformMode) => void;
  onAxisChange: (axis: ManualAxis) => void;
  onSnapChange: (snap: ManualSnap) => void;
  onDraftChange: (draft: PlacementDraft) => void;
  onOverrideChange: (override: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
};

const snaps: { value: ManualSnap; label: string }[] = [
  { value: .01, label: '1 cm' },
  { value: .05, label: '5 cm' },
  { value: .10, label: '10 cm' },
];

export function ViewerManualControls({
  enabled,
  selectedKey,
  selected,
  validation,
  override,
  mode,
  axis,
  snap,
  onEnabledChange,
  onModeChange,
  onAxisChange,
  onSnapChange,
  onDraftChange,
  onOverrideChange,
  onApply,
  onCancel,
}: ViewerManualControlsProps) {
  useEffect(() => {
    onOverrideChange(false);
  }, [selectedKey, selected?.x, selected?.y, selected?.z, selected?.width, selected?.height, selected?.length, selected?.rotation, onOverrideChange]);

  function updateCoordinate(field: 'x' | 'y' | 'z', value: string) {
    if (!selected) return;
    onDraftChange({ ...selected, [field]: value === '' ? Number.NaN : Number(value) });
  }

  const applyDisabled = !selected || (!validation.valid && !override);

  return <section className="manual-layout-controls" aria-label="Điều khiển chỉnh tay">
    <div className="simulation-toolbar" role="toolbar" aria-label="Chỉnh vị trí kiện">
      <button type="button" className={enabled ? 'active' : ''} aria-pressed={enabled} onClick={() => onEnabledChange(!enabled)}>Chỉnh tay</button>
      <button type="button" className={mode === 'translate' ? 'active' : ''} aria-pressed={mode === 'translate'} disabled={!enabled} onClick={() => onModeChange('translate')}>Translate</button>
      <button type="button" className={mode === 'rotate' ? 'active' : ''} aria-pressed={mode === 'rotate'} disabled={!enabled} onClick={() => onModeChange('rotate')}>Rotate</button>
      {(['X', 'Y', 'Z'] as const).map((nextAxis) => <button key={nextAxis} type="button" aria-label={`Trục ${nextAxis}`} className={axis === nextAxis ? 'active' : ''} aria-pressed={axis === nextAxis} disabled={!enabled} onClick={() => onAxisChange(nextAxis)}>{nextAxis}</button>)}
      {snaps.map((item) => <button key={item.value} type="button" className={snap === item.value ? 'active' : ''} aria-pressed={snap === item.value} disabled={!enabled} onClick={() => onSnapChange(item.value)}>{item.label}</button>)}
    </div>
    {enabled && <div className="simulation-toolbar manual-layout-details">
      {selected ? <>
        {(['x', 'y', 'z'] as const).map((coordinate) => <label key={coordinate} className="inspector-field"><span>{coordinate.toUpperCase()} (m)</span><input aria-label={`${coordinate.toUpperCase()} (m)`} type="number" step={snap} value={Number.isFinite(selected[coordinate]) ? selected[coordinate] : ''} onChange={(event) => updateCoordinate(coordinate, event.target.value)} /></label>)}
        <span aria-label="Chỉ báo xoay">↻ {selected.rotation.map((value) => `${Math.round(value * 180 / Math.PI)}°`).join(' / ')}</span>
      </> : <span>Chọn một kiện đang hiển thị để chỉnh vị trí.</span>}
      {!validation.valid && <div role="alert"><ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <label className="switch-field"><input type="checkbox" checked={override} disabled={!selected || validation.valid} onChange={(event) => onOverrideChange(event.target.checked)} />Cho phép ghi đè cảnh báo</label>
      <button type="button" disabled={!selected} onClick={onCancel}>Hủy thay đổi</button>
      <button type="button" disabled={applyDisabled} onClick={onApply}>Áp dụng vị trí</button>
    </div>}
  </section>;
}
