'use client';

import { ContactShadows, Edges, Html, OrbitControls, OrthographicCamera, TransformControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import type { PackedContainer, Placement } from '@/lib/packing/types';

import { getCameraFrame } from './viewer-model';
import type { RenderMode, ShellVisibility, ViewPreset } from './viewer-types';

export type ContainerSceneProps = {
  packedContainer: PackedContainer;
  placements: Placement[];
  selectedPlacementId: string | null;
  hoveredPlacementId: string | null;
  preset: ViewPreset;
  mode: RenderMode;
  shell: ShellVisibility;
  focusToken: string;
  showLabels?: boolean;
  onSelectPlacement: (key: string) => void;
  onHoverPlacement: (key: string | null) => void;
  onRequestFocus: (key: string) => void;
};

type CameraControllerProps = Pick<ContainerSceneProps, 'preset' | 'focusToken' | 'placements' | 'packedContainer'> & {
  controls: React.RefObject<OrbitControlsImpl | null>;
};

function placementKey(containerId: string, placement: Placement) {
  return `${containerId}:${placement.order}`;
}

function CameraController({ preset, focusToken, packedContainer, placements, controls }: CameraControllerProps) {
  const { camera, size } = useThree();
  const { width, height, length } = packedContainer.container;

  useEffect(() => {
    const frame = getCameraFrame({ width, height, length }, preset, size.width, size.height);
    const focusedPlacement = focusToken.startsWith('placement:')
      ? placements.find((placement) => placementKey(packedContainer.container.id, placement) === focusToken.slice('placement:'.length))
      : undefined;
    const target: [number, number, number] = focusedPlacement
      ? [
          focusedPlacement.x + focusedPlacement.width / 2 - width / 2,
          focusedPlacement.y + focusedPlacement.height / 2,
          focusedPlacement.z + focusedPlacement.length / 2 - length / 2,
        ]
      : [frame.target[0] - width / 2, frame.target[1], frame.target[2] - length / 2];
    const containerTarget: [number, number, number] = [frame.target[0] - width / 2, frame.target[1], frame.target[2] - length / 2];
    const position: [number, number, number] = [
      target[0] + frame.position[0] - width / 2 - containerTarget[0],
      target[1] + frame.position[1] - containerTarget[1],
      target[2] + frame.position[2] - length / 2 - containerTarget[2],
    ];

    camera.position.set(...position);
    camera.zoom = focusedPlacement ? frame.zoom * 1.12 : frame.zoom;
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
    controls.current?.target.set(...target);
    controls.current?.update();
  }, [preset, focusToken, width, height, length, placements.length, size.width, size.height]);

  return null;
}

function Shell({ packedContainer, shell }: Pick<ContainerSceneProps, 'packedContainer' | 'shell'>) {
  const { width, height, length } = packedContainer.container;
  const visible = (layer: keyof ShellVisibility) => shell.all && shell[layer];

  return <group>
    {shell.all && <mesh position={[0, -.04, 0]} receiveShadow>
      <boxGeometry args={[width, .08, length]} />
      <meshStandardMaterial color="#123b55" roughness={.9} />
    </mesh>}
    {shell.all && <mesh position={[0, height / 2, -length / 2]}>
      <boxGeometry args={[width, height, .05]} />
      <meshStandardMaterial color="#164764" transparent opacity={.42} roughness={.88} />
    </mesh>}
    {visible('left') && <mesh position={[-width / 2, height / 2, 0]}>
      <boxGeometry args={[.05, height, length]} />
      <meshStandardMaterial color="#164764" transparent opacity={.15} roughness={.88} />
    </mesh>}
    {visible('right') && <mesh position={[width / 2, height / 2, 0]}>
      <boxGeometry args={[.05, height, length]} />
      <meshStandardMaterial color="#164764" transparent opacity={.15} roughness={.88} />
    </mesh>}
    {visible('roof') && <mesh position={[0, height, 0]}>
      <boxGeometry args={[width, .05, length]} />
      <meshStandardMaterial color="#164764" transparent opacity={.10} roughness={.88} />
    </mesh>}
    {visible('front') && <mesh position={[0, height / 2, length / 2]}>
      <boxGeometry args={[width, height, .05]} />
      <meshStandardMaterial color="#164764" transparent opacity={.15} roughness={.88} />
    </mesh>}
    {shell.all && <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, length]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#67e8f9" transparent opacity={.38} />
    </mesh>}
  </group>;
}

