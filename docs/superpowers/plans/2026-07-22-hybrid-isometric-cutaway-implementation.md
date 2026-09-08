# Hybrid Isometric Cutaway Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current packing viewer with a complete Hybrid Isometric Cutaway tool while preserving packing results and container-selection behavior.

**Architecture:** Keep packing data immutable at the viewer boundary. Put deterministic calculations in `viewer-model.ts`, scene rendering in `container-scene.tsx`, viewport composition in `viewer-viewports.tsx`, and DOM controls/HUD in `viewer-controls.tsx`; `packing-viewer.tsx` coordinates those modules and `packing-workspace.tsx` owns persisted manual overrides and playback.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.9, Three.js 0.183.2, React Three Fiber 9.6.1, Drei 10.7.7, Vitest, Testing Library, Playwright.

## Global Constraints

- Do not change `src/binPacking.js` packing, preset-selection policy, input parsing, or automatic placement coordinates.
- Use the installed Three.js `0.183.2`; do not downgrade Three.js or add a physics engine.
- Do not add image textures, bloom, strong reflections, or post-processing.
- Rendering modes and Exploded View must never mutate actual `Placement` coordinates.
- Preserve 3D/2D switching, table selection, playback slider, WebGL fallback, and current import/export behavior.
- Manual edits are local presentation overrides and apply only after validation; invalid drafts stay unsaved unless override is explicitly enabled.
- Respect `prefers-reduced-motion`; keep expensive empty-space geometry and extra viewports unmounted while disabled.

---

### Task 1: Add deterministic viewer state and geometry helpers

**Files:**
- Create: `components/packing/viewer-types.ts`
- Create: `components/packing/viewer-model.ts`
- Create: `tests/packing/viewer-model.test.ts`

**Interfaces:**
- Consumes: `PackedContainer`, `Placement`, and `Leftover` from `lib/packing/types.ts`.
- Produces: `ViewPreset`, `RenderMode`, `ShellVisibility`, `CameraFrame`, `ViewerMetrics`, `EmptyRegion`, `getCameraFrame`, `getViewerMetrics`, `getHeatColor`, and `getEmptyRegions`.

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { getCameraFrame, getEmptyRegions, getHeatColor, getViewerMetrics } from '@/components/packing/viewer-model';

