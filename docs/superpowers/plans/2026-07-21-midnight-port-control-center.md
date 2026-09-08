# Midnight Port Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the packing interface as a responsive Midnight Port Command Center while keeping the existing browser-side packing algorithm and React Three Fiber renderer.

**Architecture:** Extract workspace state from the current monolithic component, then compose it through a fixed-height application shell, telemetry strip, simulation stage, tabbed inspector, and synchronized result table. Domain modules remain framework-independent; all visual components consume state callbacks and typed packing results.

**Tech Stack:** Next.js static export, React 19, TypeScript, React Three Fiber, Drei, Three.js 0.183, Lucide React, XLSX, Vitest, Testing Library.

## Global Constraints

- Preserve the current React Three Fiber and Three.js 0.183 renderer; do not downgrade to Three.js r134.
- Keep packing execution entirely in the browser and preserve rotation, weight, stacking, strategy, and multi-container behavior.
- Preserve CSV, JSON, XLSX, and XLS import/export support; do not change input field meanings.
- Do not add API URLs, secrets, or fake production data to the frontend.
- Use Midnight Port tokens: `#07131F`, `#0D1B2A`, `#122235`, `#22D3EE`, `#2DD4BF`, `#FBBF24`, `#FB7185`, `#F4F8FB`, and `#8FA6B9`.
- Target a 100dvh desktop app with independent scrolling regions, WCAG AA focus treatment, 44px minimum controls, and reduced-motion support.

---

### Task 1: Install the icon system and establish the control-center shell

**Files:**
- Modify: `package.json`
- Create: `components/control-center/sidebar.tsx`
- Create: `components/control-center/command-bar.tsx`
- Create: `components/control-center/kpi-strip.tsx`
- Create: `components/control-center/control-center-shell.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/control-center/shell.test.tsx`

**Interfaces:**
- Consumes: `KpiMetric[]`, `onOptimize()`, `onReset()`, and `onImport()`.
- Produces: `ControlCenterShell` with named `navigation`, `commandBar`, `kpis`, and `children` slots.

- [ ] **Step 1: Write the failing shell test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { ControlCenterShell } from '@/components/control-center/control-center-shell';

