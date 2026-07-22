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
  const pipStack = page.locator('.pip-stack');
  const toolbar = page.getByRole('toolbar', { name: 'Điều khiển mô phỏng' });
  const hud = page.getByLabel('Chỉ số mô phỏng');
  const [layoutBox, mainBox, pipBox, toolbarBox, hudBox] = await Promise.all([
    layout.boundingBox(), main.boundingBox(), pipStack.boundingBox(), toolbar.boundingBox(), hud.boundingBox(),
  ]);
  expect(layoutBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(pipBox).not.toBeNull();
  expect(toolbarBox).not.toBeNull();
  expect(hudBox).not.toBeNull();
  expect(mainBox!.width / layoutBox!.width).toBeGreaterThanOrEqual(.7);
  expect((pipBox!.x - mainBox!.x) / layoutBox!.width).toBeGreaterThanOrEqual(.7);
  expect(pipBox!.x).toBeGreaterThanOrEqual(layoutBox!.x);
  expect(pipBox!.y).toBeGreaterThanOrEqual(layoutBox!.y);
  expect(pipBox!.x + pipBox!.width).toBeLessThanOrEqual(layoutBox!.x + layoutBox!.width);
  expect(pipBox!.y + pipBox!.height).toBeLessThanOrEqual(layoutBox!.y + layoutBox!.height);
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
  const panelId = await panel.getAttribute('id') ?? 'missing-panel';
  for (const tab of [isometric, top, front, side]) {
    await expect(tab).toHaveAttribute('aria-controls', panelId);
  }
  await expect(top).toHaveAttribute('tabindex', '-1');
  await expect(front).toHaveAttribute('tabindex', '-1');
  await expect(side).toHaveAttribute('tabindex', '-1');
  await expect(panel).toHaveAttribute('aria-labelledby', await isometric.getAttribute('id') ?? 'missing-tab');

  await isometric.focus();
  await isometric.press('ArrowRight');
  await expect(top).toBeFocused();
  await expect(top).toHaveAttribute('aria-selected', 'true');
  await expect(top).toHaveAttribute('tabindex', '0');
  await expect(isometric).toHaveAttribute('tabindex', '-1');
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

test('keeps PIP and Quad on one canvas at the 640px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await optimize(page);

  await page.getByRole('button', { name: 'PIP' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('tablist', { name: 'Góc nhìn camera' })).toBeVisible();

  await page.getByRole('button', { name: 'Quad View' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('progressively falls back at 641px and restores multi-canvas when the stage is wide enough', async ({ page }) => {
  await page.setViewportSize({ width: 641, height: 900 });
  await optimize(page);
  await page.getByRole('button', { name: 'PIP' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('tablist', { name: 'Góc nhìn camera' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('canvas')).toHaveCount(3);
  const layoutBox = await page.locator('.viewport-pip').boundingBox();
  const mainBox = await page.locator('.viewport-main').boundingBox();
  const pipBox = await page.locator('.pip-stack').boundingBox();
  expect(layoutBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(pipBox).not.toBeNull();
  expect((pipBox!.x - mainBox!.x) / layoutBox!.width).toBeGreaterThanOrEqual(.7);
});

test('hydrates the app from the GitHub Pages mount path', async ({ page }) => {
  const response = await page.goto('/lllogicstic.github.io/');
  if (process.env.EXPECT_PAGES_BASE_PATH === '1') {
    expect(await response?.text()).toContain('/lllogicstic.github.io/_next/');
  }
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByLabel('Hybrid Isometric Cutaway')).toBeVisible();
});
