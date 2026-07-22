'use client';

import { ContactShadows, Edges, Grid, Html, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Box, Crosshair, Expand, Map, Rotate3D, ScanLine, Tags } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { PackedContainer, Placement } from '@/lib/packing/types';

type CameraPreset = 'perspective' | 'side' | 'front';
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

  return { count, fillPercentage: containerVolume ? (packedVolume / containerVolume) * 100 : 0, floorOnlyCount: container.packed.filter((placement) => !placement.stackable).length };
}

function getCargoFocus(container: PackedContainer, placements: Placement[]) {
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

  return { target, span: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1) };
}

function CameraRig({ preset, focus }: { preset: CameraPreset; focus: ReturnType<typeof getCargoFocus> }) {
  const { camera } = useThree();
  useEffect(() => {
    const distance = focus.span * 1.7 + 1.5;
    const [targetX, targetY, targetZ] = focus.target;
    const position: [number, number, number] = preset === 'side' ? [targetX + distance, targetY + focus.span * .3, targetZ] : preset === 'front' ? [targetX, targetY + focus.span * .28, targetZ + distance] : [targetX + distance, targetY + focus.span * .78 + .8, targetZ + distance];
    camera.position.set(...position);
    camera.lookAt(...focus.target);
    camera.updateProjectionMatrix();
  }, [camera, focus, preset]);
  return null;
}

function Scene({ container, placements, selectedPlacementId, onSelectPlacement, cameraPreset, showLabels, wireframe }: {
  container: PackedContainer;
  placements: Placement[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
  cameraPreset: CameraPreset;
  showLabels: boolean;
  wireframe: boolean;
}) {
  const { width, height, length } = container.container;
  const cargoFocus = getCargoFocus(container, placements);

  return <Canvas camera={{ position: [width * 1.4, height * 1.1 + 2, length * 1.4], fov: 44 }} shadows dpr={[1, 2]}>
    <color attach="background" args={['#07131F']} />
    <CameraRig preset={cameraPreset} focus={cargoFocus} />
    <ambientLight intensity={0.72} />
    <directionalLight castShadow intensity={2.2} position={[width * 1.5, height * 2 + 3, length]} shadow-mapSize={[2048, 2048]} />
    <Grid args={[Math.max(width, length) * 1.7, Math.max(10, Math.ceil(Math.max(width, length) * 4))]} cellColor="#183857" sectionColor="#2b6380" position={[0, -0.02, 0]} />
    <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[Math.max(width, length) * 4, Math.max(width, length) * 4]} />
      <meshStandardMaterial color="#081725" roughness={0.92} />
    </mesh>
    <group>
      <mesh position={[0, -.04, 0]} receiveShadow><boxGeometry args={[width, .08, length]} /><meshStandardMaterial color="#123b55" transparent opacity={.72} roughness={.86} /></mesh>
      <mesh position={[-width / 2, height / 2, 0]}><boxGeometry args={[.05, height, length]} /><meshStandardMaterial color="#164764" transparent opacity={.19} /></mesh>
      <mesh position={[width / 2, height / 2, 0]}><boxGeometry args={[.05, height, length]} /><meshStandardMaterial color="#164764" transparent opacity={.19} /></mesh>
      <mesh position={[0, height / 2, length / 2]}><boxGeometry args={[width, height, .05]} /><meshStandardMaterial color="#164764" transparent opacity={.24} /></mesh>
      <mesh position={[0, height / 2, 0]}><boxGeometry args={[width, height, length]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /><Edges color="#67e8f9" transparent opacity={.38} /></mesh>
    </group>
    {placements.map((placement) => {
      const key = placementKey(container.container.id, placement);
      const selected = selectedPlacementId === key;
      const position: [number, number, number] = [
        placement.x + placement.width / 2 - width / 2,
        placement.y + placement.height / 2,
        placement.z + placement.length / 2 - length / 2,
      ];
      return <group key={key} position={position}>
        <mesh castShadow onClick={(event) => { event.stopPropagation(); onSelectPlacement(key); }}>
          <boxGeometry args={[placement.width, placement.height, placement.length]} />
          <meshStandardMaterial color={placement.color || '#22D3EE'} roughness={0.42} metalness={0.04} wireframe={wireframe} emissive={selected ? '#6ee7ff' : '#000000'} emissiveIntensity={selected ? .45 : 0} />
        </mesh>
        {showLabels && <Html center distanceFactor={8}><span className={selected ? 'scene-label selected' : 'scene-label'}>{placement.order}</span></Html>}
        {!placement.stackable && <Html position={[0, placement.height / 2 + .22, 0]} center distanceFactor={8}><span className="scene-floor-only">SÀN</span></Html>}
      </group>;
    })}
    <ContactShadows position={[0, 0, 0]} opacity={0.38} scale={Math.max(width, length) * 2.5} blur={2.4} far={height + 6} />
    <OrbitControls makeDefault minDistance={cargoFocus.span * .85} maxDistance={cargoFocus.span * 8 + 4} target={cargoFocus.target} />
  </Canvas>;
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
        return <button type="button" aria-label={`Kiện ${placement.label}, thứ tự ${placement.order}${!placement.stackable ? ', không chồng — nằm sàn' : ''}`} className={selectedPlacementId === key ? 'plan-box selected' : 'plan-box'} key={key} onClick={() => onSelectPlacement(key)} style={{ left: `${(placement.x / width) * 100}%`, top: `${(placement.z / length) * 100}%`, width: `${(placement.width / width) * 100}%`, height: `${(placement.length / length) * 100}%`, background: placement.color || '#22D3EE' }}>{placement.order}</button>;
      })}
    </div>
    <p>Nhấn vào kiện để xem thông tin. Mặt bằng hiển thị theo trục dài × rộng.</p>
  </div>;
}

