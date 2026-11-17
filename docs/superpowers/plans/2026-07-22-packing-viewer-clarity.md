# Packing Viewer Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 3D packing results readable by focusing the camera on cargo, rendering an open container shell, and exposing fill and floor-only status.

**Architecture:** Keep `PackingViewer` as the presentation boundary. Local view helpers derive cargo bounds and metrics from `PackedContainer`; the packer remains unchanged.

**Tech Stack:** Next.js 16, React, React Three Fiber, Drei, Vitest, Testing Library.

## Global Constraints

- Do not change packing algorithms, selection policy, carton input, or playback behavior.
- Floor-only indicators describe `stackable: false`; they do not change packing coordinates.
- Preserve 3D/2D switch, camera controls, selection, and WebGL fallback.

---

### Task 1: Add viewer clarity metrics and visual treatment

**Files:**
- Modify: `tests/packing/viewer.test.tsx`
- Modify: `components/packing/packing-viewer.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PackedContainer` and `Placement` from `lib/packing/types.ts`.
- Produces: packed-count, volume-fill, floor-only status, a cargo-focused scene, and accessible 2D labels.

- [ ] **Step 1: Add a packed fixture and failing metric test**

```tsx
const floorOnlyContainer: PackedContainer = {
  container: { id: 'container-1', name: '5T (VN)', width: 2, height: 2, length: 4, maxWeight: 4800 },
  packed: [{ id: 'box-1', label: 'Kiện sàn', width: 1, height: 1, length: 1, color: '#36c5f0', weight: 1, stackable: false, x: 0, y: 0, z: 0, order: 1, sourceIndex: 0, itemIndex: 0 }],
  unpacked: [],
};

it('shows fill and floor-only status for the active container', () => {
  render(<PackingViewer packedContainers={[floorOnlyContainer]} selectedPlacementId={null} onSelectPlacement={() => {}} step={1} />);
  expect(screen.getByText('1 kiện')).toBeInTheDocument();
  expect(screen.getByText('Lấp đầy 6.3%')).toBeInTheDocument();
  expect(screen.getByText('1 kiện nằm sàn')).toBeInTheDocument();
});
```

- [ ] **Step 2: Add this 2D accessibility assertion**

```tsx
fireEvent.click(screen.getByRole('button', { name: /^mặt bằng$/i }));
expect(screen.getByRole('button', { name: /kiện sàn.*không chồng.*nằm sàn/i })).toBeInTheDocument();
```

- [ ] **Step 3: Verify RED**

Run: `npm run test:unit -- tests/packing/viewer.test.tsx`

Expected: the current viewer has neither metric nor floor-only text.

- [ ] **Step 4: Add metric and cargo-focus helpers**

```tsx
function getPackingInsights(container: PackedContainer) {
  const containerVolume = container.container.width * container.container.height * container.container.length;
  const cargoVolume = container.packed.reduce((sum, box) => sum + box.width * box.height * box.length, 0);
  return {
    packedCount: container.packed.length,
    fillPercent: containerVolume ? Math.min(100, (cargoVolume / containerVolume) * 100) : 0,
    floorOnlyCount: container.packed.filter((box) => !box.stackable).length,
  };
}
```

Add `getCargoFocus(container, placements)` returning a local target and span from visible placement bounds. Pass it to `CameraRig`; use its span for distance and `OrbitControls` minimum distance rather than the full container length.

- [ ] **Step 5: Render shell and floor-only indicators**

Render a `ContainerShell` with floor, left/right walls, rear wall, and a transparent edge box; leave the loading end open. Tighten `Grid` to 1.35 times the largest container dimension. Add a `SÀN` `Html` marker above every visible `stackable: false` placement and append `, không chồng — nằm sàn` to its 2D button label.

- [ ] **Step 6: Render metric DOM and style it**

```tsx
const insights = active ? getPackingInsights(active) : null;

{insights && <div className="viewer-metrics" aria-label="Chỉ số xếp hàng">
  <span>{insights.packedCount} kiện</span>
  <span>Lấp đầy {insights.fillPercent.toFixed(1)}%</span>
  {insights.floorOnlyCount > 0 && <span className="floor-only-metric">{insights.floorOnlyCount} kiện nằm sàn</span>}
</div>}
```

```css
.viewer-metrics { display: flex; flex-wrap: wrap; gap: 6px; }
.viewer-metrics span, .scene-floor-only { border: 1px solid var(--port-line); border-radius: 4px; color: var(--port-muted); background: rgba(7, 19, 31, .78); font-size: .58rem; font-weight: 800; }
.viewer-metrics span { padding: 4px 6px; }
.viewer-metrics .floor-only-metric, .scene-floor-only { border-color: rgba(251, 191, 36, .72); color: var(--port-amber); }
.scene-floor-only { display: inline-grid; padding: 2px 4px; box-shadow: 0 1px 4px rgba(0, 0, 0, .5); }
```

- [ ] **Step 7: Verify GREEN and commit**

Run: `npm run test:unit -- tests/packing/viewer.test.tsx; npm test; npm run build; git diff --check`

Expected: all tests and static production build pass with zero diff-whitespace errors.

```powershell
git add components/packing/packing-viewer.tsx app/globals.css tests/packing/viewer.test.tsx
git commit -m "feat: clarify 3d packing viewer"
```

### Task 2: Publish the clearer viewer

**Files:**
- Verify only; no additional source changes expected.

- [ ] **Step 1: Push and verify Pages**

Run: `git push github HEAD:deploy-github`

Expected: GitHub Actions succeeds and the live URL returns HTTP 200.
