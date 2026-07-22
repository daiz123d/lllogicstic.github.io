import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ViewerPlayback } from '@/components/packing/viewer-playback';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ViewerPlayback', () => {
  it('plays, pauses and changes speed without exceeding the placement count', () => {
    vi.useFakeTimers();
    const onStep = vi.fn();
    const onPlaying = vi.fn();
    const onSpeed = vi.fn();

    render(<ViewerPlayback step={0} total={2} playing={false} speed={1} onStepChange={onStep} onPlayingChange={onPlaying} onSpeedChange={onSpeed} />);

    fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
    expect(onPlaying).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tốc độ 2×' }));
    expect(onSpeed).toHaveBeenCalledWith(2);
    expect(screen.getByText('Bước 0/2')).toBeInTheDocument();
  });

  it('schedules one clamped next step at the selected speed and cleans up when paused', () => {
    vi.useFakeTimers();
    const onStep = vi.fn();
    const onPlaying = vi.fn();
    const onSpeed = vi.fn();
    const props = { step: 1, total: 2, speed: 2, onStepChange: onStep, onPlayingChange: onPlaying, onSpeedChange: onSpeed };
    const { rerender } = render(<ViewerPlayback {...props} playing />);

    vi.advanceTimersByTime(324);
    expect(onStep).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStep).toHaveBeenCalledWith(2, 'playback');
    expect(onPlaying).toHaveBeenCalledWith(false);

    rerender(<ViewerPlayback {...props} playing={false} />);
    vi.advanceTimersByTime(650);
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('clamps previous, next and slider changes to the placement range', () => {
    const onStep = vi.fn();

    render(<ViewerPlayback step={0} total={2} playing={false} speed={1} onStepChange={onStep} onPlayingChange={() => {}} onSpeedChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Tiến trình xếp hàng' }), { target: { value: '9' } });

    expect(onStep).toHaveBeenNthCalledWith(1, 0, 'manual');
    expect(onStep).toHaveBeenNthCalledWith(2, 1, 'manual');
    expect(onStep).toHaveBeenNthCalledWith(3, 2, 'manual');
  });

  it('announces only the changing playback step politely', () => {
    render(<ViewerPlayback step={1} total={2} playing={false} speed={1} onStepChange={() => {}} onPlayingChange={() => {}} onSpeedChange={() => {}} />);

    expect(screen.getByText('Bước 1/2')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Bước 1/2')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('region', { name: 'Trình tự xếp hàng' })).not.toHaveAttribute('aria-live');
  });
});