function Cargo({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, mode, showLabels, onSelectPlacement, onHoverPlacement, onRequestFocus }: Omit<ContainerSceneProps, 'preset' | 'shell' | 'focusToken'>) {
  const { width, length } = packedContainer.container;
  const xray = mode === 'xray';
  const wireframe = mode === 'wireframe';

  return <group>
    {placements.map((placement) => {
      const key = placementKey(packedContainer.container.id, placement);
      const selected = selectedPlacementId === key;
      const hovered = hoveredPlacementId === key;
      const position: [number, number, number] = [
        placement.x + placement.width / 2 - width / 2,
        placement.y + placement.height / 2,
        placement.z + placement.length / 2 - length / 2,
      ];

      return <group key={key} position={position}>
        <mesh
          castShadow
          receiveShadow
          onClick={(event) => { event.stopPropagation(); onSelectPlacement(key); }}
          onDoubleClick={(event) => { event.stopPropagation(); onSelectPlacement(key); onRequestFocus(key); }}
          onPointerOver={(event) => { event.stopPropagation(); onHoverPlacement(key); }}
          onPointerOut={() => onHoverPlacement(null)}
        >
          <boxGeometry args={[placement.width, placement.height, placement.length]} />
          <meshStandardMaterial
            color={placement.color || '#22d3ee'}
            roughness={.52}
            metalness={0}
            transparent={xray}
            opacity={xray ? .48 : 1}
            wireframe={wireframe}
            emissive={selected ? '#f59e0b' : hovered ? '#67e8f9' : '#000000'}
            emissiveIntensity={selected ? .35 : hovered ? .16 : 0}
          />
          <Edges color={selected ? '#fbbf24' : hovered ? '#a5f3fc' : '#164e63'} lineWidth={1} />
        </mesh>
        {showLabels && <Html center distanceFactor={8}><span className={selected ? 'scene-label selected' : 'scene-label'}>{placement.order}</span></Html>}
        {!placement.stackable && <Html position={[0, placement.height / 2 + .22, 0]} center distanceFactor={8}><span className="scene-floor-only">SÀN</span></Html>}
      </group>;
    })}
  </group>;
}

export function ContainerScene({ packedContainer, placements, selectedPlacementId, hoveredPlacementId, preset, mode, shell, focusToken, showLabels = true, onSelectPlacement, onHoverPlacement, onRequestFocus }: ContainerSceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { width, height, length } = packedContainer.container;

  return <div className="scene-canvas" onContextMenu={(event) => event.preventDefault()}>
    <Canvas shadows dpr={[1, 2]}>
      <color attach="background" args={['#07131f']} />
      <OrthographicCamera makeDefault />
      <CameraController preset={preset} focusToken={focusToken} packedContainer={packedContainer} placements={placements} controls={controls} />
      <hemisphereLight intensity={1.1} color="#d9f7ff" groundColor="#10283d" />
      <directionalLight castShadow intensity={1.8} position={[width, height * 2 + 3, length]} />
      <Shell packedContainer={packedContainer} shell={shell} />
      <Cargo
        packedContainer={packedContainer}
        placements={placements}
        selectedPlacementId={selectedPlacementId}
        hoveredPlacementId={hoveredPlacementId}
        mode={mode}
        showLabels={showLabels}
        onSelectPlacement={onSelectPlacement}
        onHoverPlacement={onHoverPlacement}
        onRequestFocus={onRequestFocus}
      />
      <ContactShadows position={[0, 0, 0]} opacity={.38} scale={Math.max(width, length) * 2.5} blur={2.4} far={height + 6} />
      <OrbitControls ref={controls} makeDefault enablePan />
      <TransformControls enabled={false} />
    </Canvas>
  </div>;
}
