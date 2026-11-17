import { expect, test } from '@playwright/test';

test('stops GPU draws while idle and resumes for camera changes and playback', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const scope = window as unknown as Window & { packingDrawCalls?: number; packingEntryDrawWindows?: Set<number> };
    scope.packingDrawCalls = 0;
    scope.packingEntryDrawWindows = new Set();
    for (const method of ['drawElements', 'drawArrays'] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method] = function (...args: number[]) {
        scope.packingDrawCalls! += 1;
        if (document.querySelector('.playback-panel strong')?.textContent === 'Bước 1/4') {
          scope.packingEntryDrawWindows!.add(Math.floor(performance.now() / 50));
        }
        return Reflect.apply(original, this, args);
      };
    }
  });
  const drawCalls = () => page.evaluate(() => (window as unknown as Window & { packingDrawCalls: number }).packingDrawCalls);
  const idleDraws = () => page.evaluate(async () => {
    const scope = window as unknown as Window & { packingDrawCalls: number };
    const before = scope.packingDrawCalls;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return scope.packingDrawCalls - before;
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.locator('.viewport-main canvas')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect.poll(drawCalls).toBeGreaterThan(0);
  await expect.poll(idleDraws, { timeout: 15_000 }).toBe(0);

  const beforeCamera = await drawCalls();
  await page.getByRole('button', { name: 'Vừa khung hình' }).click();
  await expect.poll(drawCalls).toBeGreaterThan(beforeCamera);
  await expect.poll(idleDraws, { timeout: 10_000 }).toBe(0);

  const beforePlayback = await drawCalls();
  await page.getByRole('button', { name: 'Phát lại', exact: true }).click();
  await expect.poll(drawCalls).toBeGreaterThan(beforePlayback);
  await expect(page.getByText('Bước 4/4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phát lại', exact: true })).toBeVisible();
  // Observe throughout the first transition, without relying on when Playwright polls its label.
  const entryDrawWindows = await page.evaluate(() => (window as unknown as Window & { packingEntryDrawWindows: Set<number> }).packingEntryDrawWindows.size);
  expect(entryDrawWindows).toBeGreaterThanOrEqual(4);
  await expect.poll(idleDraws, { timeout: 15_000 }).toBe(0);
  expect(errors).toEqual([]);
});
