import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

test('imports, computes in a real worker, adjusts, exports and restores the same plan', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  const workers: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('worker', (worker) => workers.push(worker.url()));
  await page.goto('/');

  await page.getByRole('button', { name: 'Nhập file', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Thay danh sách hiện tại' })).toBeChecked();
  await page.getByRole('button', { name: 'Nhập hàng hóa', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'hang.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Tên,Dài,Rộng,Cao,Số lượng,Khối lượng,Có thể chồng\nMáy A,1,1,1,2,10,không'),
  });
  await expect(page.getByRole('textbox', { name: 'Tên / nhãn' })).toHaveValue('Máy A');
  await expect(page.getByRole('checkbox', { name: 'Cho phép chồng kiện' })).not.toBeChecked();

  await page.getByRole('tab', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Nhập container', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'xe.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Tên,Dài,Rộng,Cao,Số lượng,Tải trọng\nXe đơn hàng,6,3,3,1,1000'),
  });
  await expect(page.getByRole('radio', { name: 'Dùng container tự nhập' })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Tên container' })).toHaveValue('Xe đơn hàng');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByText('Bước 2/2')).toBeVisible();
  expect(workers).toHaveLength(1);
  await expect(page.locator('.viewport-main canvas')).toBeVisible();

  await page.getByRole('region', { name: 'Bảng chi tiết phương án xếp' }).getByRole('button', { name: 'Máy A', exact: true }).first().click();
  await page.getByRole('button', { name: 'Chỉnh tay', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'X (m)', exact: true }).fill('0.25');
  const allowOverride = page.getByRole('checkbox', { name: 'Cho phép ghi đè cảnh báo' });
  if (await allowOverride.isEnabled()) await allowOverride.check();
  await page.getByRole('button', { name: 'Áp dụng vị trí' }).click();
  await expect(page.getByText('Phương án đã chỉnh 1 vị trí. Excel sẽ xuất đúng tọa độ đang xem.')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất XLSX', exact: true }).click();
  const download = await downloadPromise;
  const workbook = XLSX.read(await readFile((await download.path())!), { type: 'buffer' });
  expect(XLSX.utils.sheet_to_json(workbook.Sheets['Container'])).toMatchObject([{ name: 'Xe đơn hàng', quantity: 1 }]);
  expect(XLSX.utils.sheet_to_json(workbook.Sheets['Ket qua xep'])).toMatchObject([{ label: 'Máy A', x: .25 }, { label: 'Máy A' }]);

  await expect.poll(() => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('packing-workspace-v1') ?? 'null');
    return saved && Object.keys(saved.placementOverrides).length;
  })).toBe(1);
  await page.reload();
  await expect(page.getByText('Bước 2/2')).toBeVisible();
  await expect(page.getByText('Phương án đã chỉnh 1 vị trí. Excel sẽ xuất đúng tọa độ đang xem.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tên / nhãn' })).toHaveValue('Máy A');
  expect(workers).toHaveLength(1);
  await page.getByRole('button', { name: 'Khôi phục cách xếp tự động' }).click();
  await expect(page.getByText('Phương án đã chỉnh 1 vị trí. Excel sẽ xuất đúng tọa độ đang xem.')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('cancels expensive computation and can immediately optimize a smaller order', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/');
  await page.getByRole('spinbutton', { name: 'Số lượng', exact: true }).fill('4000');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByRole('button', { name: 'Hủy tối ưu' })).toBeVisible();
  await page.getByRole('button', { name: 'Hủy tối ưu' }).click();
  await expect(page.getByText('Đã hủy tính toán. Dữ liệu nhập vẫn được giữ nguyên.')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Số lượng', exact: true }).fill('3');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByText('Bước 3/3')).toBeVisible();
});

test('keeps mobile view and playback controls inside the simulation stage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByText('Bước 4/4')).toBeVisible();
  const stage = (await page.locator('.simulation-stage').boundingBox())!;
  for (const control of [page.getByRole('button', { name: 'Mặt bằng', exact: true }), page.getByRole('button', { name: 'Tốc độ 2×', exact: true })]) {
    const bounds = (await control.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(stage.x + stage.width);
  }
  await page.getByRole('button', { name: 'Nhập file', exact: true }).click();
  const radio = (await page.getByRole('radio', { name: 'Thay danh sách hiện tại' }).boundingBox())!;
  expect(radio.width).toBeLessThanOrEqual(24);
});
