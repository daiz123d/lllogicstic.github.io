import { expect, test } from '@playwright/test';

async function optimize(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByLabel('Hybrid Isometric Cutaway')).toBeVisible();
}

async function configureLargeScene(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('tabpanel', { name: 'Hàng hóa' }).getByRole('spinbutton', { name: 'Số lượng' }).fill('150');
  await page.getByRole('tab', { name: 'Container' }).click();
  await page.getByRole('radio', { name: 'Dùng container tự nhập' }).click();
  const containerPanel = page.getByRole('tabpanel', { name: 'Container' });
  await containerPanel.getByRole('spinbutton', { name: 'Dài (m)' }).fill('11');
  await containerPanel.getByRole('spinbutton', { name: 'Rộng (m)' }).fill('5');
  await containerPanel.getByRole('spinbutton', { name: 'Cao (m)' }).fill('3');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByLabel('Hybrid Isometric Cutaway')).toBeVisible();
  await expect(page.getByText('Bước 0/150')).toBeVisible();
  await page.getByRole('slider', { name: 'Tiến trình xếp hàng' }).fill('150');
  await expect(page.getByText('Bước 150/150')).toBeVisible();
}

type PlaybackTimerStats = { active: number; peakActive: number; scheduled: number; cleared: number; fired: number };

async function installPlaybackTimerProbe(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    type TimerProbeWindow = Window & {
      __playbackTimerStats?: () => PlaybackTimerStats;
      __restorePlaybackTimerProbe?: () => void;
    };
    const scope = window as TimerProbeWindow;
    if (scope.__restorePlaybackTimerProbe) throw new Error('Playback timer probe is already installed');

    const playbackDelays = new Set([325, 650, 1300]);
    const activePlaybackTimers = new Set<number>();
    const nativeSetTimeout = window.setTimeout;
    const nativeClearTimeout = window.clearTimeout;
    let peakActive = 0;
    let scheduled = 0;
    let cleared = 0;
    let fired = 0;

    window.setTimeout = ((handler: TimerHandler, timeout = 0, ...args: unknown[]) => {
      if (typeof handler !== 'function' || !playbackDelays.has(Number(timeout))) {
        return Reflect.apply(nativeSetTimeout, window, [handler, timeout, ...args]);
      }

      let timer = 0;
      const wrappedHandler = function (this: unknown, ...callbackArgs: unknown[]) {
        if (activePlaybackTimers.delete(timer)) fired += 1;
        return Reflect.apply(handler, this, callbackArgs);
      };
      timer = Reflect.apply(nativeSetTimeout, window, [wrappedHandler, timeout, ...args]);
      activePlaybackTimers.add(timer);
      scheduled += 1;
      peakActive = Math.max(peakActive, activePlaybackTimers.size);
      return timer;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((timer?: number) => {
      if (typeof timer === 'number' && activePlaybackTimers.delete(timer)) cleared += 1;
      return Reflect.apply(nativeClearTimeout, window, [timer]);
    }) as typeof window.clearTimeout;
    scope.__playbackTimerStats = () => ({ active: activePlaybackTimers.size, peakActive, scheduled, cleared, fired });
    scope.__restorePlaybackTimerProbe = () => {
      window.setTimeout = nativeSetTimeout;
      window.clearTimeout = nativeClearTimeout;
      delete scope.__playbackTimerStats;
      delete scope.__restorePlaybackTimerProbe;
    };
  });
}

async function playbackTimerStats(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as Window & { __playbackTimerStats: () => PlaybackTimerStats }).__playbackTimerStats());
}

async function waitForActivePlaybackTimer(page: import('@playwright/test').Page) {
  return page.evaluate(() => new Promise<PlaybackTimerStats>((resolve, reject) => {
    const scope = window as Window & { __playbackTimerStats: () => PlaybackTimerStats };
    const deadline = performance.now() + 5_000;
    const inspect = () => {
      const stats = scope.__playbackTimerStats();
      if (stats.active === 1) resolve(stats);
      else if (performance.now() >= deadline) reject(new Error(`Playback timer did not become active: ${JSON.stringify(stats)}`));
      else requestAnimationFrame(inspect);
    };
    inspect();
  }));
}

async function restorePlaybackTimerProbe(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as Window & { __restorePlaybackTimerProbe?: () => void }).__restorePlaybackTimerProbe?.());
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