it('collapses the navigation rail without hiding its accessible labels', () => {
  render(<ControlCenterShell commandBar={<div />} kpis={[]}><div>Canvas</div></ControlCenterShell>);
  fireEvent.click(screen.getByRole('button', { name: /thu gọn thanh điều hướng/i }));
  expect(screen.getByRole('navigation', { name: /điều hướng chính/i })).toHaveAttribute('data-collapsed', 'true');
  expect(screen.getByRole('link', { name: /trình mô phỏng 3d/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/control-center/shell.test.tsx`

Expected: FAIL because `ControlCenterShell` does not exist.

- [ ] **Step 3: Implement the shell**

Run: `npm install lucide-react`

Create `KpiMetric` as `{ id: string; label: string; value: number; status: string; progress: number; tone: 'cyan' | 'teal' | 'amber' | 'coral' }`. Build a 240px/72px collapsible `Sidebar` with `LayoutDashboard`, `Box`, `Container`, `Package`, `History`, and `Radar` icons. `CommandBar` receives project title, auto-save state, import/reset controls, and the primary `Tối ưu xếp hàng` button. `KpiStrip` renders compact telemetry meters rather than white cards. Wrap the app in `ControlCenterShell` and use semantic `nav`, `header`, and `main` landmarks.

Add root CSS variables, Be Vietnam Pro font stack, 100dvh grid layout, high-contrast focus rings, and the desktop/laptop shell breakpoints. Do not change packing inputs or algorithm calls in this task.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/control-center/shell.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: static export succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app components/control-center tests/control-center
git commit -m "feat: add control center application shell"
```

### Task 2: Extract typed workspace state and build the tabbed inspector

**Files:**
- Create: `hooks/use-packing-workspace.ts`
- Create: `components/packing/inspector.tsx`
- Create: `components/packing/carton-list.tsx`
- Create: `components/packing/container-list.tsx`
- Modify: `components/packing/packing-workspace.tsx`
- Test: `tests/packing/inspector.test.tsx`

**Interfaces:**
- Consumes: `ContainerInput`, `CartonInput`, `PackingResult`, and `PackingStrategy`.
- Produces: `usePackingWorkspace()` returning `{ containers, cartons, result, selectedPlacementId, step, optimize, reset, updateContainer, updateCarton, addContainer, addCarton, removeContainer, removeCarton, setStrategy, setAllowRotation }`.

- [ ] **Step 1: Write the failing inspector test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { Inspector } from '@/components/packing/inspector';

it('shows cargo controls only after the Cargo tab is selected', () => {
  render(<Inspector state={createPackingWorkspaceState()} />);
  fireEvent.click(screen.getByRole('tab', { name: /hàng hóa/i }));
  expect(screen.getByRole('button', { name: /thêm vào danh sách/i })).toBeVisible();
  expect(screen.getByLabelText(/dài.*m/i)).toBeVisible();
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/packing/inspector.test.tsx`

Expected: FAIL because `Inspector` and `createPackingWorkspaceState` do not exist.

- [ ] **Step 3: Implement state and inspector tabs**

Move all state mutation and optimization code from `packing-workspace.tsx` to `use-packing-workspace.ts`. Export `createPackingWorkspaceState()` from the hook module for deterministic component-test setup.

Implement `Inspector` with ARIA tabs: `Hàng hóa`, `Container`, `Chiến lược`, and `Import`. Every numeric field has a label and unit suffix; invalid fields use `aria-invalid` and a direct Vietnamese error message. Implement compact editable carton/container rows with duplicate and delete actions. Use a searchable standard-container chooser rather than rendering a long preset table.

Keep the current default values only as initial local form state; do not create data during rendering. `PackingWorkspace` becomes an orchestrator that passes the state object to shell, inspector, viewer, and table.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/packing/inspector.test.tsx tests/packing/workspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks components/packing tests/packing
git commit -m "feat: add tabbed packing inspector"
```

### Task 3: Restore browser import/export with visible row validation

**Files:**
- Create: `lib/packing/container-import.ts`
- Create: `lib/packing/file-io.ts`
- Modify: `lib/packing/import.ts`
- Modify: `components/packing/inspector.tsx`
- Test: `tests/packing/file-io.test.ts`

**Interfaces:**
- Consumes: a browser `File`, field rows, `CartonInput`, and `ContainerInput`.
- Produces: `readPackingFile(file): Promise<Record<string, unknown>[]>`, `parseContainerRows(rows): { containers: Omit<ContainerInput, 'id'>[]; skipped: number }`, `downloadPackingWorkbook(cartons, containers, result): void`.

- [ ] **Step 1: Write the failing parser test**

```ts
import { expect, it } from 'vitest';
import { parseContainerRows } from '@/lib/packing/container-import';

it('imports Vietnamese container headers and reports malformed rows', () => {
  const parsed = parseContainerRows([
    { Tên: '20ft', Dài: 6, Rộng: 2.4, Cao: 2.6, 'Tải trọng': 28000, SL: 2 },
    { Tên: 'Sai', Dài: 0, Rộng: 2, Cao: 2 },
  ]);
  expect(parsed.containers).toHaveLength(1);
  expect(parsed.skipped).toBe(1);
  expect(parsed.containers[0]).toMatchObject({ name: '20ft', quantity: 2, maxWeight: 28000 });
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/packing/file-io.test.ts`

Expected: FAIL because `parseContainerRows` does not exist.

- [ ] **Step 3: Implement import/export adapters**

Use `FileReader` for JSON/CSV and `XLSX.read` for XLS/XLSX. Reuse `parseCartonRows` and add normalised Vietnamese/English aliases for container name, dimensions, capacity, and quantity. The Import tab must show selected filename, accepted count, skipped count, and an inline reason when the extension is unsupported.

Create a workbook with `Cartons`, `Containers`, and (when present) `PackingResult` sheets. Keep downloads strictly browser-initiated from an export button in the command bar; never call `XLSX.writeFile` during render.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/packing/file-io.test.ts tests/packing/import.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/packing components/packing/inspector.tsx tests/packing/file-io.test.ts
git commit -m "feat: restore validated packing file exchange"
```

### Task 4: Upgrade the simulation stage and synchronize result selection

**Files:**
- Create: `components/packing/simulation-toolbar.tsx`
- Create: `components/packing/utilization-meter.tsx`
- Create: `components/packing/packing-result-table.tsx`
- Modify: `components/packing/packing-viewer.tsx`
- Modify: `components/packing/packing-workspace.tsx`
- Test: `tests/packing/result-table.test.tsx`

**Interfaces:**
- Consumes: `PackedContainer[]`, `Placement`, `selectedPlacementId`, `step`, and an `onSelectPlacement(id)` callback.
- Produces: `SimulationToolbar`, `UtilizationMeter`, and `PackingResultTable`; all resolve keys with `placementKey(containerId, placement)`.

- [ ] **Step 1: Write the failing selection test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { PackingResultTable } from '@/components/packing/packing-result-table';

it('selects the matching placement key from a result row', () => {
  const select = vi.fn();
  render(<PackingResultTable packedContainers={[packedContainerFixture]} selectedPlacementId={null} onSelectPlacement={select} />);
  fireEvent.click(screen.getByRole('row', { name: /hộp mẫu/i }));
  expect(select).toHaveBeenCalledWith('container-1:1');
});
```

- [ ] **Step 2: Verify red**

Run: `npm run test:unit -- tests/packing/result-table.test.tsx`

Expected: FAIL because `PackingResultTable` does not exist.

- [ ] **Step 3: Implement the simulation controls**

Keep one canvas mounted while toggling camera/display state. Add perspective, top, side, front, reset, label, wireframe, and fullscreen controls to `SimulationToolbar`; update the active R3F camera/control state rather than recreating the canvas. Add hover/select labels in the canvas from real placement fields.

`UtilizationMeter` calculates used volume/container volume and used weight/maxWeight from `PackedContainer`; render the two compact ring/telemetry values in the canvas corner. Show the empty-state instructions only when no placements exist.

Create a sticky-header `PackingResultTable` with search, status filter, compact/comfortable density, arrow-key focus, and cyan selected-row treatment. Clicks call the same `onSelectPlacement` callback the 3D meshes use. Show leftover cartons below it with `oversize`, `overweight`, or `no-space` labels.

- [ ] **Step 4: Verify green**

Run: `npm run test:unit -- tests/packing/result-table.test.tsx tests/packing/viewer.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: static export succeeds without server-only APIs.

- [ ] **Step 5: Commit**

```bash
git add components/packing tests/packing app/globals.css
git commit -m "feat: add synchronized simulation controls"
```

### Task 5: Apply responsive, accessibility, and motion verification

**Files:**
- Create: `tests/e2e/control-center.spec.ts`
- Create: `playwright.config.ts`
- Modify: `app/globals.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: the static Next.js build at `http://127.0.0.1:3000`.
- Produces: a desktop/laptop/tablet/mobile browser verification flow.

- [ ] **Step 1: Write the failing browser test**

```ts
import { expect, test } from '@playwright/test';

test('shows a full-width stage and inspector drawer on tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /mở inspector/i })).toBeVisible();
  await expect(page.getByLabel(/trình xem xếp thùng/i)).toBeVisible();
});
```

- [ ] **Step 2: Verify red**

Run: `npx playwright test tests/e2e/control-center.spec.ts`

Expected: FAIL because the drawer trigger and Playwright configuration do not exist.

- [ ] **Step 3: Implement final responsive and accessible states**

Configure Playwright with a `webServer` of `npm run dev` on port 3000. Add CSS media rules for the 1440px, 1024px, 768px, and 480px layouts; use a toggleable, focus-trapped inspector drawer below 1024px and result-first cards below 480px. Add `@media (prefers-reduced-motion: reduce)` to disable nonessential transitions and stop autoplay.

Use 150–220ms transitions only for navigation, tabs, buttons, drawers, and KPI result changes. Add visible empty, loading, success, warning, and error states. Document local commands and the browser-accessibility behaviour in `README.md`.

- [ ] **Step 4: Verify complete build**

Run: `npm run test`

Expected: all unit, component, and legacy packing tests PASS.

Run: `npm run build`

Expected: static export succeeds.

Run: `npx playwright install chromium`

Run: `npm run e2e`

Expected: responsive browser test PASS.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tests/e2e playwright.config.ts README.md
git commit -m "test: verify responsive control center"
```

## Self-review

- Coverage: Task 1 provides the shell, visual system, and telemetry; Task 2 provides state, inspector, validation, and list management; Task 3 preserves file exchange; Task 4 makes the simulation primary and synchronizes the table; Task 5 verifies responsive, keyboard, reduced-motion, and static deployment conditions.
- Placeholder scan: no deferred implementation markers or undefined interface names are used.
- Type consistency: `ContainerInput`, `CartonInput`, `PackingResult`, `PackedContainer`, `Placement`, and `placementKey` remain the only packing contracts across the shell, inspector, viewer, and table.
