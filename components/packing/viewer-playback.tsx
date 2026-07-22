'use client';

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect } from 'react';

import type { PlaybackTransitionSource } from './viewer-types';

export const PLAYBACK_MS = 650;

export type ViewerPlaybackProps = {
  step: number;
  total: number;
  playing: boolean;
  speed: .5 | 1 | 2;
  reducedMotion?: boolean;
  onStepChange: (step: number, source: PlaybackTransitionSource) => void;
  onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: .5 | 1 | 2) => void;
};

function clamp(value: number, total: number) {
  return Math.min(Math.max(0, value), Math.max(0, total));
}

export function ViewerPlayback({ step, total, playing, speed, reducedMotion = false, onStepChange, onPlayingChange, onSpeedChange }: ViewerPlaybackProps) {
  const clampedStep = clamp(step, total);
  const atEnd = clampedStep >= total;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      onPlayingChange(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const nextStep = clamp(clampedStep + 1, total);
      onStepChange(nextStep, 'playback');
      if (nextStep >= total) onPlayingChange(false);
    }, PLAYBACK_MS / speed);

    return () => window.clearTimeout(timer);
  }, [atEnd, clampedStep, onPlayingChange, onStepChange, playing, speed, total]);

  function togglePlayback() {
    if (atEnd) {
      onStepChange(0, 'manual');
      onPlayingChange(true);
      return;
    }
    onPlayingChange(!playing);
  }

  const playbackLabel = playing ? 'Tạm dừng' : atEnd ? 'Phát lại' : 'Phát';

  return <section className="playback-panel" aria-label="Trình tự xếp hàng" data-reduced-motion={reducedMotion || undefined}>
    <div><p className="section-kicker">PLAYBACK</p><strong aria-live="polite" aria-atomic="true">Bước {clampedStep}/{total}</strong></div>
    <div className="playback-controls">
      <button type="button" aria-label="Trước" onClick={() => onStepChange(clamp(clampedStep - 1, total), 'manual')}><SkipBack size={16} aria-hidden="true" />Trước</button>
      <button type="button" aria-label={playbackLabel} onClick={togglePlayback}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playbackLabel}</button>
      <button type="button" aria-label="Tiếp" onClick={() => onStepChange(clamp(clampedStep + 1, total), 'manual')}><SkipForward size={16} aria-hidden="true" />Tiếp</button>
      <input aria-label="Tiến trình xếp hàng" type="range" min="0" max={total} value={clampedStep} onChange={(event) => onStepChange(clamp(Number(event.target.value), total), 'manual')} />
      {([.5, 1, 2] as const).map((value) => <button key={value} type="button" aria-label={`Tốc độ ${value}×`} aria-pressed={speed === value} className={speed === value ? 'active' : ''} onClick={() => onSpeedChange(value)}>{value}×</button>)}
    </div>
  </section>;
}