describe('viewer model', () => {
  it('fits the container to 75 percent of an orthographic viewport', () => {
    expect(getCameraFrame({ width: 2, height: 2, length: 10 }, 'iso', 1200, 700)).toMatchObject({ coverage: .75, elevation: 32 });
  });
  it('computes volume, weight, packed and floor-only metrics', () => {
    expect(getViewerMetrics(packedContainer, 1)).toMatchObject({ packed: 1, total: 2, floorOnly: 1, usedWeight: 100, maxWeight: 4800 });
  });
  it('returns deterministic weight and height heat colors', () => {
    expect(getHeatColor('weight', .5)).toBe('#f59e0b');
    expect(getHeatColor('height', 1)).toBe('#fb7185');
  });
  it('returns no empty geometry when disabled and bounded regions when enabled', () => {
    expect(getEmptyRegions(packedContainer, false)).toEqual([]);
    expect(getEmptyRegions(packedContainer, true).every((region) => region.width > 0 && region.length > 0 && region.height > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run: `npm run test:unit -- tests/packing/viewer-model.test.ts`

Expected: FAIL because `viewer-model` does not exist.

- [ ] **Step 3: Add exact shared types**

```ts
export type ViewPreset = 'iso' | 'top' | 'front' | 'side';
export type RenderMode = 'solid' | 'xray' | 'wireframe' | 'weight' | 'height' | 'space' | 'exploded';
export type ShellVisibility = { all: boolean; left: boolean; right: boolean; roof: boolean; front: boolean };
export type CameraFrame = { target: [number, number, number]; position: [number, number, number]; zoom: number; coverage: .75; elevation: 32 };
export type ViewerMetrics = { usedVolume: number; volumePercent: number; usedWeight: number; maxWeight: number; weightPercent: number; packed: number; total: number; floorOnly: number };
export type EmptyRegion = { id: string; x: number; y: number; z: number; width: number; height: number; length: number };
export type PlacementOverride = { x: number; y: number; z: number; width: number; height: number; length: number };
```

- [ ] **Step 4: Implement model calculations**

```ts
export function getViewerMetrics(container: PackedContainer, visibleCount: number): ViewerMetrics {
  const visible = container.packed.slice(0, Math.max(0, visibleCount));
  const containerVolume = container.container.width * container.container.height * container.container.length;
  const usedVolume = visible.reduce((sum, box) => sum + box.width * box.height * box.length, 0);
  const usedWeight = visible.reduce((sum, box) => sum + box.weight, 0);
  return {
    usedVolume,
    volumePercent: containerVolume ? Math.min(100, usedVolume / containerVolume * 100) : 0,
    usedWeight,
    maxWeight: container.container.maxWeight,
    weightPercent: container.container.maxWeight ? Math.min(100, usedWeight / container.container.maxWeight * 100) : 0,
    packed: visible.length,
    total: container.packed.length + container.unpacked.length,
    floorOnly: visible.filter((box) => !box.stackable).length,
  };
}
```

Implement `getCameraFrame` with a 32-degree isometric elevation and orthographic zoom derived from container bounds, viewport aspect, and `.75` coverage. Implement heat colors with fixed professional stops and implement `getEmptyRegions` with a 0.25 m occupancy grid capped at 18,000 cells; merge adjacent free cells into bounded rectangular regions before returning.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/packing/viewer-model.test.ts`

Expected: PASS.

```powershell
git add components/packing/viewer-types.ts components/packing/viewer-model.ts tests/packing/viewer-model.test.ts
git commit -m "feat: add packing viewer model"
```

---

### Task 2: Build the orthographic cutaway scene

**Files:**
- Create: `components/packing/container-scene.tsx`
- Create: `tests/packing/container-scene.test.tsx`
- Modify: `components/packing/packing-viewer.tsx`

**Interfaces:**
- Consumes: `CameraFrame`, `RenderMode`, `ShellVisibility`, active `PackedContainer`, visible placements, selected key, hover key, and focus request.
- Produces: `ContainerScene` with orthographic presets, solid cargo, cutaway shell, pointer selection and double-click focus.

- [ ] **Step 1: Write failing scene contract tests**

```tsx
it('exposes the cutaway canvas and fit control without WebGL-only text loss', () => {
  renderViewer({ packedContainers: [packedContainer], step: 1 });
  expect(screen.getByRole('button', { name: 'Vừa khung hình' })).toBeInTheDocument();
  expect(screen.getByText('Isometric')).toBeInTheDocument();
});

it('keeps shell layer controls accessible', () => {
  renderViewer({ packedContainers: [packedContainer], step: 1 });
  expect(screen.getByRole('checkbox', { name: 'Thành trái' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Nóc container' })).toBeChecked();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/packing/container-scene.test.tsx`

Expected: FAIL because the new controls and scene contract do not exist.

- [ ] **Step 3: Implement `ContainerScene`**

Use Drei `OrthographicCamera`, `OrbitControls`, `Edges`, `Html`, `ContactShadows`, and `TransformControls`. The scene props are:

```tsx
type ContainerSceneProps = {
  packedContainer: PackedContainer;
  placements: Placement[];
  selectedPlacementId: string | null;
  hoveredPlacementId: string | null;
  preset: ViewPreset;
  mode: RenderMode;
  shell: ShellVisibility;
  focusToken: string;
  onSelectPlacement: (key: string) => void;
  onHoverPlacement: (key: string | null) => void;
  onRequestFocus: (key: string) => void;
};
```

Render floor, negative-Z rear, left/right walls, optional roof, optional front and an edge cage. Use roof opacity `.10`, side opacity `.15`, subtle cyan edges, solid boxes by default, per-box thin edges and local contact cues. Preserve the amber `SÀN` marker on `stackable: false` placements. Use one hemisphere light, one soft directional light, and contact shadows; do not add post-processing or a second shadow map. Bind `onDoubleClick` to selection plus focus request; bind `onContextMenu={(event) => event.preventDefault()}` on the canvas wrapper.

- [ ] **Step 4: Add fit behavior without camera resets**

Create `CameraController` whose effect depends only on `preset`, `focusToken`, container dimensions, visible placement count, and viewport size. Apply `getCameraFrame`; do not depend on selected/hover/mode so normal state changes preserve orbit/pan/zoom.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/packing/container-scene.test.tsx tests/packing/viewer.test.tsx`

Expected: PASS.

```powershell
git add components/packing/container-scene.tsx components/packing/packing-viewer.tsx tests/packing/container-scene.test.tsx
git commit -m "feat: render orthographic cutaway container"
```

---

### Task 3: Add controls, HUD, hover and selection details

**Files:**
- Create: `components/packing/viewer-controls.tsx`
- Create: `tests/packing/viewer-controls.test.tsx`
- Modify: `components/packing/container-scene.tsx`
- Modify: `components/packing/packing-viewer.tsx`
- Modify: `components/packing/packing-result-table.tsx`
- Modify: `tests/packing/result-table.test.tsx`

**Interfaces:**
- Consumes: active placement, `ViewerMetrics`, mode/shell state, selected key, and focus callback.
- Produces: accessible toolbar/HUD, hover tooltip, dimension/coordinate overlay, synchronized table focus.

- [ ] **Step 1: Write failing controls and table-sync tests**

```tsx
it('shows complete HUD metrics and selected coordinates', () => {
  render(<ViewerHud metrics={metrics} selected={placement} unpacked={[]} />);
  expect(screen.getByText('Thể tích 6.3%')).toBeInTheDocument();
  expect(screen.getByText('Tải trọng 100 / 4.800 kg')).toBeInTheDocument();
  expect(screen.getByText('X 0.00 · Y 0.00 · Z 0.00')).toBeInTheDocument();
});

it('requests focus when a result row is clicked', () => {
  const onFocusPlacement = vi.fn();
  render(<PackingResultTable result={result} selectedPlacementId={null} onSelectPlacement={() => {}} onFocusPlacement={onFocusPlacement} />);
  fireEvent.doubleClick(screen.getByRole('button', { name: 'Kiện A' }));
  expect(onFocusPlacement).toHaveBeenCalledWith('container-1:1');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/packing/viewer-controls.test.tsx tests/packing/result-table.test.tsx`

Expected: FAIL because `ViewerHud` and focus callbacks do not exist.

- [ ] **Step 3: Implement accessible controls and HUD**

```tsx
export type ViewerControlsProps = {
  mode: RenderMode;
  shell: ShellVisibility;
  preset: ViewPreset;
  metrics: ViewerMetrics;
  selected: Placement | null;
  unpacked: Leftover[];
  onModeChange: (mode: RenderMode) => void;
  onShellChange: (next: ShellVisibility) => void;
  onPresetChange: (preset: ViewPreset) => void;
  onFit: () => void;
};
```

Render DOM text for volume, load, packed/unpacked and coordinates. Mode and shell buttons must expose pressed/checked state. Add hover tooltip with label, dimensions and kilograms; selected geometry shows D × R × C, X/Y/Z and a rotation-axis indicator, while other boxes use reduced opacity `.55` without becoming unreadable.

- [ ] **Step 4: Synchronize focus with result table**

Add `onFocusPlacement?: (placementId: string) => void`; single click selects and double-click selects plus focuses. `PackingWorkspace` stores a monotonically changing `{ key, nonce }` request and derives the token without changing `ContainerSceneProps.focusToken`:

```ts
const focusToken = `${focusRequest.key}:${focusRequest.nonce}`;
```

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/packing/viewer-controls.test.tsx tests/packing/result-table.test.tsx tests/packing/viewer.test.tsx`

Expected: PASS.

```powershell
git add components/packing/viewer-controls.tsx components/packing/container-scene.tsx components/packing/packing-viewer.tsx components/packing/packing-result-table.tsx tests/packing/viewer-controls.test.tsx tests/packing/result-table.test.tsx
git commit -m "feat: add packing viewer hud and selection"
```

---

### Task 4: Add PIP, Quad View and observation modes

**Files:**
- Create: `components/packing/viewer-viewports.tsx`
- Create: `tests/packing/viewer-viewports.test.tsx`
- Modify: `components/packing/container-scene.tsx`
- Modify: `components/packing/packing-viewer.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: one scene data model, active preset, layout mode, shared selection, shell and render mode.
- Produces: `ViewportLayout = 'single' | 'pip' | 'quad'`, synchronized Top/Front PIP and four-preset Quad View.

- [ ] **Step 1: Write failing viewport and mode tests**

```tsx
it('switches between PIP and Quad View with synchronized selection', () => {
  renderViewer({ packedContainers: [packedContainer], step: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Quad View' }));
  expect(screen.getAllByLabelText(/viewport/i)).toHaveLength(4);
  expect(screen.getByText('Mặt trên')).toBeInTheDocument();
  expect(screen.getByText('Mặt trước')).toBeInTheDocument();
  expect(screen.getByText('Mặt bên')).toBeInTheDocument();
});

it.each(['Solid', 'X-Ray', 'Wireframe', 'Tải trọng', 'Chiều cao', 'Khoảng trống', 'Exploded View'])('exposes %s mode', (label) => {
  renderViewer({ packedContainers: [packedContainer], step: 1 });
  expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/packing/viewer-viewports.test.tsx`

Expected: FAIL because PIP, Quad View and the seven-mode toolbar do not exist.

- [ ] **Step 3: Implement viewport composition**

```tsx
type ViewerViewportsProps = {
  layout: 'single' | 'pip' | 'quad';
  mainPreset: ViewPreset;
  collapsedPip: ViewPreset[];
  sceneProps: Omit<ContainerSceneProps, 'preset'>;
  onMainPresetChange: (preset: ViewPreset) => void;
  onTogglePip: (preset: ViewPreset) => void;
};
```

Single mounts one scene. PIP mounts main plus Top and Front canvases only while expanded; clicking a PIP exchanges presets with main. Quad mounts iso/top/front/side with shared callbacks. On screens below 640 px, render one canvas with preset tabs rather than four canvases.

- [ ] **Step 4: Implement seven observation materials**

Solid uses source colors; X-Ray uses transparent depth-aware materials; Wireframe uses edges/material wireframe; weight/height use `getHeatColor`; Space mounts `getEmptyRegions` geometry only when active; Exploded shifts render positions by `layerIndex * .28` without mutating placements and renders the exact DOM banner `Chế độ quan sát – không phải vị trí thực tế`.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/packing/viewer-viewports.test.tsx tests/packing/viewer.test.tsx`

Expected: PASS.

```powershell
git add components/packing/viewer-viewports.tsx components/packing/container-scene.tsx components/packing/packing-viewer.tsx app/globals.css tests/packing/viewer-viewports.test.tsx
git commit -m "feat: add packing viewport layouts and modes"
```

---

### Task 5: Add animated playback and shell opening

**Files:**
- Create: `components/packing/viewer-playback.tsx`
- Create: `tests/packing/viewer-playback.test.tsx`
- Modify: `components/packing/packing-workspace.tsx`
- Modify: `components/packing/packing-viewer.tsx`
- Modify: `components/packing/container-scene.tsx`

**Interfaces:**
- Consumes: total placements, `step`, playback state, speed and reduced-motion preference.
- Produces: Play/Pause/Previous/Next, 0.5×/1×/2×, draggable slider, 450 ms placement animation and door opening.

- [ ] **Step 1: Write failing playback tests**

```tsx
it('plays, pauses and changes speed without exceeding the placement count', () => {
  vi.useFakeTimers();
  render(<ViewerPlayback step={0} total={2} playing={false} speed={1} onStepChange={onStep} onPlayingChange={onPlaying} onSpeedChange={onSpeed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
  expect(onPlaying).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Tốc độ 2×' }));
  expect(onSpeed).toHaveBeenCalledWith(2);
  expect(screen.getByText('Bước 0/2')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/packing/viewer-playback.test.tsx`

Expected: FAIL because `ViewerPlayback` does not exist.

- [ ] **Step 3: Implement playback state and timer**

```ts
const PLAYBACK_MS = 650;
const intervalMs = PLAYBACK_MS / speed;
```

Use an effect that schedules one next step, clears on pause/unmount and stops at `total`. Previous/Next clamp to `[0,total]`; slider stays controlled. When reduced motion is enabled, skip transform interpolation but keep state transitions.

- [ ] **Step 4: Animate placement and doors**

The entering box starts one box length outside positive-Z loading end and eases to its placement over 450 ms. It is cyan while moving and briefly emissive after landing. Door panels rotate open during the first 350 ms only when the front layer is enabled; do not rotate the camera.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/packing/viewer-playback.test.tsx tests/packing/workspace.test.tsx`

Expected: PASS.

```powershell
git add components/packing/viewer-playback.tsx components/packing/packing-workspace.tsx components/packing/packing-viewer.tsx components/packing/container-scene.tsx tests/packing/viewer-playback.test.tsx tests/packing/workspace.test.tsx
git commit -m "feat: animate packing playback"
```

---

### Task 6: Add manual transform, snap and validation

**Files:**
- Create: `lib/packing/manual-layout.ts`
- Create: `tests/packing/manual-layout.test.ts`
- Create: `components/packing/viewer-manual-controls.tsx`
- Create: `tests/packing/viewer-manual-controls.test.tsx`
- Modify: `components/packing/container-scene.tsx`
- Modify: `components/packing/packing-viewer.tsx`
- Modify: `components/packing/packing-workspace.tsx`

**Interfaces:**
- Consumes: current placements, selected key, container bounds, draft transform and `validateManualPlacement` from `src/binPacking.js`.
- Produces: `validatePlacementDraft`, `applyPlacementOverride`, snap `.01 | .05 | .10`, translate/rotate gizmo, errors and explicit override flow.

- [ ] **Step 1: Write failing adapter and control tests**

```ts
it('maps manual validation errors and blocks an invalid draft', () => {
  const result = validatePlacementDraft(container, placements, selected, { ...selected, x: -1 });
  expect(result).toEqual({ valid: false, errors: ['Vượt khỏi container'] });
});
```

```tsx
it('requires explicit override before applying an invalid placement', () => {
  render(<ViewerManualControls enabled selected={selected} validation={{ valid: false, errors: ['Va chạm kiện khác'] }} override={false} {...callbacks} />);
  expect(screen.getByRole('button', { name: 'Áp dụng vị trí' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cho phép ghi đè cảnh báo' }));
  expect(callbacks.onOverrideChange).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/packing/manual-layout.test.ts tests/packing/viewer-manual-controls.test.tsx`

Expected: FAIL because adapter and controls do not exist.

- [ ] **Step 3: Implement validation adapter**

```ts
const errorLabels = {
  bounds: 'Vượt khỏi container',
  collision: 'Va chạm kiện khác',
  unsupported: 'Không có bề mặt đỡ',
  'non-stackable-support': 'Đặt lên kiện không cho phép chồng',
  'non-stackable-floor': 'Kiện này phải nằm trên sàn',
  overweight: 'Vượt tải trọng container',
} as const;
```

Normalize the selected key into the candidate expected by `validateManualPlacement`, preserve dimensions after 90-degree rotations, and return stable Vietnamese error labels. Applying an override returns a new `PackedContainer` with only the selected placement copied and changed.

- [ ] **Step 4: Implement TransformControls and manual UI**

Mount Drei `TransformControls` only for the selected mesh and only in edit mode. Provide Translate/Rotate, X/Y/Z, snap 1/5/10 cm, Apply/Cancel and warning list. Invalid drafts use coral material; Apply stays disabled unless valid or override is checked. Reset override to false on selection/draft change.

- [ ] **Step 5: Persist presentation overrides in workspace**

Store overrides by `placementKey`; pass merged results to viewer and result table without invoking packing. Reset overrides on import, reset, container-mode change, strategy change or rerun optimization.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:unit -- tests/packing/manual-layout.test.ts tests/packing/viewer-manual-controls.test.tsx tests/packing/workspace.test.tsx`

Expected: PASS.

```powershell
git add lib/packing/manual-layout.ts components/packing/viewer-manual-controls.tsx components/packing/container-scene.tsx components/packing/packing-viewer.tsx components/packing/packing-workspace.tsx tests/packing/manual-layout.test.ts tests/packing/viewer-manual-controls.test.tsx tests/packing/workspace.test.tsx
git commit -m "feat: add validated manual placement editing"
```

---

### Task 7: Finish responsive styling, accessibility and browser smoke coverage

**Files:**
- Modify: `app/globals.css`
- Modify: `components/packing/packing-viewer.tsx`
- Modify: `components/packing/viewer-controls.tsx`
- Modify: `components/packing/viewer-viewports.tsx`
- Create: `playwright.config.ts`
- Create: `tests/e2e/packing-viewer.spec.ts`

**Interfaces:**
- Consumes: all completed viewer modules.
- Produces: desktop PIP/Quad layout, mobile preset tabs, keyboard labels, reduced-motion styles and real-browser smoke tests.

- [ ] **Step 1: Add the Playwright smoke test**

```ts
import { expect, test } from '@playwright/test';

test('operates the hybrid cutaway viewer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tối ưu xếp hàng' }).click();
  await expect(page.getByLabel('Hybrid Isometric Cutaway')).toBeVisible();
  await page.getByRole('button', { name: 'Vừa khung hình' }).click();
  await page.getByRole('button', { name: 'Quad View' }).click();
  await expect(page.getByText('Mặt trên')).toBeVisible();
  await page.getByRole('button', { name: 'Khoảng trống' }).click();
  await expect(page.getByLabel('Thể tích chưa sử dụng')).toBeVisible();
});
```

Create the test runner config exactly as follows:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'npm run start -- -p 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 2: Run the browser test and verify RED**

Run: `npm run build; npm run e2e -- tests/e2e/packing-viewer.spec.ts`

Expected: FAIL until final labels/layout/styles are connected.

- [ ] **Step 3: Add final responsive and accessibility behavior**

At desktop widths, main canvas uses at least 70% of the stage and PIP stays inside the lower/right safe area without covering HUD or toolbar. Under 640 px, replace PIP/Quad canvases with one canvas plus `Isometric/Mặt trên/Mặt trước/Mặt bên` tabs. Add visible focus states, pressed/checked states, `aria-live="polite"` for playback/error changes, and a reduced-motion block that disables door/box CSS transitions.

- [ ] **Step 4: Verify all layers**

Run: `npm run test:unit; npm run test:legacy; npm run build; npm run e2e -- tests/e2e/packing-viewer.spec.ts; git diff --check`

Expected: all unit, legacy, production build, smoke and whitespace checks pass.

- [ ] **Step 5: Commit**

```powershell
git add app/globals.css components/packing/packing-viewer.tsx components/packing/viewer-controls.tsx components/packing/viewer-viewports.tsx playwright.config.ts tests/e2e/packing-viewer.spec.ts
git commit -m "feat: finish hybrid packing viewer experience"
```

---

### Task 8: Final integration, performance check and Pages publish

**Files:**
- Verify all changed viewer files.
- No source edits expected unless verification exposes a defect; any defect must first receive a failing regression test in its owning test file.

**Interfaces:**
- Consumes: completed branch.
- Produces: reviewed production build and GitHub Pages deployment.

- [ ] **Step 1: Run full verification**

Run: `npm test; npm run build; npm run e2e -- tests/e2e/packing-viewer.spec.ts; git diff --check`

Expected: zero failures and a static `/` route.

- [ ] **Step 2: Check large-scene behavior**

Use the browser smoke fixture with 150 placements and verify the main canvas remains interactive, only enabled PIP/Quad canvases mount, Space mode geometry is absent while disabled, and playback does not create accumulating timers.

- [ ] **Step 3: Review the complete change against the approved spec**

Compare every acceptance criterion in `docs/superpowers/specs/2026-07-22-hybrid-isometric-cutaway-design.md` to code and tests. Fix Critical/Important findings through a failing test and repeat Step 1.

- [ ] **Step 4: Publish after authenticated push is available**

Run: `git push github HEAD:deploy-github`

Expected: GitHub Actions Pages workflow succeeds and `https://daiz123d.github.io/lllogicstic.github.io/` returns HTTP 200 with the new commit.
