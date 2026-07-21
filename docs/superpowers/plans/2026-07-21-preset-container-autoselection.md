# Preset Container Autoselection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the optimisation action choose the best standard sample container repeatedly until all cartons are packed or no preset can make progress.

**Architecture:** Keep `src/binPacking.js` as the packing authority and add a typed Next.js adapter that converts its preset results into the existing `PackingResult` shape. Add an automatic/manual container mode to the workspace and show the standard catalog in the inspector while automatic mode is active; manual containers remain available as an explicit mode.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, existing JavaScript packing engine, Vitest and Testing Library.

## Global Constraints

- Reuse the existing `containerPresets` and `selectBestPresetContainers` logic from `src/binPacking.js`.
- Do not change carton import/export formats, backend contracts, or packing heuristics.
- Keep Three.js `0.183.2` and the current R3F renderer unchanged.
- Preserve the existing manual-container mode and current result/3D viewer contracts.
- Do not stage unrelated user files: `__pycache__/`, `openrouter_chat.py`, `tests/shopLogic.test.mjs`, `tests/test_openrouter.py`.

---

### Task 1: Add a typed preset-selection adapter

**Files:**
- Create: `lib/packing/presets.ts`
- Modify: `lib/packing/types.ts`
- Test: `tests/packing/presets.test.ts`

**Interfaces:**
- Consumes `CartonInput[]` and optional `allowRotation`/`strategy` options.
- Produces `PackingResult` with stable `preset-<index>` container IDs, container names, packed placements, and leftovers.

- [ ] **Step 1: Write the failing tests** for a single preset fit and a multi-preset remainder.

```ts
it('selects the smallest preset that fits all cartons', () => {
  const result = packPresetContainers([{ id: 'box', label: 'Box', length: 1, width: 1, height: 1, quantity: 2, weight: 1, color: '#22d3ee', stackable: true }]);
  expect(result.results).toHaveLength(1);
  expect(result.results[0].container.name).toBe('1.25T (VN)');
  expect(result.leftover).toHaveLength(0);
});

it('adds another preset until all cartons are packed', () => {
  const result = packPresetContainers([{ id: 'oversize', label: 'Oversize', length: 4, width: 2, height: 2, quantity: 2, weight: 10, color: '#22d3ee', stackable: true }]);
  expect(result.results.length).toBeGreaterThan(1);
  expect(result.results.reduce((sum, item) => sum + item.packed.length, 0)).toBe(2);
  expect(result.leftover).toHaveLength(0);
});
```

- [ ] **Step 2: Run the focused test and verify it fails** because `packPresetContainers` does not exist.

```powershell
npm run test:unit -- tests/packing/presets.test.ts
```

- [ ] **Step 3: Implement the adapter** by calling `selectBestPresetContainers`, adding stable IDs, normalising placement IDs/labels where legacy results omit them, and mapping the final remaining boxes to the existing `Leftover[]` type.

- [ ] **Step 4: Run the focused test and the legacy preset tests**.

```powershell
npm run test:unit -- tests/packing/presets.test.ts
npm run test:legacy -- --test-name-pattern="preset"
```

- [ ] **Step 5: Commit** the adapter and tests.

```powershell
git add lib/packing/types.ts lib/packing/presets.ts tests/packing/presets.test.ts
git commit -m "feat: expose standard preset container selection"
```

### Task 2: Add automatic/manual mode to the packing workspace

**Files:**
- Modify: `components/packing/inspector.tsx`
- Modify: `components/packing/packing-workspace.tsx`
- Modify: `lib/packing/engine.ts`
- Test: `tests/packing/workspace.test.tsx`

**Interfaces:**
- `containerMode` is `'preset' | 'manual'`, defaulting to `'preset'`.
- Automatic mode calls `packPresetContainers(cartons, { allowRotation, strategy })`.
- Manual mode continues calling `packMultipleContainers(containers, cartons, options)`.

- [ ] **Step 1: Extend the workspace test** to click the strategy tab, select “Tự chọn container mẫu”, run optimisation, and assert the result names a standard preset.

- [ ] **Step 2: Run the workspace test and verify it fails** because the mode control and preset path are not connected.

```powershell
npm run test:unit -- tests/packing/workspace.test.tsx
```

- [ ] **Step 3: Add the mode state and callback** to `PackingWorkspace`, route `runPacking` to the preset adapter when mode is `'preset'`, clear stale results when mode or strategy changes, and keep the existing manual path unchanged.

- [ ] **Step 4: Add the mode selector** to the Strategy inspector with clear labels: “Tự chọn container mẫu” and “Dùng container tự nhập”.

- [ ] **Step 5: Run the focused workspace and inspector tests** and confirm the automatic result renders a preset container.

```powershell
npm run test:unit -- tests/packing/workspace.test.tsx tests/packing/inspector.test.tsx
```

- [ ] **Step 6: Commit** the mode integration.

```powershell
git add components/packing/inspector.tsx components/packing/packing-workspace.tsx lib/packing/engine.ts tests/packing/workspace.test.tsx
git commit -m "feat: optimize with standard container presets"
```

### Task 3: Show the sample catalog and verify the complete flow

**Files:**
- Modify: `components/packing/inspector.tsx`
- Modify: `app/globals.css`
- Test: `tests/packing/inspector.test.tsx`

**Interfaces:**
- The catalog is read-only in preset mode and uses the existing `containerPresets` data.
- The result panel and `PackingViewer` consume the same `PackingResult` regardless of mode.

- [ ] **Step 1: Write a failing inspector test** asserting the preset catalog shows names and dimensions while automatic mode is selected.

- [ ] **Step 2: Run the test and verify it fails** because the catalog is not rendered.

```powershell
npm run test:unit -- tests/packing/inspector.test.tsx
```

- [ ] **Step 3: Render the compact read-only catalog** in the Container tab for preset mode and keep editable cards for manual mode.

- [ ] **Step 4: Add only the required table styles** for the catalog, including narrow-screen horizontal scrolling and accessible focus states.

- [ ] **Step 5: Run the full verification suite and static build**.

```powershell
npm test
npm run build
git diff --check
```

- [ ] **Step 6: Commit and push the verified branch**.

```powershell
git add components/packing/inspector.tsx app/globals.css tests/packing/inspector.test.tsx
git commit -m "feat: display standard container catalog"
git push github HEAD:deploy-github
```
