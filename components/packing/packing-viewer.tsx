'use client';

import { ContactShadows, Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo, useState } from 'react';

import type { PackedContainer, Placement } from '@/lib/packing/types';

type ViewerProps = {
  packedContainers: PackedContainer[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
  step: number;
};

export function placementKey(containerId: string, placement: Placement) {
  return `${containerId}:${placement.order}`;
}

function Scene({ container, placements, selectedPlacementId, onSelectPlacement }: {
  container: PackedContainer;
  placements: Placement[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
}) {
  const { width, height, length } = container.container;

  return (
    <Canvas camera={{ position: [width * 1.4, height * 1.1 + 2, length * 1.4], fov: 44 }} shadows dpr={[1, 2]}>
      <color attach="background" args={['#071221']} />
      <ambientLight intensity={0.72} />
      <directionalLight castShadow intensity={2.2} position={[width * 1.5, height * 2 + 3, length]} shadow-mapSize={[2048, 2048]} />
      <Grid args={[Math.max(width, length) * 3, 30]} cellColor="#1b385b" sectionColor="#31597e" position={[0, -0.02, 0]} />
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.max(width, length) * 4, Math.max(width, length) * 4]} />
        <meshStandardMaterial color="#0a1728" roughness={0.92} />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, length]} />
        <meshBasicMaterial color="#74c7ec" transparent opacity={0.12} wireframe />
      </mesh>
      {placements.map((placement) => {
        const selected = selectedPlacementId === placementKey(container.container.id, placement);
        return (
          <mesh
            castShadow
            key={placementKey(container.container.id, placement)}
            position={[
              placement.x + placement.width / 2 - width / 2,
              placement.y + placement.height / 2,
              placement.z + placement.length / 2 - length / 2,
            ]}
            onClick={(event) => { event.stopPropagation(); onSelectPlacement(placementKey(container.container.id, placement)); }}
          >
            <boxGeometry args={[placement.width, placement.height, placement.length]} />
            <meshStandardMaterial color={placement.color || '#36c5f0'} roughness={0.42} metalness={0.04} emissive={selected ? '#6ee7ff' : '#000000'} emissiveIntensity={selected ? 0.42 : 0} />
          </mesh>
        );
      })}
      <ContactShadows position={[0, 0, 0]} opacity={0.38} scale={Math.max(width, length) * 2.5} blur={2.4} far={height + 6} />
      <OrbitControls makeDefault minDistance={Math.max(width, length) * 0.75} maxDistance={Math.max(width, length) * 7} target={[0, height * 0.35, 0]} />
    </Canvas>
  );
}

function PlanView({ container, placements, selectedPlacementId, onSelectPlacement }: {
  container: PackedContainer;
  placements: Placement[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
}) {
  const { width, length } = container.container;

  return (
    <div className="plan-view" aria-label="Sơ đồ xếp 2D">
      <div className="plan-grid" style={{ aspectRatio: `${width} / ${length}` }}>
        {placements.map((placement) => {
          const key = placementKey(container.container.id, placement);
          return <button
            type="button"
            aria-label={`Kiện ${placement.label}, thứ tự ${placement.order}`}
            className={selectedPlacementId === key ? 'plan-box selected' : 'plan-box'}
            key={key}
            onClick={() => onSelectPlacement(key)}
            style={{
              left: `${(placement.x / width) * 100}%`,
              top: `${(placement.z / length) * 100}%`,
              width: `${(placement.width / width) * 100}%`,
              height: `${(placement.length / length) * 100}%`,
              background: placement.color || '#36c5f0',
            }}
          >{placement.order}</button>;
        })}
      </div>
      <p>Nhấn vào kiện để xem thông tin. Mặt bằng hiển thị trục dài × rộng.</p>
    </div>
  );
}

export function PackingViewer({ packedContainers, selectedPlacementId, onSelectPlacement, step }: ViewerProps) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [activeId, setActiveId] = useState<string | null>(null);
  const supportsWebgl = useMemo(() => typeof window !== 'undefined' && 'WebGLRenderingContext' in window, []);
  const usedContainers = packedContainers.filter((item) => item.packed.length > 0);
  const active = usedContainers.find((item) => item.container.id === activeId) ?? usedContainers[0];
  const visiblePlacements = active ? active.packed.slice(0, Math.max(0, step)) : [];

  return (
    <section className="viewer-panel" aria-label="Trình xem xếp thùng">
      <div className="viewer-toolbar">
        <div><p className="section-kicker">KHÔNG GIAN XẾP</p><h2>{active?.container.name ?? 'Chưa có phương án'}</h2></div>
        <div className="view-toggle" role="group" aria-label="Chế độ xem">
          <button type="button" className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>Phối cảnh 3D</button>
          <button type="button" className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}>Mặt bằng 2D</button>
        </div>
      </div>
      {usedContainers.length > 1 && <div className="container-tabs">{usedContainers.map((item) => <button className={item.container.id === active?.container.id ? 'active' : ''} type="button" key={item.container.id} onClick={() => setActiveId(item.container.id)}>{item.container.name}</button>)}</div>}
      {!active && mode === '3d' && <div className="viewer-empty">Xếp hàng để mở mô hình container 3D.</div>}
      {!active && mode === '2d' && <div className="plan-view viewer-empty" aria-label="Sơ đồ xếp 2D">Chưa có kiện nào để hiển thị trên mặt bằng.</div>}
      {active && mode === '2d' && <PlanView container={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} onSelectPlacement={onSelectPlacement} />}
      {active && mode === '3d' && supportsWebgl && <div className="scene-canvas"><Scene container={active} placements={visiblePlacements} selectedPlacementId={selectedPlacementId} onSelectPlacement={onSelectPlacement} /></div>}
      {active && mode === '3d' && !supportsWebgl && <div className="viewer-empty">Thiết bị này chưa hỗ trợ WebGL. Hãy dùng “Mặt bằng 2D” để xem phương án xếp.</div>}
    </section>
  );
}
