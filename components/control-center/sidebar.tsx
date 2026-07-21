'use client';

import { Box, ChevronLeft, Container, History, LayoutDashboard, Menu, Package, Radar } from 'lucide-react';

const items = [
  { label: 'Tổng quan', icon: LayoutDashboard, active: true },
  { label: 'Trình mô phỏng 3D', icon: Box },
  { label: 'Container', icon: Container },
  { label: 'Hộp hàng', icon: Package },
  { label: 'Lịch sử xếp', icon: History },
  { label: 'Theo dõi', icon: Radar },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className="control-sidebar">
      <div className="brand-row">
        <div className="brand-mark" aria-hidden="true"><Box size={20} /></div>
        <strong className="brand-name">Box3D<br />Command</strong>
        <button className="icon-button sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}>
          {collapsed ? <Menu size={19} /> : <ChevronLeft size={19} />}
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="Điều hướng chính" data-collapsed={collapsed}>
        {items.map(({ label, icon: Icon, active }) => (
          <a href={label === 'Tổng quan' ? '#workspace' : `#${label.toLowerCase().replaceAll(' ', '-')}`} className={active ? 'nav-link active' : 'nav-link'} key={label} title={collapsed ? label : undefined}>
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="optimizer-status">
        <span className="status-pulse" aria-hidden="true" />
        <div><small>HỆ THỐNG</small><strong>Optimizer Online</strong></div>
      </div>
    </aside>
  );
}
