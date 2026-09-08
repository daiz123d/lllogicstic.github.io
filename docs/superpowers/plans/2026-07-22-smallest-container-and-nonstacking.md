# Smallest Container and Non-stacking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the smallest usable sample container first, add another as needed, and keep cartons marked non-stackable on the container floor.

**Architecture:** Keep `findBestContainer` for legacy callers. Add a smallest-usable selector used only by `selectBestPresetContainers`: it evaluates preset containers in ascending volume and selects the first that packs at least one carton. Make automatic and manual validation agree that `stackable: false` means floor-only and cannot support other cartons.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Node.js native tests, existing `src/binPacking.js` heuristic.

## Global Constraints

- Preserve manual-container input, the standard sample catalog, carton units, import/export, and the 3D renderer.
- Stop preset selection if no candidate packs a carton; preserve unpacked cartons.
- A non-stackable carton must have `y = 0` and cannot have another carton above it.

---

### Task 1: Capture the two regressions

**Files:**
- Modify: `tests/packing/preset-selection.test.ts`
- Modify: `tests/binPacking.test.mjs`

**Interfaces:**
- Consumes: `packWithPresetContainers` and `packBoxes`.
- Produces: failing tests that demonstrate smallest-first selection and floor-only cartons.

- [ ] **Step 1: Replace the first preset-selection test**

```ts
it('fills the smallest usable sample before adding another container', () => {
  const result = packWithPresetContainers([{
    id: 'carton-1', label: 'Kiện dài', length: 3, width: 1.5, height: 1.5,
    quantity: 2, weight: 1, stackable: true, color: '#22d3ee',
  }], { allowRotation: false });

  expect(result.results.map((item) => item.container.name)).toEqual(['1.25T (VN)', '1.25T (VN)']);
  expect(result.leftover).toEqual([]);
});
```

- [ ] **Step 2: Add this Node regression after the existing non-stackable-support test**

```js
test('does not place a non-stackable box above another carton', () => {
  const result = packBoxes(1, 2, 1, [
    { id: 'base', width: 1, height: 1, length: 1, quantity: 1, weight: 1, stackable: true },
    { id: 'no-stack', width: 1, height: 1, length: 1, quantity: 1, weight: 1, stackable: false },
  ]);

  assert.equal(result.packed.length, 1);
  assert.equal(result.unpacked.length, 1);
  assert.equal(result.unpacked[0].id, 'no-stack');
});
```

- [ ] **Step 3: Verify RED**

Run: `npm run test:unit -- tests/packing/preset-selection.test.ts; node --test tests/binPacking.test.mjs`

Expected: the current result chooses `8T (VN)` for the first test and packs both cartons for the second test.

- [ ] **Step 4: Commit the regression tests**

```powershell
git add tests/packing/preset-selection.test.ts tests/binPacking.test.mjs
git commit -m "test: cover smallest presets and floor-only cartons"
```

### Task 2: Implement smallest-first selection and floor-only placement

**Files:**
- Modify: `src/binPacking.js`

**Interfaces:**
- Produces: `selectBestPresetContainers(boxes, options)` selecting repeated small presets, while `findBestContainer` remains unchanged.

- [ ] **Step 1: Add a private smallest-usable finder before `selectBestPresetContainers`**

```js
function findSmallestUsableContainer(boxes, options = {}) {
    const packingBoxes = normalizePackingBoxes(boxes);
    const totalBoxes = countPackingBoxes(packingBoxes);
    const presets = [...containerPresets].sort((a, b) =>
        (a.length * a.width * a.height) - (b.length * b.width * b.height)
    );

    for (const container of presets) {
        const result = packBoxes(container.width, container.height, container.length, packingBoxes, container.maxWeight || 0, options);
        if (result.packed.length === 0) continue;

        const unpacked = result.unpacked || [];
        return {
            ...container,
            fitsAll: unpacked.length === 0 && result.packed.length >= totalBoxes,
            packed: result.packed,
            unpacked,
            packedCount: result.packed.length,
            totalBoxes,
            totalWeight: result.packed.reduce((sum, box) => sum + (box.weight || 0), 0),
            leftover: unpacked.length,
        };
    }
    return null;
}
```

- [ ] **Step 2: Replace the preset-loop candidate lookup and retain its non-progress guard**

```js
while (countPackingBoxes(remaining) > 0 && results.length < maxContainers) {
    const best = findSmallestUsableContainer(remaining, options);
    if (!best || best.packedCount <= 0) break;

    results.push({
        container: { name: best.name, width: best.width, height: best.height, length: best.length, maxWeight: best.maxWeight || 0, presetName: best.name },
        packed: best.packed,
        unpacked: best.unpacked,
        fitsAll: best.fitsAll,
    });
    remaining = best.unpacked.map(box => ({ ...box, quantity: 1 }));
}
```

- [ ] **Step 3: Include `stackable` in the automatic placement candidate and reject it above ground**

```js
function isSupported(candidate) {
    const epsilon = 1e-9;
    if (candidate.y <= epsilon) return true;
    if (candidate.stackable === false) return false;
    return packed.some(support => (
        support.stackable !== false &&
        Math.abs((support.y + support.height) - candidate.y) <= epsilon &&
        candidate.x >= support.x - epsilon && candidate.z >= support.z - epsilon &&
        candidate.x + candidate.width <= support.x + support.width + epsilon &&
        candidate.z + candidate.length <= support.z + support.length + epsilon
    ));
}

// In canPlaceAt, add this property to candidate:
stackable: orientation.stackable,
```

- [ ] **Step 4: Add the matching manual-validation error before the existing `non-stackable-support` condition**

```js
if (normalized.stackable === false && normalized.y > epsilon) {
    errors.push('non-stackable-floor');
}
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm run test:unit -- tests/packing/preset-selection.test.ts; node --test tests/binPacking.test.mjs; npm test`

Expected: both new tests pass and all existing tests remain green.

```powershell
git add src/binPacking.js
git commit -m "feat: use smallest presets and enforce floor-only cartons"
```

### Task 3: Summarize repeated sample containers and deploy

**Files:**
- Modify: `components/packing/packing-workspace.tsx`
- Modify: `tests/packing/workspace.test.tsx`

**Interfaces:**
- Consumes: `PackingResult['results']`.
- Produces: stage status text such as `Đã tự chọn 2 × 1.25T (VN) để xếp 4 kiện`.

- [ ] **Step 1: Add a failing workspace assertion**

```ts
expect(screen.getByText(/đã tự chọn 2 × 1\.25T \(VN\) để xếp 4 kiện/i)).toBeInTheDocument();
```

- [ ] **Step 2: Add and use this helper in `packing-workspace.tsx`**

```ts
function summarizeSelectedContainers(results: PackingResult['results']) {
  const counts = new Map<string, number>();
  results.forEach(({ container }) => counts.set(container.name, (counts.get(container.name) ?? 0) + 1));
  return [...counts].map(([name, count]) => `${count} × ${name}`).join(', ');
}

const selectedNames = summarizeSelectedContainers(nextResult.results);
```

- [ ] **Step 3: Verify and deploy**

Run: `npm test; npm run build; git diff --check; git push github HEAD:deploy-github`

Expected: all tests and the static build succeed; the GitHub Pages workflow deploys the branch.
