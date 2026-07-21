'use client';

import { useState, type ReactNode } from 'react';

import type { KpiMetric } from './kpi-strip';
import { KpiStrip } from './kpi-strip';
import { Sidebar } from './sidebar';

type ControlCenterShellProps = { commandBar: ReactNode; kpis: KpiMetric[]; children: ReactNode };

export function ControlCenterShell({ commandBar, kpis, children }: ControlCenterShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return <div className={collapsed ? 'control-center-shell sidebar-collapsed' : 'control-center-shell'}>
    <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
    <div className="control-main">
      {commandBar}
      <KpiStrip metrics={kpis} />
      <main id="workspace" className="control-workspace">{children}</main>
    </div>
  </div>;
}
