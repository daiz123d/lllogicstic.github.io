import { expect, test } from '@playwright/test';

async function optimize(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByLabel('Hybrid Isometric Cutaway')).toBeVisible();
}

test('operates the hybrid cutaway viewer without HUD or PIP overlap', async ({ page }) => {
  await optimize(page);

  await page.getByRole('button', { name: 'Vừa khung hình' }).click();
  await page.getByRole('button', { name: 'PIP' }).click();
  await expect(page.locator('canvas')).toHaveCount(3);
  await expect(page.getByLabel('Mặt trên viewport PIP')).toBeVisible();
  await expect(page.getByLabel('Mặt trước viewport PIP')).toBeVisible();

  const layout = page.locator('.viewport-pip');
  const main = page.locator('.viewport-main');
  const firstPip = page.locator('.viewport-pip-panel').first();
  const toolbar = page.getByRole('toolbar', { name: 'Điều khiển mô phỏng' });
  const hud = page.getByLabel('Chỉ số mô phỏng');
  const [layoutBox, mainBox, pipBox, toolbarBox, hudBox] = await Promise.all([
    layout.boundingBox(), main.boundingBox(), firstPip.boundingBox(), toolbar.boundingBox(), hud.boundingBox(),
  ]);
  expect(layoutBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(pipBox).not.toBeNull();
  expect(toolbarBox).not.toBeNull();
  expect(hudBox).not.toBeNull();
  expect(mainBox!.width / layoutBox!.width).toBeGreaterThanOrEqual(.7);
  expect(pipBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y + toolbarBox!.height);
  expect(pipBox!.y).toBeGreaterThanOrEqual(hudBox!.y + hudBox!.height);

  await page.getByRole('button', { name: 'Quad View' }).click();
  await expect(page.locator('canvas')).toHaveCount(4);
  await expect(page.getByLabel('Mặt trên viewport')).toBeVisible();
  await expect(page.getByLabel('Mặt trước viewport')).toBeVisible();
  await expect(page.getByLabel('Mặt bên viewport')).toBeVisible();

  await page.getByRole('button', { name: 'Khoảng trống' }).click();
  await expect(page.getByRole('button', { name: 'Khoảng trống' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: 'Thể tích chưa sử dụng' })).toContainText('Khoảng trống');

  await page.getByRole('button', { name: 'Tiếp' }).click();
  await page.getByRole('region', { name: 'Bảng chi tiết phương án xếp' }).getByRole('button', { name: 'Hộp mẫu', exact: true }).first().click();
  await expect(page.locator('.selected-detail')).toContainText('Đang chọn: Hộp mẫu');
});

test('uses one keyboard-operable preset tabpanel on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await optimize(page);
  await page.getByRole('button', { name: 'Quad View' }).click();

  const tabs = page.getByRole('tablist', { name: 'Góc nhìn camera' });
  const isometric = tabs.getByRole('tab', { name: 'Isometric' });
  const top = tabs.getByRole('tab', { name: 'Mặt trên' });
  const front = tabs.getByRole('tab', { name: 'Mặt trước' });
  const side = tabs.getByRole('tab', { name: 'Mặt bên' });
  const panel = page.getByLabel('Hybrid Isometric Cutaway').getByRole('tabpanel');

  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(isometric).toHaveAttribute('tabindex', '0');
  await expect(top).toHaveAttribute('tabindex', '-1');
  await expect(isometric).toHaveAttribute('aria-controls', await panel.getAttribute('id') ?? 'missing-panel');
  await expect(panel).toHaveAttribute('aria-labelledby', await isometric.getAttribute('id') ?? 'missing-tab');

  await isometric.focus();
  await isometric.press('ArrowRight');
  await expect(top).toBeFocused();
  await expect(top).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toHaveAttribute('aria-labelledby', await top.getAttribute('id') ?? 'missing-tab');
  await expect(page.getByLabel('Mặt trên viewport')).toBeVisible();

  await top.press('End');
  await expect(side).toBeFocused();
  await side.press('Home');
  await expect(isometric).toBeFocused();
  await isometric.press('ArrowLeft');
  await expect(side).toBeFocused();
  await side.press('ArrowLeft');
  await expect(front).toBeFocused();
  await expect(page.locator('canvas')).toHaveCount(1);

  await page.getByRole('button', { name: 'PIP' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(tabs).toBeVisible();
});