test('keeps a 150-placement scene interactive without mounting disabled work', async ({ page }) => {
  test.setTimeout(90_000);
  await configureLargeScene(page);

  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Vừa khung hình' }).click();
  await page.getByRole('button', { name: 'Wireframe' }).click();
  await expect(page.getByRole('button', { name: 'Wireframe' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: 'Thể tích chưa sử dụng' })).toHaveCount(0);
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-empty-region-count', '0');

  await page.getByRole('button', { name: 'PIP' }).click();
  await expect(page.locator('canvas')).toHaveCount(3);
  await page.getByRole('button', { name: 'Thu gọn Mặt trên' }).click();
  await expect(page.locator('canvas')).toHaveCount(2);
  await page.getByRole('button', { name: 'Mở Mặt trên PIP' }).click();
  await expect(page.locator('canvas')).toHaveCount(3);
  await page.getByRole('button', { name: 'Single View' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Quad View' }).click();
  await expect(page.locator('canvas')).toHaveCount(4);

  await page.getByRole('button', { name: 'Khoảng trống' }).click();
  await expect(page.getByRole('status', { name: 'Thể tích chưa sử dụng' })).toBeVisible();
  await expect(page.locator('.scene-canvas').first()).toHaveAttribute('data-empty-region-count', /^[1-9]\d*$/);
  await page.getByRole('button', { name: 'Solid' }).click();
  await expect(page.getByRole('status', { name: 'Thể tích chưa sử dụng' })).toHaveCount(0);
  expect(await page.locator('.scene-canvas').evaluateAll((scenes) => scenes.map((scene) => scene.getAttribute('data-empty-region-count')))).toEqual(['0', '0', '0', '0']);

  await page.getByRole('region', { name: 'Bảng chi tiết phương án xếp' }).getByRole('button', { name: 'Hộp mẫu', exact: true }).first().click();
  await expect(page.locator('.selected-detail')).toContainText('Đang chọn: Hộp mẫu');

  await page.getByRole('slider', { name: 'Tiến trình xếp hàng' }).fill('0');
  await installPlaybackTimerProbe(page);
  try {
    await page.getByRole('button', { name: 'Tốc độ 0.5×' }).click();
    await page.getByRole('button', { name: 'Phát' }).click();
    await expect.poll(async () => (await playbackTimerStats(page)).active).toBe(1);

    await page.getByRole('button', { name: 'Tốc độ 1×' }).click();
    await expect.poll(async () => (await playbackTimerStats(page)).active).toBe(1);
    await page.getByRole('button', { name: 'Tốc độ 2×' }).click();
    await expect.poll(async () => (await playbackTimerStats(page)).active).toBe(1);
    await page.getByRole('slider', { name: 'Tiến trình xếp hàng' }).fill('2');
    await expect(page.getByText('Bước 5/150')).toBeVisible({ timeout: 5_000 });
    await expect.poll(async () => (await playbackTimerStats(page)).fired).toBeGreaterThanOrEqual(3);
    await expect.poll(async () => (await playbackTimerStats(page)).active).toBe(1);

    let timerStats = await waitForActivePlaybackTimer(page);
    expect(timerStats).toMatchObject({ active: 1, peakActive: 1 });
    expect(timerStats.scheduled).toBeGreaterThanOrEqual(7);
    expect(timerStats.cleared).toBeGreaterThanOrEqual(2);

    await page.getByRole('button', { name: 'Tạm dừng' }).click();
    await expect.poll(async () => (await playbackTimerStats(page)).active).toBe(0);
    timerStats = await playbackTimerStats(page);
    expect(timerStats.peakActive).toBe(1);
    expect(timerStats.cleared).toBeGreaterThanOrEqual(3);

    await page.getByRole('button', { name: 'Phát' }).click();
    await expect.poll(async () => (await playbackTimerStats(page)).active).toBe(1);
    await page.getByRole('button', { name: /..t l.i/i }).click();
    await expect(page.getByText(/Bước \d+\/150/)).toHaveCount(0);
    await expect.poll(async () => (await playbackTimerStats(page)).active).toBe(0);
    timerStats = await playbackTimerStats(page);
    expect(timerStats.peakActive).toBe(1);
    expect(timerStats.cleared).toBeGreaterThanOrEqual(4);
  } finally {
    await restorePlaybackTimerProbe(page);
  }
});
