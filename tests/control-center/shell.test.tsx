import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ControlCenterShell } from '@/components/control-center/control-center-shell';

describe('ControlCenterShell', () => {
  it('collapses the navigation rail without hiding its accessible labels', () => {
    render(
      <ControlCenterShell commandBar={<div />} kpis={[]}>
        <div>Canvas</div>
      </ControlCenterShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /thu gọn thanh điều hướng/i }));

    expect(screen.getByRole('navigation', { name: /điều hướng chính/i })).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('link', { name: /trình mô phỏng 3d/i })).toBeInTheDocument();
  });
});
