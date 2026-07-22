'use client';

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect } from 'react';

export const PLAYBACK_MS = 650;

export type ViewerPlaybackProps = {
  step: number;
  total: number;
  playing: boolean;
  speed: .5 | 1 | 2;
  reducedMotion?: boolean;
  onStepChange: (step: number) => void;
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
      onStepChange(nextStep);
      if (nextStep >= total) onPlayingChange(false);
    }, PLAYBACK_MS / speed);

    return () => window.clearTimeout(timer);
  }, [atEnd, clampedStep, onPlayingChange, onStepChange, playing, speed, total]);

  function togglePlayback() {
    onPlayingChange(atEnd ? false : !playing);
  }

  return <section className="playback-panel" aria-label="Trình tự xếp hàng" data-reduced-motion={reducedMotion || undefined}>
    <div><p className="section-kicker">PLAYBACK</p><strong>Bước {clampedStep}/{total}</strong></div>
    <div className="playback-controls">
      <button type="button" aria-label="Trước" onClick={() => onStepChange(clamp(clampedStep - 1, total))}><SkipBack size={16} aria-hidden="true" />Trước</button>
      <button type="button" aria-label={playing ? 'Tạm dừng' : 'Phát'} onClick={togglePlayback} disabled={atEnd && !playing}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? 'Tạm dừng' : 'Phát'}</button>
      <button type="button" aria-label="Tiếp" onClick={() => onStepChange(clamp(clampedStep + 1, total))}><SkipForward size={16} aria-hidden="true" />Tiếp</button>
      <input aria-label="Tiến trình xếp hàng" type="range" min="0" max={total} value={clampedStep} onChange={(event) => onStepChange(clamp(Number(event.target.value), total))} />
      {([.5, 1, 2] as const).map((value) => <button key={value} type="button" aria-label={`Tốc độ ${value}×`} aria-pressed={speed === value} className={speed === value ? 'active' : ''} onClick={() => onSpeedChange(value)}>{value}×</button>)}
    </div>
  </section>;
}
