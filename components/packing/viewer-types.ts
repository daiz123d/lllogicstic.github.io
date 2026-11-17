export type ViewPreset = 'iso' | 'top' | 'front' | 'side';
export type RenderMode = 'solid' | 'xray' | 'wireframe' | 'weight' | 'height' | 'space' | 'exploded';
export type ShellVisibility = { all: boolean; left: boolean; right: boolean; roof: boolean; front: boolean };
export type CameraFrame = { target: [number, number, number]; position: [number, number, number]; zoom: number; coverage: .75; elevation: 32 };
export type ViewerMetrics = { usedVolume: number; volumePercent: number; usedWeight: number; maxWeight: number; weightPercent: number; packed: number; total: number; floorOnly: number };
export type EmptyRegion = { id: string; x: number; y: number; z: number; width: number; height: number; length: number };
export type PlacementOverride = { x: number; y: number; z: number; width: number; height: number; length: number };
export type PlaybackTransitionSource = 'playback' | 'manual';
export type PlaybackTransitionDescriptor = {
  source: PlaybackTransitionSource;
  fromStep: number;
  toStep: number;
  ownerContainerId: string | null;
  nonce: number;
  issuedAt: number;
};
