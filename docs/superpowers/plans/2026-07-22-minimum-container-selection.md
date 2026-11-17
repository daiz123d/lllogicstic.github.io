# Minimum Container Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore automatic selection that minimizes preset-container count before minimizing excess capacity, while retaining floor-only non-stacking behavior.

**Architecture:** Reuse `findBestContainer`, which selects the smallest preset that fits all remaining cartons or otherwise leaves the fewest cartons unpacked. `selectBestPresetContainers` will call this scorer for each remaining batch instead of the current smallest-usable scorer. The compact workspace summary remains and reports the selected container count.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Node.js native tests, `src/binPacking.js`.

## Global Constraints

- First priority is the fewest containers; second priority is the least unused practical capacity.
- Preserve floor-only non-stacking, manual validation, catalog, units, import/export, and renderer.
- Stop on non-progress and retain cartons no standard preset can pack.

---

### Task 1: Restore minimum-container selection with regression coverage

**Files:**
- Modify: `tests/packing/preset-selection.test.ts`
- Modify: `tests/packing/workspace.test.tsx`
- Modify: `src/binPacking.js`

**Interfaces:**
- Consumes: `findBestContainer(boxes, options)` and `packWithPresetContainers(cartons, options)`.
- Produces: one `8T (VN)` for two 1.5 × 1.5 × 3 m cartons and one `2.5T (VN)` for the workspace's four default cartons.

- [ ] **Step 1: Change the first preset test to this fewest-container test**

```ts
it('prefers one practical sample over multiple smaller containers', () => {
  const result = packWithPresetContainers([{
    id: 'carton-1', label: 'Kiện dài', length: 3, width: 1.5, height: 1.5,
    quantity: 2, weight: 1, stackable: true, color: '#22d3ee',
  }], { allowRotation: false });

  expect(result.results.map((item) => item.container.name)).toEqual(['8T (VN)']);
  expect(result.leftover).toEqual([]);
});
```

- [ ] **Step 2: Replace the workspace status assertion with this one**

```ts
expect(screen.getByText(/đã tự chọn 1 × 2\.5T \(VN\) để xếp 4 kiện/i)).toBeInTheDocument();
```

- [ ] **Step 3: Verify RED**

Run: `npm run test:unit -- tests/packing/preset-selection.test.ts tests/packing/workspace.test.tsx`

Expected: current smallest-first behavior returns two `1.25T (VN)` containers and fails both assertions.

- [ ] **Step 4: Replace the smallest-usable candidate with the existing minimum-container scorer**

```js
while (countPackingBoxes(remaining) > 0 && results.length < maxContainers) {
    const remainingCount = countPackingBoxes(remaining);
    const best = findBestContainer(remaining, options);

    if (!best || best.packedCount <= 0 || best.leftover >= remainingCount) break;

    results.push({
        container: { name: best.name, width: best.width, height: best.height, length: best.length, maxWeight: best.maxWeight || 0, presetName: best.name },
        packed: best.packed,
        unpacked: best.unpacked,
        fitsAll: best.fitsAll,
    });
    remaining = best.unpacked.map(box => ({ ...box, quantity: 1 }));
}
```

Delete the now-unused private `findSmallestUsableContainer`. Do not modify `findBestContainer` or non-stacking logic.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test; npm run build; git diff --check`

Expected: all tests and the production build pass with zero diff-whitespace errors.

```powershell
git add src/binPacking.js tests/packing/preset-selection.test.ts tests/packing/workspace.test.tsx
git commit -m "fix: prioritize minimum container count"
```

### Task 2: Publish the corrected selection policy

**Files:**
- Verify only; no additional source changes expected.

- [ ] **Step 1: Push and verify Pages**

Run: `git push github HEAD:deploy-github`

Expected: GitHub Actions succeeds and the live site returns HTTP 200.
