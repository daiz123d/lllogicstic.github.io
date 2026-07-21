'use client';

import { useMemo, useState } from 'react';

import { packMultipleContainers } from '@/lib/packing/engine';
import type { CartonInput, ContainerInput, PackingResult, PackingStrategy } from '@/lib/packing/types';
import { PackingViewer, placementKey } from './packing-viewer';

const defaultContainers: ContainerInput[] = [{
  id: 'container-1', name: 'Container 1', length: 4, width: 5, height: 3, quantity: 1, maxWeight: 1000,
}];

const defaultCartons: CartonInput[] = [{
  id: 'carton-1', label: 'Hộp mẫu', length: 1, width: 1, height: 1, quantity: 4, weight: 1, stackable: true, color: '#36c5f0',
}];

const reasonLabels = { oversize: 'Quá kích thước', overweight: 'Vượt tải trọng', 'no-space': 'Không còn chỗ phù hợp' };

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function numberValue(value: string) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function isValidContainer(container: ContainerInput) {
  return container.length > 0 && container.width > 0 && container.height > 0 && container.quantity > 0 && container.maxWeight >= 0;
}

function isValidCarton(carton: CartonInput) {
  return carton.length > 0 && carton.width > 0 && carton.height > 0 && carton.quantity > 0 && carton.weight >= 0;
}

