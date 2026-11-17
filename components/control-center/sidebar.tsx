'use client';

import { Box, ChevronLeft, Container, FileUp, LayoutDashboard, ListChecks, Menu, Package } from 'lucide-react';

export type WorkspaceSection = 'workspace' | 'simulation' | 'container' | 'cargo' | 'results' | 'import';

const items = [
  { label: 'Tổng quan', icon: LayoutDashboard, section: 'workspace' },
  { label: 'Hộp hàng', icon: Package, section: 'cargo' },
  { label: 'Container', icon: Container, section: 'container' },
  { label: 'Trình mô phỏng 3D', icon: Box, section: 'simulation' },
  { label: 'Kết quả xếp', icon: ListChecks, section: 'results' },
  { label: 'Nhập dữ liệu', icon: FileUp, section: 'import' },
] as const;

export function Sidebar({ collapsed, onToggle, onNavigate, activeSection = 'workspace' }: { collapsed: boolean; onToggle: () => void; onNavigate?: (section: WorkspaceSection) => void; activeSection?: WorkspaceSection }) {
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
        {items.map(({ label, icon: Icon, section }) => (
          <a href={`#${['cargo', 'container', 'import'].includes(section) ? 'packing-inspector' : section}`} onClick={(event) => { if (onNavigate) { event.preventDefault(); onNavigate(section); } }} className={activeSection === section ? 'nav-link active' : 'nav-link'} aria-current={activeSection === section ? 'location' : undefined} key={label} title={collapsed ? label : undefined}>
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="optimizer-status">
        <span className="status-pulse" aria-hidden="true" />
        <div><small>DỮ LIỆU TRÊN MÁY</small><strong>Xử lý trong trình duyệt</strong></div>
      </div>
    </aside>
  );
}
