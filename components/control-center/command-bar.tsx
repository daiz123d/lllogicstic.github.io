import { FileUp, RotateCcw, Save, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

type CommandBarProps = {
  title: string;
  breadcrumb: string;
  isSaved: boolean;
  onImport?: () => void;
  onReset?: () => void;
  onOptimize?: () => void;
  optimizeDisabled?: boolean;
  children?: ReactNode;
};

export function CommandBar({ title, breadcrumb, isSaved, onImport, onReset, onOptimize, optimizeDisabled, children }: CommandBarProps) {
  return <header className="command-bar">
    <div className="command-context">
      <p>{breadcrumb}</p>
      <div><h1>{title}</h1><span className={isSaved ? 'save-state saved' : 'save-state'}><Save size={14} aria-hidden="true" />{isSaved ? 'Đã lưu cục bộ' : 'Có thay đổi chưa tối ưu'}</span></div>
    </div>
    <div className="command-actions">
      {children}
      <button type="button" className="command-button" onClick={onImport}><FileUp size={16} aria-hidden="true" />Nhập file</button>
      <button type="button" className="command-button" onClick={onReset}><RotateCcw size={16} aria-hidden="true" />Đặt lại</button>
      <button type="button" className="optimize-button" onClick={onOptimize} disabled={optimizeDisabled}><Sparkles size={17} aria-hidden="true" />Tối ưu xếp hàng</button>
    </div>
  </header>;
}
