'use client';

import { Download } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CommandBar } from '@/components/control-center/command-bar';
import { ControlCenterShell } from '@/components/control-center/control-center-shell';
import type { KpiMetric } from '@/components/control-center/kpi-strip';
import type { WorkspaceSection } from '@/components/control-center/sidebar';
import { parseContainerRows } from '@/lib/packing/container-import';
import { sampleContainers } from '@/lib/packing/engine';
import { startPackingJob } from '@/lib/packing/packing-job';
import { downloadPackingWorkbook, readRowsFromFile } from '@/lib/packing/file-io';
import { parseCartonRows } from '@/lib/packing/import';
import { applyPlacementOverride, validatePlacementDraft } from '@/lib/packing/manual-layout';
import type { PlacementOverride } from '@/lib/packing/manual-layout';
import type { CartonInput, ContainerInput, ContainerSelectionMode, PackingResult, PackingStrategy } from '@/lib/packing/types';
import { Inspector } from './inspector';
import type { TabId } from './inspector';
import type { WorkspaceSnapshot } from '@/lib/packing/workspace-storage';
import { useWorkspacePersistence } from './use-workspace-persistence';
import { PackingResultTable } from './packing-result-table';
import { getGlobalPlacementOwner, getGlobalPlacementStep, PackingViewer, placementKey } from './packing-viewer';
import { ViewerPlayback } from './viewer-playback';
import type { PlaybackTransitionDescriptor, PlaybackTransitionSource } from './viewer-types';

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
  return [container.length, container.width, container.height].every((value) => Number.isFinite(value) && value > 0)
    && Number.isSafeInteger(container.quantity) && container.quantity > 0
    && Number.isFinite(container.maxWeight) && container.maxWeight >= 0;
}

