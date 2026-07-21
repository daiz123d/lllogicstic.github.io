# Preset Container Autoselection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let optimisation automatically choose standard sample containers until all cartons are packed or no sample can make progress.

**Architecture:** Add a typed adapter around the legacy `selectBestPresetContainers` heuristic. `PackingWorkspace` chooses that adapter by default and keeps the current manual-container path as an alternative. The Inspector exposes the mode and a read-only catalog; all consumers retain the existing `PackingResult` shape.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, existing `src/binPacking.js` engine.

## Global Constraints

- Keep Three.js `0.183.2` and the current React Three Fiber renderer.
- Do not alter `src/binPacking.js` packing heuristics or backend contracts.
- Evaluate all existing `containerPresets`; no manual preselection is required.
- Preserve manual-container mode, carton import/export, and existing result/3D selection behavior.

---

### Task 1: Typed preset-selection adapter

**Files:**
- Modify: `lib/packing/engine.ts`
- Test: `tests/packing/preset-selection.test.ts`

**Consumes:** `CartonInput`, `PackingOptions`, `PackingResult`, `containerPresets`, and legacy `selectBestPresetContainers`.

**Produces:** `sampleContainers` and `packWithPresetContainers(cartons, options): PackingResult`.

- [ ] **Step 1: Write the failing adapter tests**

```ts
it('selects a standard container with a stable id', () => {
  const result = packWithPresetContainers([sampleCarton], { allowRotation: false });
  expect(result.results[0].container).toMatchObject({ id: 'preset-1', name: '2.5T (VN)' });
  expect(result.leftover).toEqual([]);
});

it('adds another preset when cartons remain', () => {
  const result = packWithPresetContainers([longCartons], { allowRotation: false });
  expect(result.results).toHaveLength(2);
  expect(result.leftover).toEqual([]);
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `npm run test:unit -- tests/packing/preset-selection.test.ts`

Expected: FAIL because `packWithPresetContainers` is not exported.

- [ ] **Step 3: Implement the typed adapter**

```ts
export const sampleContainers = containerPresets.map((preset) => ({ ...preset, quantity: 1 }));

export function packWithPresetContainers(cartons: CartonInput[], options: PackingOptions = {}): PackingResult {
  const legacy = legacySelectBestPresetContainers(cartons, options);
  return {
    results: legacy.results.map((item, index) => ({
      container: { ...item.container, id: `preset-${index + 1}` },
      packed: item.packed,
      unpacked: item.unpacked,
    })),
    leftover: legacy.leftover,
  } as PackingResult;
}
```

- [ ] **Step 4: Run the adapter test to verify it passes**

Run: `npm run test:unit -- tests/packing/preset-selection.test.ts`

Expected: PASS with two tests.

- [ ] **Step 5: Commit**

Run: `git add lib/packing/engine.ts tests/packing/preset-selection.test.ts; git commit -m "feat: expose preset container selection"`

### Task 2: Automatic sample-mode controls

**Files:**
- Modify: `components/packing/inspector.tsx`
- Modify: `components/packing/packing-workspace.tsx`
- Modify: `app/globals.css`
- Test: `tests/packing/inspector.test.tsx`
- Test: `tests/packing/workspace.test.tsx`

**Consumes:** `sampleContainers`, `packWithPresetContainers`, `ContainerInput`, and existing Inspector callbacks.

**Produces:** `containerMode: 'presets' | 'manual'`, defaulting to `'presets'`.

- [ ] **Step 1: Write failing mode tests**

```tsx
fireEvent.click(screen.getByRole('tab', { name: /container/i }));
expect(screen.getByRole('radio', { name: /tự chọn container mẫu/i })).toBeChecked();
expect(screen.getByText('1.25T (VN)')).toBeVisible();
```

```tsx
render(<PackingWorkspace />);
fireEvent.click(screen.getByRole('button', { name: /tối ưu xếp hàng/i }));
expect(screen.getAllByText(/2.5T \(VN\)/i)[0]).toBeVisible();
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm run test:unit -- tests/packing/inspector.test.tsx tests/packing/workspace.test.tsx`

Expected: FAIL because the auto-sample radio and selected sample output do not exist.

- [ ] **Step 3: Add selection mode and catalog**

```ts
type ContainerMode = 'presets' | 'manual';
const [containerMode, setContainerMode] = useState<ContainerMode>('presets');
const nextResult = containerMode === 'presets'
  ? packWithPresetContainers(cartons, { allowRotation, strategy })
  : packMultipleContainers(containers, cartons, { allowRotation, strategy });
```

Render the catalog read-only in automatic mode; render editable container records only in manual mode. Changing mode clears the stale result and resets playback.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm run test:unit -- tests/packing/inspector.test.tsx tests/packing/workspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add components/packing/inspector.tsx components/packing/packing-workspace.tsx app/globals.css tests/packing/inspector.test.tsx tests/packing/workspace.test.tsx; git commit -m "feat: optimize with sample containers by default"`

### Task 3: Result explanation and verification

**Files:**
- Modify: `components/packing/packing-workspace.tsx`
- Modify: `tests/packing/workspace.test.tsx`

**Consumes:** `PackingResult.results` whose container names are sample presets.

**Produces:** A visible explanation that lists the chosen samples and preserves unplaced-carton warnings.

- [ ] **Step 1: Write a failing workspace assertion**

```tsx
expect(screen.getByText(/đã tự chọn container mẫu/i)).toBeVisible();
```

- [ ] **Step 2: Run the workspace test to verify it fails**

Run: `npm run test:unit -- tests/packing/workspace.test.tsx`

Expected: FAIL because the result header has no automatic-selection explanation.

- [ ] **Step 3: Add result wording**

```tsx
{containerMode === 'presets' && <p className="result-source">Đã tự chọn container mẫu theo lượng hàng còn lại.</p>}
```

- [ ] **Step 4: Run all validation**

Run: `npm test; npm run build`

Expected: all Vitest and legacy tests pass; Next static export succeeds.

- [ ] **Step 5: Commit and deploy**

Run: `git add components/packing/packing-workspace.tsx tests/packing/workspace.test.tsx; git commit -m "feat: explain automatic sample recommendations"; git push github HEAD:deploy-github`
