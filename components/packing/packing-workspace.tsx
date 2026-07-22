'use client';

import { Download } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { CommandBar } from '@/components/control-center/command-bar';
import { ControlCenterShell } from '@/components/control-center/control-center-shell';
import type { KpiMetric } from '@/components/control-center/kpi-strip';
import { parseContainerRows } from '@/lib/packing/container-import';
import { packMultipleContainers, packWithPresetContainers, sampleContainers } from '@/lib/packing/engine';
import { downloadPackingWorkbook, readRowsFromFile } from '@/lib/packing/file-io';
import { parseCartonRows } from '@/lib/packing/import';
import type { CartonInput, ContainerInput, ContainerSelectionMode, PackingResult, PackingStrategy } from '@/lib/packing/types';
import { Inspector } from './inspector';
import { PackingResultTable } from './packing-result-table';
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

function summarizeSelectedContainers(results: PackingResult['results']) {
  const counts = new Map<string, number>();
  results.forEach(({ container }) => counts.set(container.name, (counts.get(container.name) ?? 0) + 1));
  return [...counts].map(([name, count]) => `${count} × ${name}`).join(', ');
}

type ImportTarget = 'cartons' | 'containers';

export function PackingWorkspace() {
  const [containers, setContainers] = useState(defaultContainers);
  const [cartons, setCartons] = useState(defaultCartons);
  const [containerMode, setContainerMode] = useState<ContainerSelectionMode>('presets');
  const [allowRotation, setAllowRotation] = useState(true);
  const [strategy, setStrategy] = useState<PackingStrategy>('minContainers');
  const [result, setResult] = useState<PackingResult | null>(null);
  const [message, setMessage] = useState('Sẵn sàng tạo phương án xếp hàng.');
  const [step, setStep] = useState(0);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState({ key: 'fit', nonce: 0 });
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<ImportTarget>('cartons');

  const invalid = !cartons.every(isValidCarton) || (containerMode === 'manual' && !containers.every(isValidContainer));
  const packedCount = useMemo(() => result?.results.reduce((sum, item) => sum + item.packed.length, 0) ?? 0, [result]);
  const totalCount = useMemo(() => cartons.reduce((sum, carton) => sum + carton.quantity, 0), [cartons]);
  const usedContainerCount = useMemo(() => result?.results.filter((item) => item.packed.length > 0).length ?? 0, [result]);
  const placementCount = useMemo(() => result?.results.reduce((sum, item) => sum + item.packed.length, 0) ?? 0, [result]);
  const selectedPlacement = useMemo(() => result?.results.flatMap((item) => item.packed.map((placement) => ({ placement, containerId: item.container.id }))).find(({ placement, containerId }) => placementKey(containerId, placement) === selectedPlacementId)?.placement ?? null, [result, selectedPlacementId]);
  const focusToken = `${focusRequest.key}:${focusRequest.nonce}`;

  function requestFocus(key: string) {
    setFocusRequest((current) => ({ key: key === 'fit' ? 'fit' : `placement:${key}`, nonce: current.nonce + 1 }));
  }

  function selectPlacement(placementId: string) {
    const owner = result?.results.find((item) => item.container.id === placementId.slice(0, placementId.lastIndexOf(':')));
    const placementIndex = owner?.packed.findIndex((placement) => placementKey(owner.container.id, placement) === placementId) ?? -1;
    if (owner && placementIndex >= 0) {
      const placement = owner.packed[placementIndex];
      const revealStep = placement.order === placementIndex + 1 ? placement.order : placementIndex + 1;
      setStep((current) => Math.max(current, revealStep));
    }
    setSelectedPlacementId(placementId);
  }
  const kpis = useMemo<KpiMetric[]>(() => [
    { id: 'containers', label: 'Container khả dụng', value: containerMode === 'presets' ? sampleContainers.length : containers.reduce((sum, item) => sum + item.quantity, 0), status: containerMode === 'presets' ? 'Thư viện container mẫu' : 'Đội container sẵn sàng', progress: 100, tone: 'cyan' },
    { id: 'cartons', label: 'Tổng số hộp', value: totalCount, status: 'Dữ liệu đầu vào', progress: totalCount ? 100 : 0, tone: 'teal' },
    { id: 'packed', label: 'Đã xếp', value: packedCount, status: result ? `${totalCount ? Math.round((packedCount / totalCount) * 100) : 0}% hoàn tất` : 'Chưa tối ưu', progress: totalCount ? (packedCount / totalCount) * 100 : 0, tone: 'teal' },
    { id: 'leftover', label: 'Chưa xếp', value: result?.leftover.length ?? 0, status: result?.leftover.length ? 'Cần xử lý' : 'Không có cảnh báo', progress: result?.leftover.length ? 100 : 0, tone: result?.leftover.length ? 'coral' : 'amber' },
  ], [containerMode, containers, packedCount, placementCount, result, totalCount]);

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
    const nextResult = containerMode === 'presets'
      ? packWithPresetContainers(cartons, { allowRotation, strategy })
      : packMultipleContainers(containers, cartons, { allowRotation, strategy });
    setResult(nextResult);
    setStep(nextResult.results.reduce((sum, item) => sum + item.packed.length, 0));
    setSelectedPlacementId(null);
    const nextPacked = nextResult.results.reduce((sum, item) => sum + item.packed.length, 0);
    const selectedNames = summarizeSelectedContainers(nextResult.results);
    setMessage(`${containerMode === 'presets' ? 'Đã tự chọn' : 'Đã dùng'} ${selectedNames || 'chưa có container'} để xếp ${nextPacked} kiện${nextResult.leftover.length ? `, còn ${nextResult.leftover.length} kiện chưa xếp` : ', không còn kiện dư'}.`);
  }

  function updateContainerMode(mode: ContainerSelectionMode) {
    setContainerMode(mode);
    setResult(null);
    setStep(0);
    setSelectedPlacementId(null);
    setMessage(mode === 'presets' ? 'Sẵn sàng tự chọn container mẫu theo lượng hàng.' : 'Sẵn sàng dùng container tự nhập.');
  }

  function updateStrategy(nextStrategy: PackingStrategy) {
    setStrategy(nextStrategy);
    setResult(null);
    setStep(0);
  }

  function updateAllowRotation(value: boolean) {
    setAllowRotation(value);
    setResult(null);
    setStep(0);
  }

  function resetWorkspace() {
    setContainers(defaultContainers);
    setCartons(defaultCartons);
    setContainerMode('presets');
    setAllowRotation(true);
    setStrategy('minContainers');
    setResult(null);
    setStep(0);
    setSelectedPlacementId(null);
    setMessage('Đã đặt lại dữ liệu điều phối về trạng thái ban đầu.');
  }

  function removeCarton(cartonId: string) {
    setCartons((items) => items.length > 1 ? items.filter((item) => item.id !== cartonId) : items);
    setResult(null);
    setStep(0);
  }

  function removeContainer(containerId: string) {
    setContainers((items) => items.length > 1 ? items.filter((item) => item.id !== containerId) : items);
    setResult(null);
    setStep(0);
  }

  function chooseImport(target: ImportTarget) {
    setImportTarget(target);
    importInputRef.current?.click();
  }

  async function importFile(file: File) {
    try {
      const rows = await readRowsFromFile(file);
      if (importTarget === 'cartons') {
        const parsed = parseCartonRows(rows);
        const imported = parsed.boxes.map((box, index) => ({ ...box, id: id('carton'), label: `Kiện nhập ${cartons.length + index + 1}` }));
        if (!imported.length) throw new Error('Không tìm thấy kiện hàng hợp lệ trong tệp.');
        setCartons((items) => [...items, ...imported]);
        setMessage(`Đã thêm ${imported.length} kiện hàng${parsed.skipped ? `, bỏ qua ${parsed.skipped} dòng không hợp lệ` : ''}.`);
      } else {
        const parsed = parseContainerRows(rows);
        const imported = parsed.containers.map((container) => ({ ...container, id: id('container') }));
        if (!imported.length) throw new Error('Không tìm thấy container hợp lệ trong tệp.');
        setContainers((items) => [...items, ...imported]);
        setMessage(`Đã thêm ${imported.length} container${parsed.skipped ? `, bỏ qua ${parsed.skipped} dòng không hợp lệ` : ''}.`);
      }
      setResult(null);
      setStep(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đọc tệp đã chọn.');
    }
  }

  async function exportWorkbook() {
    await downloadPackingWorkbook(cartons, containers, result);
    setMessage('Đã tạo tệp Excel để tải xuống.');
  }

  return <ControlCenterShell
    kpis={kpis}
    commandBar={<CommandBar title="Bảng điều phối xếp hàng 3D" breadcrumb="Điều hành / Digital Twin / Xếp hàng" isSaved={Boolean(result)} onImport={() => chooseImport('cartons')} onReset={resetWorkspace} onOptimize={runPacking} optimizeDisabled={invalid}><button className="command-button" type="button" onClick={exportWorkbook}><Download size={16} aria-hidden="true" />Xuất XLSX</button></CommandBar>}
  >
    <input ref={importInputRef} className="visually-hidden" type="file" accept=".csv,.json,.xlsx,.xls" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ''; }} />
    <section className="packing-workspace" aria-label="Không gian xếp thùng">
      <div className="workflow-stepper" aria-label="Quy trình xếp hàng"><span className="complete">1 Chọn container</span><i /><span className="complete">2 Nhập hàng hóa</span><i /><span className="complete">3 Chọn chiến lược</span><i /><span className={result ? 'complete' : 'current'}>4 Tối ưu xếp hàng</span><i /><span className={result ? 'current' : ''}>5 Kiểm tra & xuất</span></div>
      <div className="work-grid">
        <section className="simulation-stage" aria-live="polite">
          <div className="stage-status"><span className={result ? 'status-dot ready' : 'status-dot'} />{message}<span className="stage-context">{result ? `${usedContainerCount} container đang hiển thị` : 'Chờ dữ liệu xếp hàng'}</span></div>
          <PackingViewer packedContainers={result?.results ?? []} selectedPlacementId={selectedPlacementId} onSelectPlacement={selectPlacement} step={step} focusToken={focusToken} onRequestFocus={requestFocus} />
          {result && placementCount > 0 && <section className="playback-panel" aria-label="Trình tự xếp hàng"><div><p className="section-kicker">PLAYBACK</p><strong>Kiện {Math.min(step, placementCount)} / {placementCount}</strong></div><div className="playback-controls"><button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))}>← Trước</button><input aria-label="Tiến trình xếp hàng" type="range" min="0" max={placementCount} value={step} onChange={(event) => setStep(numberValue(event.target.value))} /><button type="button" onClick={() => setStep((value) => Math.min(placementCount, value + 1))}>Tiếp →</button></div>{selectedPlacement && <p className="selected-detail">Đang chọn: <strong>{selectedPlacement.label}</strong> · vị trí ({selectedPlacement.x.toFixed(1)}, {selectedPlacement.y.toFixed(1)}, {selectedPlacement.z.toFixed(1)}) · {selectedPlacement.weight} kg</p>}</section>}
        </section>
        <Inspector containers={containers} cartons={cartons} containerMode={containerMode} sampleContainers={sampleContainers} strategy={strategy} allowRotation={allowRotation} onAddCarton={addCarton} onAddContainer={addContainer} onContainerModeChange={updateContainerMode} onUpdateCarton={updateCarton} onUpdateContainer={updateContainer} onRemoveCarton={removeCarton} onRemoveContainer={removeContainer} onStrategyChange={updateStrategy} onAllowRotationChange={updateAllowRotation} onImportClick={chooseImport} />
      </div>
      <section className="result-panel command-result-panel">
        <div className="panel-heading"><div><p className="section-kicker">KẾT QUẢ TỐI ƯU</p><h2>Phương án xếp hàng</h2></div><span className={result?.leftover.length ? 'telemetry-tag warning' : 'telemetry-tag'}>{result ? `${packedCount}/${totalCount} kiện` : 'CHỜ TÍNH TOÁN'}</span></div>
        {!result && <div className="empty-state">Thiết lập container, kiện hàng và chiến lược trong Inspector, sau đó chạy tối ưu để kích hoạt Digital Twin.</div>}
        {result && <><div className="result-summary-grid"><div>{result.results.filter((item) => item.packed.length > 0).map((item) => <article key={item.container.id} className="container-result"><h3>{item.container.name}</h3><p>{item.packed.length} kiện · {item.packed.reduce((sum, box) => sum + box.weight, 0).toFixed(1)} kg</p></article>)}</div>{result.leftover.length > 0 && <div className="leftover-list"><h3>Kiện chưa xếp</h3>{result.leftover.map((box, index) => <p key={`${box.id}-${index}`}><span>{box.label}</span><em>{reasonLabels[box.reason]}</em></p>)}</div>}</div><PackingResultTable result={result} selectedPlacementId={selectedPlacementId} onSelectPlacement={selectPlacement} onFocusPlacement={requestFocus} /></>}
      </section>
    </section>
  </ControlCenterShell>;
}
