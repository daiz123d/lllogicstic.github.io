import { AlertTriangle, Boxes, CheckCircle2, Container, type LucideIcon } from 'lucide-react';

export type KpiMetric = {
  id: string;
  label: string;
  value: number;
  status: string;
  progress: number;
  tone: 'cyan' | 'teal' | 'amber' | 'coral';
};

const icons: Record<string, LucideIcon> = { containers: Container, cartons: Boxes, packed: CheckCircle2, leftover: AlertTriangle };

export function KpiStrip({ metrics }: { metrics: KpiMetric[] }) {
  return <section className="kpi-strip" aria-label="Chỉ số điều hành">
    {metrics.map((metric) => {
      const Icon = icons[metric.id] ?? Boxes;
      return <article className={`kpi-metric tone-${metric.tone}`} key={metric.id}>
        <div className="kpi-icon"><Icon size={18} aria-hidden="true" /></div>
        <div className="kpi-copy"><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.status}</small></div>
        <div className="kpi-rail" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, metric.progress))}%` }} /></div>
      </article>;
    })}
  </section>;
}
