import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Inspector } from '@/components/packing/inspector';
import type { CartonInput, ContainerInput, PackingStrategy } from '@/lib/packing/types';

const container: ContainerInput = { id: 'container-1', name: 'Container 1', length: 4, width: 5, height: 3, quantity: 1, maxWeight: 1000 };
const carton: CartonInput = { id: 'carton-1', label: 'Hộp mẫu', length: 1, width: 1, height: 1, quantity: 4, weight: 1, stackable: true, color: '#36c5f0' };

describe('Inspector', () => {
  it('shows cargo controls only after the Cargo tab is selected', () => {
    render(<Inspector
      containers={[container]}
      cartons={[carton]}
      strategy={'minContainers' as PackingStrategy}
      allowRotation
      onAddCarton={vi.fn()}
      onAddContainer={vi.fn()}
      onUpdateCarton={vi.fn()}
      onUpdateContainer={vi.fn()}
      onRemoveCarton={vi.fn()}
      onRemoveContainer={vi.fn()}
      onStrategyChange={vi.fn()}
      onAllowRotationChange={vi.fn()}
      onImportClick={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('tab', { name: /hàng hóa/i }));

    const tab = screen.getByRole('tabpanel', { name: /hàng hóa/i });
    expect(within(tab).getByRole('button', { name: /thêm vào danh sách/i })).toBeVisible();
    expect(within(tab).getByLabelText(/dài.*m/i)).toBeVisible();
  });
});
