'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { ContainerScene } from './container-scene';
import type { ContainerSceneProps } from './container-scene';
import type { ViewPreset } from './viewer-types';

export type ViewportLayout = 'single' | 'pip' | 'quad';

export type ViewerViewportsProps = {
  layout: ViewportLayout;
  mainPreset: ViewPreset;
  collapsedPip: ViewPreset[];
  sceneProps: Omit<ContainerSceneProps, 'preset'>;
  onMainPresetChange: (preset: ViewPreset) => void;
  onTogglePip: (preset: ViewPreset) => void;
};

const PRESETS: ViewPreset[] = ['iso', 'top', 'front', 'side'];
const PRESET_LABELS: Record<ViewPreset, string> = {
  iso: 'Isometric',
  top: 'Mặt trên',
  front: 'Mặt trước',
  side: 'Mặt bên',
};

function getPipPresets(mainPreset: ViewPreset, preferred: ViewPreset[] = ['top', 'front']) {
  const unique = [...new Set([...preferred, 'top', 'front', 'iso', 'side'] as ViewPreset[])];
  return unique.filter((preset) => preset !== mainPreset).slice(0, 2);
}

function useMobileViewports() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 639px)');
    if (!query) return;
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return mobile;
}

function Viewport({ preset, label, sceneProps, className = '', primary = false }: {
  preset: ViewPreset;
  label: string;
  sceneProps: Omit<ContainerSceneProps, 'preset'>;
  className?: string;
  primary?: boolean;
}) {
  return <section className={`packing-viewport ${className}`.trim()} aria-label={label}>
    <ContainerScene {...sceneProps} preset={preset} manualEditing={primary && sceneProps.manualEditing} />
  </section>;
}

export function ViewerViewports({ layout, mainPreset, collapsedPip, sceneProps, onMainPresetChange, onTogglePip }: ViewerViewportsProps) {
  const mobile = useMobileViewports();
  const [pipPresets, setPipPresets] = useState<ViewPreset[]>(() => getPipPresets(mainPreset));
  const previousMainPreset = useRef(mainPreset);
  const mobilePanelId = useId();
  const mobileTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const visiblePipPresets = getPipPresets(mainPreset, pipPresets);

  useEffect(() => {
    const previous = previousMainPreset.current;
    if (previous !== mainPreset) {
      setPipPresets((current) => getPipPresets(mainPreset, [...current.filter((preset) => preset !== mainPreset), previous]));
      previousMainPreset.current = mainPreset;
    }
  }, [mainPreset]);

  function activatePip(index: number) {
    const nextMain = visiblePipPresets[index];
    setPipPresets(visiblePipPresets.map((preset, currentIndex) => currentIndex === index ? mainPreset : preset));
    onMainPresetChange(nextMain);
  }

  function handleMobileTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % PRESETS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + PRESETS.length) % PRESETS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = PRESETS.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    onMainPresetChange(PRESETS[nextIndex]);
    mobileTabRefs.current[nextIndex]?.focus();
  }

  if (mobile) {
    return <div className="viewport-layout viewport-mobile">
      <div className="viewport-preset-tabs" role="tablist" aria-label="Góc nhìn camera">
        {PRESETS.map((preset, index) => {
          const selected = preset === mainPreset;
          const tabId = `${mobilePanelId}-${preset}-tab`;
          return <button
            key={preset}
            ref={(element) => { mobileTabRefs.current[index] = element; }}
            id={tabId}
            type="button"
            role="tab"
            aria-controls={mobilePanelId}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'active' : ''}
            onClick={() => onMainPresetChange(preset)}
            onKeyDown={(event) => handleMobileTabKeyDown(event, index)}
          >{PRESET_LABELS[preset]}</button>;
        })}
      </div>
      <div id={mobilePanelId} role="tabpanel" aria-labelledby={`${mobilePanelId}-${mainPreset}-tab`} tabIndex={0}>
        <Viewport preset={mainPreset} label={`${PRESET_LABELS[mainPreset]} viewport`} sceneProps={sceneProps} primary />
      </div>
    </div>;
  }

  if (layout === 'single') {
    return <div className="viewport-layout viewport-single">
      <Viewport preset={mainPreset} label={`${PRESET_LABELS[mainPreset]} viewport`} sceneProps={sceneProps} primary />
    </div>;
  }

  if (layout === 'quad') {
    return <div className="viewport-layout viewport-quad">
      {PRESETS.map((preset) => <Viewport key={preset} preset={preset} label={`${PRESET_LABELS[preset]} viewport`} sceneProps={{ ...sceneProps, showLabels: preset === mainPreset }} primary={preset === mainPreset} />)}
    </div>;
  }

  return <div className="viewport-layout viewport-pip">
    <Viewport preset={mainPreset} label={`${PRESET_LABELS[mainPreset]} viewport chính`} sceneProps={sceneProps} className="viewport-main" primary />
    <div className="pip-stack">
      {visiblePipPresets.map((preset, index) => collapsedPip.includes(preset)
        ? <button key={`${preset}-${index}`} type="button" className="pip-restore" onClick={() => onTogglePip(preset)}>Mở {PRESET_LABELS[preset]} PIP</button>
        : <section key={`${preset}-${index}`} className="packing-viewport viewport-pip-panel" aria-label={`${PRESET_LABELS[preset]} viewport PIP`}>
            <div className="pip-actions">
              <button type="button" onClick={() => activatePip(index)}>Dùng {PRESET_LABELS[preset]} làm khung chính</button>
              <button type="button" aria-label={`Thu gọn ${PRESET_LABELS[preset]}`} onClick={() => onTogglePip(preset)}>−</button>
            </div>
            <ContainerScene {...sceneProps} preset={preset} showLabels={false} manualEditing={false} />
          </section>)}
    </div>
  </div>;
}
