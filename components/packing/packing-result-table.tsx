'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { PackingResult } from '@/lib/packing/types';

type ResultRow = { containerId: string; containerName: string; label: string; order: number; x: number; y: number; z: number; weight: number };

type PackingResultTableProps = {
  result: PackingResult;
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
  onFocusPlacement?: (placementId: string) => void;
};

export function PackingResultTable({ result, selectedPlacementId, onSelectPlacement, onFocusPlacement }: PackingResultTableProps) {
  const [query, setQuery] = useState('');
  const rows = useMemo<ResultRow[]>(() => result.results.flatMap(({ container, packed }) => packed.map((placement) => ({
    containerId: container.id,
    containerName: container.name,
    label: placement.label,
    order: placement.order,
    x: placement.x,
    y: placement.y,
    z: placement.z,
    weight: placement.weight,
  }))), [result]);
  const visibleRows = rows.filter((row) => `${row.containerName} ${row.label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  return <section className="packing-result-table" aria-label="Bảng chi tiết phương án xếp">
    <div className="result-table-toolbar"><div><p className="section-kicker">CHI TIẾT ĐẶT KIỆN</p><strong>{visibleRows.length} vị trí hiển thị</strong></div><label className="result-search"><Search size={15} aria-hidden="true" /><span className="visually-hidden">Tìm kiện hàng</span><input value={query} placeholder="Tìm container hoặc kiện" onChange={(event) => setQuery(event.target.value)} /></label></div>
    <div className="result-table-scroll"><table><thead><tr><th>Thứ tự</th><th>Kiện hàng</th><th>Container</th><th>Vị trí (m)</th><th>Khối lượng</th></tr></thead><tbody>{visibleRows.map((row) => {
      const key = `${row.containerId}:${row.order}`;
      return <tr className={selectedPlacementId === key ? 'selected' : ''} key={key}><td>{row.order}</td><td><button type="button" onClick={() => onSelectPlacement(key)} onDoubleClick={() => { onSelectPlacement(key); onFocusPlacement?.(key); }}>{row.label}</button></td><td>{row.containerName}</td><td>{row.x.toFixed(1)} · {row.y.toFixed(1)} · {row.z.toFixed(1)}</td><td>{row.weight.toFixed(1)} kg</td></tr>;
    })}</tbody></table>{!visibleRows.length && <p className="table-empty">Không có kiện phù hợp với bộ lọc.</p>}</div>
  </section>;
}