function isValidCarton(carton: CartonInput) {
  return [carton.length, carton.width, carton.height].every((value) => Number.isFinite(value) && value > 0)
    && Number.isSafeInteger(carton.quantity) && carton.quantity > 0
    && Number.isFinite(carton.weight) && carton.weight >= 0;
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
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<.5 | 1 | 2>(1);
  const [playbackTransition, setPlaybackTransition] = useState<PlaybackTransitionDescriptor | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState({ key: 'fit', nonce: 0 });
  const [placementOverrides, setPlacementOverrides] = useState<Record<string, PlacementOverride>>({});
  const importInputRef = useRef<HTMLInputElement>(null);
  const playbackTransitionNonce = useRef(0);
  const [importTarget, setImportTarget] = useState<ImportTarget>('cartons');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [activeTab, setActiveTab] = useState<TabId>('cargo');
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('workspace');
  const [computing, setComputing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cancelJob = useRef<(() => void) | null>(null);
  const jobGeneration = useRef(0);
  const importGeneration = useRef(0);
  const revision = useRef(0);

  const snapshot = useMemo<WorkspaceSnapshot>(() => ({
    version: 1, containers, cartons, containerMode, allowRotation, strategy, result, placementOverrides,
  }), [containers, cartons, containerMode, allowRotation, strategy, result, placementOverrides]);
  const persistence = useWorkspacePersistence(snapshot, (saved) => {
    setContainers(saved.containers);
    setCartons(saved.cartons);
    setContainerMode(saved.containerMode);
    setAllowRotation(saved.allowRotation);
    setStrategy(saved.strategy);
    setResult(saved.result);
    setPlacementOverrides(saved.placementOverrides);
    setStep(saved.result?.results.reduce((sum, item) => sum + item.packed.length, 0) ?? 0);
    setMessage('Đã khôi phục phiên làm việc trên máy này. Bạn có thể tiếp tục chỉnh sửa hoặc xuất kết quả.');
  });

  const invalid = !cartons.every(isValidCarton) || (containerMode === 'manual' && !containers.every(isValidContainer));
  const statusMessage = invalid
    ? 'Kiểm tra dữ liệu: kích thước phải lớn hơn 0, số lượng phải là số nguyên dương hợp lệ, tải trọng không được âm.'
    : message;
  const presentationResult = useMemo<PackingResult | null>(() => result ? {
    ...result,
    results: result.results.map((packedContainer) => Object.entries(placementOverrides).reduce(
      (current, [key, override]) => key.startsWith(`${packedContainer.container.id}:`) ? applyPlacementOverride(current, key, override) : current,
      packedContainer,
    )),
  } : null, [placementOverrides, result]);
  const packedCount = useMemo(() => result?.results.reduce((sum, item) => sum + item.packed.length, 0) ?? 0, [result]);
  const totalCount = useMemo(() => cartons.reduce((sum, carton) => sum + carton.quantity, 0), [cartons]);
  const usedContainerCount = useMemo(() => result?.results.filter((item) => item.packed.length > 0).length ?? 0, [result]);
  const placementCount = useMemo(() => result?.results.reduce((sum, item) => sum + item.packed.length, 0) ?? 0, [result]);
  const selectedPlacement = useMemo(() => presentationResult?.results.flatMap((item) => item.packed.map((placement) => ({ placement, containerId: item.container.id }))).find(({ placement, containerId }) => placementKey(containerId, placement) === selectedPlacementId)?.placement ?? null, [presentationResult, selectedPlacementId]);
  const focusToken = `${focusRequest.key}:${focusRequest.nonce}`;
  const adjustedCount = Object.keys(placementOverrides).length;
  const layoutWarnings = useMemo(() => {
    if (!presentationResult || !Object.keys(placementOverrides).length) return [];
    return presentationResult.results.flatMap(({ container, packed }) => {
      if (!packed.length || !Object.keys(placementOverrides).some((key) => key.startsWith(`${container.id}:`))) return [];
      return validatePlacementDraft(container, packed, packed[0], packed[0]).errors.map((error) => `${container.name}: ${error}`);
    });
  }, [presentationResult, placementOverrides]);
  const currentStep = computing ? 3 : result ? 4 : activeTab === 'strategy' ? 3 : activeTab === 'container' ? 2 : 1;
  const saveMessage = { loading: 'Đang khôi phục…', saving: 'Đang lưu…', saved: 'Đã lưu trên máy', error: 'Chưa lưu được trên máy' }[persistence.status];

  useEffect(() => () => {
    jobGeneration.current += 1;
    importGeneration.current += 1;
    revision.current += 1;
    cancelJob.current?.();
  }, []);

  function navigate(section: WorkspaceSection) {
    setActiveSection(section);
    if (section === 'cargo' || section === 'container' || section === 'import') setActiveTab(section);
    document.getElementById(['cargo', 'container', 'import'].includes(section) ? 'packing-inspector' : section)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  function changeTab(tab: TabId) {
    setActiveTab(tab);
    if (tab !== 'strategy') setActiveSection(tab);
  }

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  function requestFocus(key: string) {
    setFocusRequest((current) => ({ key: key === 'fit' ? 'fit' : `placement:${key}`, nonce: current.nonce + 1 }));
  }

  function updatePlaybackStep(nextStep: number, source: PlaybackTransitionSource) {
    const clampedStep = Math.min(placementCount, Math.max(0, nextStep));
    const owner = getGlobalPlacementOwner(result?.results ?? [], clampedStep);
    setPlaybackTransition({
      source,
      fromStep: step,
      toStep: clampedStep,
      ownerContainerId: owner?.containerId ?? null,
      nonce: ++playbackTransitionNonce.current,
      issuedAt: performance.now(),
    });
    setStep(clampedStep);
  }

  function selectPlacement(placementId: string) {
    const owner = result?.results.find((item) => item.container.id === placementId.slice(0, placementId.lastIndexOf(':')));
    const placementIndex = owner?.packed.findIndex((placement) => placementKey(owner.container.id, placement) === placementId) ?? -1;
    if (owner && placementIndex >= 0) {
      const revealStep = getGlobalPlacementStep(result?.results ?? [], owner.container.id, placementIndex);
      if (revealStep > step) updatePlaybackStep(revealStep, 'manual');
    }
    setSelectedPlacementId(placementId);
  }
  const kpis = useMemo<KpiMetric[]>(() => [
    { id: 'containers', label: 'Container khả dụng', value: containerMode === 'presets' ? sampleContainers.length : containers.reduce((sum, item) => sum + item.quantity, 0), status: containerMode === 'presets' ? 'Thư viện container mẫu' : 'Đội container sẵn sàng', progress: 100, tone: 'cyan' },
    { id: 'cartons', label: 'Tổng số hộp', value: totalCount, status: 'Dữ liệu đầu vào', progress: totalCount ? 100 : 0, tone: 'teal' },
    { id: 'packed', label: 'Đã xếp', value: packedCount, status: result ? `${totalCount ? Math.round((packedCount / totalCount) * 100) : 0}% hoàn tất` : 'Chưa tối ưu', progress: totalCount ? (packedCount / totalCount) * 100 : 0, tone: 'teal' },
    { id: 'leftover', label: 'Chưa xếp', value: result?.leftover.length ?? 0, status: result?.leftover.length ? 'Cần xử lý' : 'Không có cảnh báo', progress: result?.leftover.length ? 100 : 0, tone: result?.leftover.length ? 'coral' : 'amber' },
  ], [containerMode, containers, packedCount, placementCount, result, totalCount]);

  function stopPacking() {
    jobGeneration.current += 1;
    cancelJob.current?.();
    cancelJob.current = null;
    setComputing(false);
  }

  function invalidatePlan() {
    stopPacking();
    importGeneration.current += 1;
    revision.current += 1;
    setImporting(false);
    setPlacementOverrides({});
    setResult(null);
    setStep(0);
    setPlaying(false);
    setPlaybackTransition(null);
    setSelectedPlacementId(null);
    setMessage('Dữ liệu đã thay đổi. Chạy tối ưu để tạo phương án mới.');
  }

  function updateContainer(containerId: string, field: keyof ContainerInput, value: string) {
    invalidatePlan();
    setContainers((items) => items.map((container) => container.id === containerId
      ? { ...container, [field]: field === 'name' ? value : numberValue(value) }
      : container));
  }

  function updateCarton(cartonId: string, field: keyof CartonInput, value: string | boolean) {
    invalidatePlan();
    setCartons((items) => items.map((carton) => carton.id === cartonId
      ? { ...carton, [field]: typeof value === 'boolean' ? value : ['label', 'color'].includes(field) ? value : numberValue(value) }
      : carton));
  }

  function addContainer() {
    invalidatePlan();
    setContainers((items) => [...items, { ...defaultContainers[0], id: id('container'), name: `Container ${items.length + 1}` }]);
  }

  function addCarton() {
    invalidatePlan();
    setCartons((items) => [...items, { ...defaultCartons[0], id: id('carton'), label: `Hộp ${items.length + 1}`, color: '#a78bfa' }]);
  }

  function runPacking() {
    if (invalid || importing || !persistence.hydrated) return;
    stopPacking();
    const generation = ++jobGeneration.current;
    setComputing(true);
    setPlaying(false);
    setPlaybackTransition(null);
    setActiveSection('simulation');
    setMessage('Đang tính phương án xếp hàng… Bạn có thể hủy hoặc sửa dữ liệu để bắt đầu lại.');
    cancelJob.current = startPackingJob({ containers, cartons, containerMode, options: { allowRotation, strategy } }, {
      onSuccess(nextResult) {
        if (generation !== jobGeneration.current) return;
        const nextPacked = nextResult.results.reduce((sum, item) => sum + item.packed.length, 0);
        revision.current += 1;
        setComputing(false);
        setResult(nextResult);
        setPlacementOverrides({});
        setStep(nextPacked);
        setSelectedPlacementId(null);
        const selectedNames = summarizeSelectedContainers(nextResult.results);
        setMessage(`${containerMode === 'presets' ? 'Đã tự chọn' : 'Đã dùng'} ${selectedNames || 'chưa có container'} để xếp ${nextPacked} kiện${nextResult.leftover.length ? `, còn ${nextResult.leftover.length} kiện chưa xếp` : ', không còn kiện dư'}.`);
      },
      onError(error) {
        if (generation !== jobGeneration.current) return;
        setComputing(false);
        setMessage(`Không thể tính phương án: ${error.message}`);
      },
    });
  }

  function cancelPacking() {
    stopPacking();
    setMessage(result ? 'Đã hủy tính toán. Phương án trước vẫn được giữ nguyên.' : 'Đã hủy tính toán. Dữ liệu nhập vẫn được giữ nguyên.');
  }

  function updateContainerMode(mode: ContainerSelectionMode) {
    invalidatePlan();
    setContainerMode(mode);
    setMessage(mode === 'presets' ? 'Sẵn sàng tự chọn container mẫu theo lượng hàng.' : 'Sẵn sàng dùng container tự nhập.');
  }

  function updateStrategy(nextStrategy: PackingStrategy) {
    invalidatePlan();
    setStrategy(nextStrategy);
  }

  function updateAllowRotation(value: boolean) {
    invalidatePlan();
    setAllowRotation(value);
  }

  function resetWorkspace() {
    invalidatePlan();
    setContainers(defaultContainers);
    setCartons(defaultCartons);
    setContainerMode('presets');
    setAllowRotation(true);
    setStrategy('minContainers');
    setActiveTab('cargo');
    setActiveSection('workspace');
    setMessage('Đã đặt lại dữ liệu điều phối về trạng thái ban đầu.');
  }

  function removeCarton(cartonId: string) {
    if (cartons.length <= 1) return;
    invalidatePlan();
    setCartons((items) => items.filter((item) => item.id !== cartonId));
  }

  function removeContainer(containerId: string) {
    if (containers.length <= 1) return;
    invalidatePlan();
    setContainers((items) => items.filter((item) => item.id !== containerId));
  }

  function chooseImport(target: ImportTarget) {
    setImportTarget(target);
    importInputRef.current?.click();
  }

  async function importFile(file: File) {
    stopPacking();
    setPlaying(false);
    const generation = ++importGeneration.current;
    const target = importTarget;
    const mode = importMode;
    setImporting(true);
    setMessage(`Đang đọc ${file.name}…`);
    try {
      const rows = await readRowsFromFile(file, target);
      if (generation !== importGeneration.current) return;
      let message: string;
      if (target === 'cartons') {
        const parsed = parseCartonRows(rows);
        const imported = parsed.boxes.map((box, index) => ({ ...box, id: id('carton'), label: box.label?.trim() || `Kiện nhập ${index + 1}` }));
        if (!imported.length) throw new Error('Không tìm thấy kiện hàng hợp lệ trong tệp.');
        setCartons((items) => mode === 'append' ? [...items, ...imported] : imported);
        setActiveTab('cargo');
        setActiveSection('cargo');
        message = `Đã nhập ${imported.length} loại hàng, ${imported.reduce((sum, box) => sum + box.quantity, 0)} kiện${parsed.skipped ? `; bỏ qua ${parsed.skipped} dòng không hợp lệ` : ''}.`;
      } else {
        const parsed = parseContainerRows(rows);
        const imported = parsed.containers.map((container) => ({ ...container, id: id('container') }));
        if (!imported.length) throw new Error('Không tìm thấy container hợp lệ trong tệp.');
        setContainers((items) => mode === 'append' ? [...items, ...imported] : imported);
        setContainerMode('manual');
        setActiveTab('container');
        setActiveSection('container');
        message = `Đã nhập và chọn ${imported.reduce((sum, container) => sum + container.quantity, 0)} container${parsed.skipped ? `; bỏ qua ${parsed.skipped} dòng không hợp lệ` : ''}.`;
      }
      invalidatePlan();
      setMessage(message);
    } catch (error) {
      if (generation !== importGeneration.current) return;
      setMessage(error instanceof Error ? error.message : 'Không thể đọc tệp đã chọn.');
    } finally {
      if (generation === importGeneration.current) setImporting(false);
    }
  }

  async function exportWorkbook() {
    if (!presentationResult || invalid || computing || importing || exporting) return;
    const exportedRevision = revision.current;
    setExporting(true);
    try {
      await downloadPackingWorkbook(cartons, containers, presentationResult);
      if (exportedRevision === revision.current) setMessage('Đã xuất Excel theo phương án đang hiển thị, gồm các vị trí đã chỉnh tay.');
    } catch (error) {
      if (exportedRevision === revision.current) setMessage(error instanceof Error ? error.message : 'Không thể xuất tệp Excel. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  }

  function applyManualOverride(placementId: string, override: PlacementOverride) {
    // Non-finite positions cannot be represented in a saved/exported plan.
    if (!Object.values(override).every(Number.isFinite)) return;
    stopPacking();
    setPlaying(false);
    revision.current += 1;
    setPlacementOverrides((current) => ({ ...current, [placementId]: { ...override } }));
    setMessage('Đã áp dụng vị trí. Bảng kết quả và tệp Excel sẽ dùng phương án đang hiển thị.');
  }

  function restoreAutomaticLayout() {
    revision.current += 1;
    setPlacementOverrides({});
    setPlaying(false);
    setMessage('Đã khôi phục cách xếp tự động.');
  }
  return <ControlCenterShell
    kpis={kpis}
    onNavigate={navigate}
    activeSection={activeSection}
    commandBar={<CommandBar title="Bảng điều phối xếp hàng 3D" breadcrumb="Nhập hàng / Tối ưu / Kiểm tra & xuất" isSaved={persistence.status === 'saved'} saveMessage={saveMessage} onImport={() => navigate('import')} importDisabled={importing || !persistence.hydrated} onReset={resetWorkspace} onOptimize={runPacking} optimizeDisabled={invalid || importing || !persistence.hydrated} computing={computing} onCancel={cancelPacking}><button className="command-button" type="button" disabled={!result || invalid || computing || importing || exporting} onClick={exportWorkbook}><Download size={16} aria-hidden="true" />{exporting ? 'Đang xuất…' : 'Xuất XLSX'}</button></CommandBar>}
  >
    <input ref={importInputRef} className="visually-hidden" type="file" accept=".csv,.json,.xlsx,.xls" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ''; }} />
    <section className="packing-workspace" aria-label="Không gian xếp thùng">
      <nav className="workflow-stepper" aria-label="Quy trình xếp hàng">
        <button type="button" aria-current={currentStep === 1 ? 'step' : undefined} onClick={() => navigate('cargo')}><span className={!invalid ? 'complete' : 'current'}>1 Nhập hàng hóa</span></button><i />
        <button type="button" aria-current={currentStep === 2 ? 'step' : undefined} onClick={() => navigate('container')}><span className={currentStep === 2 ? 'current' : !invalid ? 'complete' : ''}>2 Thiết lập container</span></button><i />
        <button type="button" aria-current={currentStep === 3 ? 'step' : undefined} onClick={() => { changeTab('strategy'); document.getElementById('packing-inspector')?.scrollIntoView?.({ block: 'start' }); }}><span className={computing ? 'current' : result ? 'complete' : ''}>3 Tối ưu</span></button><i />
        <button type="button" disabled={!result} aria-current={currentStep === 4 ? 'step' : undefined} onClick={() => navigate('results')}><span className={result ? 'current' : ''}>4 Kiểm tra & xuất</span></button>
      </nav>
      {persistence.status === 'error' && <p className="workflow-notice warning" role="alert">Trình duyệt chưa lưu được phiên này. Giữ tab đang mở và xuất Excel để giữ kết quả.</p>}
      {adjustedCount > 0 && <div className="workflow-notice"><span>Phương án đã chỉnh {adjustedCount} vị trí. Excel sẽ xuất đúng tọa độ đang xem.</span><button type="button" className="command-button" onClick={restoreAutomaticLayout}>Khôi phục cách xếp tự động</button></div>}
      {layoutWarnings.length > 0 && <div className="workflow-notice warning" role="alert"><strong>Phương án chỉnh tay còn cảnh báo:</strong><ul>{layoutWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      <div className="work-grid">
        <section id="simulation" className="simulation-stage">
          <div className="stage-status" role="status" aria-live="polite" aria-atomic="true"><span className={computing || importing ? 'status-dot working' : result ? 'status-dot ready' : 'status-dot'} />{statusMessage}<span className="stage-context">{computing ? 'Đang tính toán' : result ? `${usedContainerCount} container đang hiển thị` : 'Chờ dữ liệu xếp hàng'}</span></div>
          <PackingViewer packedContainers={presentationResult?.results ?? []} leftovers={presentationResult?.leftover ?? []} selectedPlacementId={selectedPlacementId} onSelectPlacement={selectPlacement} onApplyPlacementOverride={applyManualOverride} step={step} playbackTransition={playbackTransition} playbackActive={playing} reducedMotion={reducedMotion} focusToken={focusToken} onRequestFocus={requestFocus} />
          {result && placementCount > 0 && <><ViewerPlayback step={step} total={placementCount} playing={playing} speed={speed} reducedMotion={reducedMotion} onStepChange={updatePlaybackStep} onPlayingChange={setPlaying} onSpeedChange={setSpeed} />{selectedPlacement && <p className="selected-detail">Đang chọn: <strong>{selectedPlacement.label}</strong> · vị trí ({selectedPlacement.x.toFixed(1)}, {selectedPlacement.y.toFixed(1)}, {selectedPlacement.z.toFixed(1)}) · {selectedPlacement.weight} kg</p>}</>}
        </section>
        <Inspector containers={containers} cartons={cartons} containerMode={containerMode} sampleContainers={sampleContainers} strategy={strategy} allowRotation={allowRotation} onAddCarton={addCarton} onAddContainer={addContainer} onContainerModeChange={updateContainerMode} onUpdateCarton={updateCarton} onUpdateContainer={updateContainer} onRemoveCarton={removeCarton} onRemoveContainer={removeContainer} onStrategyChange={updateStrategy} onAllowRotationChange={updateAllowRotation} onImportClick={chooseImport} activeTab={activeTab} onTabChange={changeTab} importMode={importMode} onImportModeChange={setImportMode} importing={importing} />
      </div>
      <section id="results" className="result-panel command-result-panel">
        <div className="panel-heading"><div><p className="section-kicker">KẾT QUẢ TỐI ƯU</p><h2>Phương án xếp hàng</h2></div><span className={result?.leftover.length ? 'telemetry-tag warning' : 'telemetry-tag'}>{result ? `${packedCount}/${totalCount} kiện` : 'CHỜ TÍNH TOÁN'}</span></div>
        {!result && <div className="empty-state">Thiết lập container, kiện hàng và chiến lược trong Inspector, sau đó chạy tối ưu để kích hoạt Digital Twin.</div>}
        {result && presentationResult && <><div className="result-summary-grid"><div>{result.results.filter((item) => item.packed.length > 0).map((item) => <article key={item.container.id} className="container-result"><h3>{item.container.name}</h3><p>{item.packed.length} kiện · {item.packed.reduce((sum, box) => sum + box.weight, 0).toFixed(1)} kg</p></article>)}</div>{result.leftover.length > 0 && <div className="leftover-list"><h3>Kiện chưa xếp</h3>{result.leftover.map((box, index) => <p key={`${box.id}-${index}`}><span>{box.label}</span><em>{reasonLabels[box.reason]}</em></p>)}</div>}</div><PackingResultTable result={presentationResult} selectedPlacementId={selectedPlacementId} onSelectPlacement={selectPlacement} onFocusPlacement={requestFocus} /></>}
      </section>
    </section>
  </ControlCenterShell>;
}