export function PackingWorkspace() {
  const [containers, setContainers] = useState(defaultContainers);
  const [cartons, setCartons] = useState(defaultCartons);
  const [allowRotation, setAllowRotation] = useState(true);
  const [strategy, setStrategy] = useState<PackingStrategy>('minContainers');
  const [result, setResult] = useState<PackingResult | null>(null);
  const [message, setMessage] = useState('Sẵn sàng tạo phương án xếp hàng.');
  const [step, setStep] = useState(0);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);

  const invalid = !containers.every(isValidContainer) || !cartons.every(isValidCarton);
  const packedCount = useMemo(() => result?.results.reduce((sum, item) => sum + item.packed.length, 0) ?? 0, [result]);
  const totalCount = useMemo(() => cartons.reduce((sum, carton) => sum + carton.quantity, 0), [cartons]);
  const usedContainerCount = useMemo(() => result?.results.filter((item) => item.packed.length > 0).length ?? 0, [result]);
  const placementCount = useMemo(() => result?.results.reduce((sum, item) => sum + item.packed.length, 0) ?? 0, [result]);
  const selectedPlacement = useMemo(() => result?.results.flatMap((item) => item.packed.map((placement) => ({ placement, containerId: item.container.id }))).find(({ placement, containerId }) => placementKey(containerId, placement) === selectedPlacementId)?.placement ?? null, [result, selectedPlacementId]);

  function updateContainer(containerId: string, field: keyof ContainerInput, value: string) {
    setContainers((items) => items.map((container) => container.id === containerId
      ? { ...container, [field]: field === 'name' ? value : numberValue(value) }
      : container));
    setResult(null);
    setStep(0);
  }

  function updateCarton(cartonId: string, field: keyof CartonInput, value: string | boolean) {
    setCartons((items) => items.map((carton) => carton.id === cartonId
      ? { ...carton, [field]: typeof value === 'boolean' ? value : ['label', 'color'].includes(field) ? value : numberValue(value) }
      : carton));
    setResult(null);
    setStep(0);
  }

  function addContainer() {
    setContainers((items) => [...items, { ...defaultContainers[0], id: id('container'), name: `Container ${items.length + 1}` }]);
    setResult(null);
    setStep(0);
  }

  function addCarton() {
    setCartons((items) => [...items, { ...defaultCartons[0], id: id('carton'), label: `Hộp ${items.length + 1}`, color: '#a78bfa' }]);
    setResult(null);
    setStep(0);
  }

  function runPacking() {
    if (invalid) {
      setMessage('Kiểm tra lại kích thước, số lượng và tải trọng. Các giá trị phải hợp lệ.');
      return;
    }
    const nextResult = packMultipleContainers(containers, cartons, { allowRotation, strategy });
    setResult(nextResult);
    setStep(nextResult.results.reduce((sum, item) => sum + item.packed.length, 0));
    setSelectedPlacementId(null);
    const nextPacked = nextResult.results.reduce((sum, item) => sum + item.packed.length, 0);
    setMessage(`Đã xếp ${nextPacked} kiện${nextResult.leftover.length ? `, còn ${nextResult.leftover.length} kiện chưa xếp` : ', không còn kiện dư'}.`);
  }

  return (
    <section className="packing-workspace" aria-label="Không gian xếp thùng">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">LOGISTICS PACKING STUDIO</p>
          <h1>Xếp thùng thông minh</h1>
          <p>Tạo phương án xếp kiện theo thể tích, tải trọng và khả năng chồng hàng ngay trên trình duyệt.</p>
        </div>
        <button className="primary-button" type="button" onClick={runPacking}>Xếp thùng</button>
      </header>

      <div className="workspace-grid">
        <aside className="control-stack" aria-label="Dữ liệu xếp hàng">
          <section className="panel">
            <div className="panel-heading"><div><p className="section-kicker">01</p><h2>Container</h2></div><button type="button" className="text-button" onClick={addContainer}>+ Thêm</button></div>
            {containers.map((container) => (
              <fieldset className="input-card" key={container.id}>
                <legend>{container.name}</legend>
                <label>Tên<input value={container.name} onChange={(event) => updateContainer(container.id, 'name', event.target.value)} /></label>
                <div className="input-grid three">
                  <label>Dài (m)<input aria-invalid={container.length <= 0} type="number" min="0" step="0.1" value={container.length} onChange={(event) => updateContainer(container.id, 'length', event.target.value)} /></label>
                  <label>Rộng (m)<input aria-invalid={container.width <= 0} type="number" min="0" step="0.1" value={container.width} onChange={(event) => updateContainer(container.id, 'width', event.target.value)} /></label>
                  <label>Cao (m)<input aria-invalid={container.height <= 0} type="number" min="0" step="0.1" value={container.height} onChange={(event) => updateContainer(container.id, 'height', event.target.value)} /></label>
                </div>
                <div className="input-grid two">
                  <label>Số container<input type="number" min="1" step="1" value={container.quantity} onChange={(event) => updateContainer(container.id, 'quantity', event.target.value)} /></label>
                  <label>Tải trọng (kg)<input type="number" min="0" step="1" value={container.maxWeight} onChange={(event) => updateContainer(container.id, 'maxWeight', event.target.value)} /></label>
                </div>
                {containers.length > 1 && <button type="button" className="remove-button" onClick={() => { setContainers((items) => items.filter((item) => item.id !== container.id)); setResult(null); }}>Xóa container</button>}
              </fieldset>
            ))}
          </section>

          <section className="panel">
            <div className="panel-heading"><div><p className="section-kicker">02</p><h2>Kiện hàng</h2></div><button type="button" className="text-button" onClick={addCarton}>+ Thêm</button></div>
            {cartons.map((carton) => (
              <fieldset className="input-card" key={carton.id}>
                <legend>{carton.label}</legend>
                <label>Tên kiện<input value={carton.label} onChange={(event) => updateCarton(carton.id, 'label', event.target.value)} /></label>
                <div className="input-grid three">
                  <label>Dài (m)<input aria-invalid={carton.length <= 0} type="number" min="0" step="0.1" value={carton.length} onChange={(event) => updateCarton(carton.id, 'length', event.target.value)} /></label>
                  <label>Rộng (m)<input aria-invalid={carton.width <= 0} type="number" min="0" step="0.1" value={carton.width} onChange={(event) => updateCarton(carton.id, 'width', event.target.value)} /></label>
                  <label>Cao (m)<input aria-invalid={carton.height <= 0} type="number" min="0" step="0.1" value={carton.height} onChange={(event) => updateCarton(carton.id, 'height', event.target.value)} /></label>
                </div>
                <div className="input-grid three">
                  <label>Số lượng<input type="number" min="1" step="1" value={carton.quantity} onChange={(event) => updateCarton(carton.id, 'quantity', event.target.value)} /></label>
                  <label>Nặng (kg)<input type="number" min="0" step="0.1" value={carton.weight} onChange={(event) => updateCarton(carton.id, 'weight', event.target.value)} /></label>
                  <label>Màu<input aria-label={`Màu ${carton.label}`} type="color" value={carton.color} onChange={(event) => updateCarton(carton.id, 'color', event.target.value)} /></label>
                </div>
                <label className="checkbox-label"><input type="checkbox" checked={carton.stackable} onChange={(event) => updateCarton(carton.id, 'stackable', event.target.checked)} />Có thể chồng kiện</label>
                {cartons.length > 1 && <button type="button" className="remove-button" onClick={() => { setCartons((items) => items.filter((item) => item.id !== carton.id)); setResult(null); }}>Xóa kiện</button>}
              </fieldset>
            ))}
          </section>

          <section className="panel options-panel">
            <p className="section-kicker">03</p><h2>Quy tắc xếp</h2>
            <label>Ưu tiên<select value={strategy} onChange={(event) => setStrategy(event.target.value as PackingStrategy)}><option value="minContainers">Ít container nhất</option><option value="maxFill">Tỷ lệ lấp đầy cao</option><option value="inputOrder">Theo thứ tự nhập</option><option value="heavyBottom">Kiện nặng ở dưới</option></select></label>
            <label className="checkbox-label"><input type="checkbox" checked={allowRotation} onChange={(event) => setAllowRotation(event.target.checked)} />Cho phép xoay kiện</label>
          </section>
        </aside>

        <section className="result-stack" aria-live="polite">
          <div className="status-card"><span className={result ? 'status-dot ready' : 'status-dot'} />{message}</div>
          <div className="metric-grid">
            <article><span>Tổng kiện</span><strong>{totalCount}</strong></article><article><span>Đã xếp</span><strong>{packedCount}</strong></article><article><span>Container dùng</span><strong>{usedContainerCount}</strong></article><article><span>Kiện dư</span><strong>{result?.leftover.length ?? 0}</strong></article>
          </div>
          <PackingViewer packedContainers={result?.results ?? []} selectedPlacementId={selectedPlacementId} onSelectPlacement={setSelectedPlacementId} step={step} />
          {result && placementCount > 0 && <section className="playback-panel" aria-label="Trình tự xếp hàng">
            <div><p className="section-kicker">TRÌNH TỰ XẾP</p><strong>Kiện {Math.min(step, placementCount)} / {placementCount}</strong></div>
            <div className="playback-controls"><button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))}>← Trước</button><input aria-label="Tiến trình xếp hàng" type="range" min="0" max={placementCount} value={step} onChange={(event) => setStep(numberValue(event.target.value))} /><button type="button" onClick={() => setStep((value) => Math.min(placementCount, value + 1))}>Tiếp →</button></div>
            {selectedPlacement && <p className="selected-detail">Đang chọn: <strong>{selectedPlacement.label}</strong> · vị trí ({selectedPlacement.x.toFixed(1)}, {selectedPlacement.y.toFixed(1)}, {selectedPlacement.z.toFixed(1)}) · {selectedPlacement.weight} kg</p>}
          </section>}
          <section className="panel result-panel">
            <div className="panel-heading"><div><p className="section-kicker">PHƯƠNG ÁN</p><h2>Kết quả xếp hàng</h2></div></div>
            {!result && <div className="empty-state">Nhấn “Xếp thùng” để tạo phương án và mở không gian 3D.</div>}
            {result && <>
              {result.results.filter((item) => item.packed.length > 0).map((item) => <article key={item.container.id} className="container-result"><h3>{item.container.name}</h3><p>{item.packed.length} kiện · {item.packed.reduce((sum, box) => sum + box.weight, 0).toFixed(1)} kg</p></article>)}
              {result.leftover.length > 0 && <div className="leftover-list"><h3>Kiện chưa xếp</h3>{result.leftover.map((box, index) => <p key={`${box.id}-${index}`}><span>{box.label}</span><em>{reasonLabels[box.reason]}</em></p>)}</div>}
            </>}
          </section>
        </section>
      </div>
    </section>
  );
}
