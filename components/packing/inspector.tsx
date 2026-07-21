'use client';

import { Box, Container, FileUp, Package, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { CartonInput, ContainerInput, ContainerSelectionMode, PackingStrategy } from '@/lib/packing/types';

type InspectorProps = {
  containers: ContainerInput[];
  cartons: CartonInput[];
  containerMode: ContainerSelectionMode;
  sampleContainers: Omit<ContainerInput, 'id'>[];
  strategy: PackingStrategy;
  allowRotation: boolean;
  onAddCarton: () => void;
  onAddContainer: () => void;
  onContainerModeChange: (mode: ContainerSelectionMode) => void;
  onUpdateCarton: (id: string, field: keyof CartonInput, value: string | boolean) => void;
  onUpdateContainer: (id: string, field: keyof ContainerInput, value: string) => void;
  onRemoveCarton: (id: string) => void;
  onRemoveContainer: (id: string) => void;
  onStrategyChange: (strategy: PackingStrategy) => void;
  onAllowRotationChange: (value: boolean) => void;
  onImportClick: (target: 'cartons' | 'containers') => void;
};

const tabs = [
  { id: 'cargo', label: 'Hàng hóa', icon: Package },
  { id: 'container', label: 'Container', icon: Container },
  { id: 'strategy', label: 'Chiến lược', icon: SlidersHorizontal },
  { id: 'import', label: 'Import', icon: FileUp },
] as const;

type TabId = (typeof tabs)[number]['id'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="inspector-field"><span>{label}</span>{children}</label>;
}

export function Inspector(props: InspectorProps) {
  const [active, setActive] = useState<TabId>('cargo');

  return <aside className="packing-inspector" aria-label="Inspector điều phối">
    <div className="inspector-heading"><div><p className="section-kicker">BẢNG KIỂM TRA</p><h2>Điều phối xếp hàng</h2></div><span className="telemetry-tag">LIVE</span></div>
    <div className="inspector-tabs" role="tablist" aria-label="Nhóm dữ liệu">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} id={`${id}-tab`} role="tab" type="button" aria-selected={active === id} aria-controls={`${id}-panel`} onClick={() => setActive(id)}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}
    </div>

    {active === 'cargo' && <section id="cargo-panel" role="tabpanel" aria-labelledby="cargo-tab" aria-label="Hàng hóa" className="inspector-scroll">
      <div className="section-head"><div><h3>Danh mục kiện hàng</h3><p>Quy cách và tải trọng cho thuật toán xếp.</p></div><button className="teal-action" type="button" onClick={props.onAddCarton}><Package size={16} aria-hidden="true" />Thêm vào danh sách</button></div>
      <div className="record-list">
        {props.cartons.map((carton) => <article className="record-card" key={carton.id}>
          <div className="record-title"><span className="record-index"><Box size={15} aria-hidden="true" /></span><strong>{carton.label}</strong><button aria-label={`Xóa ${carton.label}`} type="button" onClick={() => props.onRemoveCarton(carton.id)}><Trash2 size={15} /></button></div>
          <Field label="Tên / nhãn"><input value={carton.label} onChange={(event) => props.onUpdateCarton(carton.id, 'label', event.target.value)} /></Field>
          <div className="field-grid three"><Field label="Dài (m)"><input aria-label="Dài m" type="number" min="0" step="0.1" value={carton.length} onChange={(event) => props.onUpdateCarton(carton.id, 'length', event.target.value)} /></Field><Field label="Rộng (m)"><input aria-label="Rộng m" type="number" min="0" step="0.1" value={carton.width} onChange={(event) => props.onUpdateCarton(carton.id, 'width', event.target.value)} /></Field><Field label="Cao (m)"><input aria-label="Cao m" type="number" min="0" step="0.1" value={carton.height} onChange={(event) => props.onUpdateCarton(carton.id, 'height', event.target.value)} /></Field></div>
          <div className="field-grid three"><Field label="Số lượng"><input type="number" min="1" step="1" value={carton.quantity} onChange={(event) => props.onUpdateCarton(carton.id, 'quantity', event.target.value)} /></Field><Field label="Tải trọng (kg)"><input type="number" min="0" step="0.1" value={carton.weight} onChange={(event) => props.onUpdateCarton(carton.id, 'weight', event.target.value)} /></Field><Field label="Màu"><input aria-label={`Màu ${carton.label}`} type="color" value={carton.color} onChange={(event) => props.onUpdateCarton(carton.id, 'color', event.target.value)} /></Field></div>
          <label className="switch-field"><input type="checkbox" checked={carton.stackable} onChange={(event) => props.onUpdateCarton(carton.id, 'stackable', event.target.checked)} /><span>Cho phép chồng kiện</span></label>
        </article>)}
      </div>
    </section>}

    {active === 'container' && <section id="container-panel" role="tabpanel" aria-labelledby="container-tab" aria-label="Container" className="inspector-scroll">
      <div className="section-head"><div><h3>Nguồn container</h3><p>Thuật toán có thể tự chọn xe từ thư viện mẫu hoặc dùng đội xe nhập tay.</p></div></div>
      <fieldset className="container-mode" aria-label="Chế độ chọn container"><label><input type="radio" name="container-mode" checked={props.containerMode === 'presets'} onChange={() => props.onContainerModeChange('presets')} />Tự chọn container mẫu</label><label><input type="radio" name="container-mode" checked={props.containerMode === 'manual'} onChange={() => props.onContainerModeChange('manual')} />Dùng container tự nhập</label></fieldset>
      {props.containerMode === 'presets' && <div className="sample-catalog"><div className="catalog-heading"><div><h3>Container mẫu có sẵn</h3><p>Tự thử tất cả {props.sampleContainers.length} mẫu theo lượng hàng còn lại.</p></div><span className="telemetry-tag">AUTO</span></div>{props.sampleContainers.map((container) => <article className="sample-container" key={container.name}><strong>{container.name}</strong><span>{container.length} × {container.width} × {container.height} m</span><small>{container.maxWeight.toLocaleString('vi-VN')} kg</small></article>)}</div>}
      {props.containerMode === 'manual' && <><div className="section-head"><div><h3>Container tự nhập</h3><p>Chỉ dùng các container bạn thêm bên dưới.</p></div><button className="teal-action" type="button" onClick={props.onAddContainer}><Container size={16} aria-hidden="true" />Thêm container</button></div><div className="record-list">
        {props.containers.map((container) => <article className="record-card" key={container.id}>
          <div className="record-title"><span className="record-index"><Container size={15} aria-hidden="true" /></span><strong>{container.name}</strong><button aria-label={`Xóa ${container.name}`} type="button" onClick={() => props.onRemoveContainer(container.id)}><Trash2 size={15} /></button></div>
          <Field label="Tên container"><input value={container.name} onChange={(event) => props.onUpdateContainer(container.id, 'name', event.target.value)} /></Field>
          <div className="field-grid three"><Field label="Dài (m)"><input type="number" min="0" step="0.1" value={container.length} onChange={(event) => props.onUpdateContainer(container.id, 'length', event.target.value)} /></Field><Field label="Rộng (m)"><input type="number" min="0" step="0.1" value={container.width} onChange={(event) => props.onUpdateContainer(container.id, 'width', event.target.value)} /></Field><Field label="Cao (m)"><input type="number" min="0" step="0.1" value={container.height} onChange={(event) => props.onUpdateContainer(container.id, 'height', event.target.value)} /></Field></div>
          <div className="field-grid two"><Field label="Số lượng"><input type="number" min="1" step="1" value={container.quantity} onChange={(event) => props.onUpdateContainer(container.id, 'quantity', event.target.value)} /></Field><Field label="Tải trọng (kg)"><input type="number" min="0" step="1" value={container.maxWeight} onChange={(event) => props.onUpdateContainer(container.id, 'maxWeight', event.target.value)} /></Field></div>
        </article>)}
      </div></>}
    </section>}

    {active === 'strategy' && <section id="strategy-panel" role="tabpanel" aria-labelledby="strategy-tab" aria-label="Chiến lược" className="inspector-scroll strategy-panel"><div className="section-head"><div><h3>Quy tắc tối ưu</h3><p>Thay đổi chiến lược rồi chạy tối ưu lại.</p></div></div><Field label="Chiến lược xếp"><select value={props.strategy} onChange={(event) => props.onStrategyChange(event.target.value as PackingStrategy)}><option value="minContainers">Ít container nhất</option><option value="maxFill">Tỷ lệ lấp đầy cao</option><option value="inputOrder">Theo thứ tự nhập</option><option value="heavyBottom">Kiện nặng ở dưới</option></select></Field><label className="switch-field"><input type="checkbox" checked={props.allowRotation} onChange={(event) => props.onAllowRotationChange(event.target.checked)} /><span>Cho phép xoay kiện để tận dụng không gian</span></label></section>}

    {active === 'import' && <section id="import-panel" role="tabpanel" aria-labelledby="import-tab" aria-label="Import" className="inspector-scroll import-panel"><FileUp size={26} aria-hidden="true" /><h3>Nhập dữ liệu xếp hàng</h3><p>Hỗ trợ tệp CSV, JSON, XLSX và XLS. Dữ liệu hợp lệ sẽ được thêm vào danh sách hiện tại.</p><div className="import-actions"><button type="button" className="teal-action" onClick={() => props.onImportClick('cartons')}>Nhập hàng hóa</button><button type="button" className="command-button" onClick={() => props.onImportClick('containers')}>Nhập container</button></div></section>}
  </aside>;
}
