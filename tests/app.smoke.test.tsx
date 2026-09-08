import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Home from '../app/page';

describe('Home', () => {
  it('renders the container packing workspace', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: /bảng điều phối xếp hàng 3d/i })).toBeInTheDocument();
  });
});