export function PackingViewer({ packedContainers, selectedPlacementId, onSelectPlacement, step }: ViewerProps) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('perspective');
  const [showLabels, setShowLabels] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);
  const supportsWebgl = useMemo(() => typeof window !== 'undefined' && 'WebGLRenderingContext' in window, []);
  const usedContainers = packedContainers.filter((item) => item.packed.length > 0);
  const active = usedContainers.find((item) => item.container.id === activeId) ?? usedContainers[0];
  const visiblePlacements = active ? active.packed.slice(0, Math.max(0, step)) : [];
  const insights = active ? getPackingInsights(active) : null;

  function enterFullscreen() {
    void viewerRef.current?.requestFullscreen?.();
  }

  return <section className="viewer-panel" aria-label="Trình xem xếp thùng" ref={viewerRef}>
    <div className="viewer-toolbar"><div><p className="section-kicker">KHÔNG GIAN XẾP</p><h2>{active?.container.name ?? 'Chưa có phương án'}</h2>{insights && <div className="viewer-metrics"><span>{insights.count} kiện</span><span>Lấp đầy {insights.fillPercentage.toFixed(1)}%</span>{insights.floorOnlyCount > 0 && <span className="floor-only-metric">{insights.floorOnlyCount} kiện nằm sàn</span>}</div>}</div><div className="view-toggle" role="group" aria-label="Chế độ xem"><button type="button" className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}><Box size={15} aria-hidden="true" />3D</button><button type="button" className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}><Map size={15} aria-hidden="true" />Mặt bằng</button></div></div>
    <div className="simulation-toolbar" role="toolbar" aria-label="Điều khiển mô phỏng"><button type="button" aria-label="Góc phối cảnh" className={cameraPreset === 'perspective' ? 'active' : ''} onClick={() => { setMode('3d'); setCameraPreset('perspective'); }}><Rotate3D size={15} />Phối cảnh</button><button type="button" aria-label="Góc nhìn mặt bên" className={cameraPreset === 'side' ? 'active' : ''} onClick={() => { setMode('3d'); setCameraPreset('side'); }}><ScanLine size={15} />Mặt bên</button><button type="button" aria-label="Góc nhìn mặt trước" className={cameraPreset === 'front' ? 'active' : ''} onClick={() => { setMode('3d'); setCameraPreset('front'); }}><Crosshair size={15} />Mặt trước</button><button type="button" aria-label="Bật hoặc tắt nhãn kiện" className={showLabels ? 'active' : ''} onClick={() => setShowLabels((value) => !value)}><Tags size={15} />Nhãn</button><button type="button" aria-label="Bật hoặc tắt wireframe" className={wireframe ? 'active' : ''} onClick={() => setWireframe((value) => !value)}><Box size={15} />Wireframe</button><button type="button" aria-label="Mở toàn màn hình" onClick={enterFullscreen}><Expand size={15} />Toàn màn hình</button></div>
    {usedContainers.length > 1 && <div className="container-tabs">{usedContainers.map((item) => <button className={item.container.id === active?.container.id ? 'active' : ''} type="button" key={item.container.id} onClick={() => setActiveId(item.container.id)}>{item.container.name}</button>)}</div>}
    {!active && mode === '3d' && <div className="viewer-empty">Xếp hàng để mở mô hình container 3D.</div>}
    {!active && mode === '2d' && <div className="plan-view viewer-empty" aria-label="Sơ đồ xếp 2D">Chưa có kiện nào để hiển thị trên mặt bằng.</div>}
    {active && mode === '2d' && <PlanView container={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} onSelectPlacement={onSelectPlacement} />}
    {active && mode === '3d' && supportsWebgl && <div className="scene-canvas"><Scene container={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} onSelectPlacement={onSelectPlacement} cameraPreset={cameraPreset} showLabels={showLabels} wireframe={wireframe} /></div>}
    {active && mode === '3d' && !supportsWebgl && <div className="viewer-empty">Thiết bị này chưa hỗ trợ WebGL. Hãy dùng “Mặt bằng” để xem phương án xếp.</div>}
  </section>;
}
