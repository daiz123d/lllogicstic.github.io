# Preset Container Autoselection Design

## Goal

When the operator presses **Tối ưu xếp hàng**, select the most suitable truck/container from the standard sample-container catalog for the remaining cartons. Continue selecting additional sample containers until every carton is packed or no catalog item can pack another carton.

## Scope

- The sample catalog is the existing `containerPresets` exported by `src/binPacking.js`.
- Automatic selection is the default optimisation mode; the existing manually entered containers remain an explicit alternative.
- Do not change carton import/export, the packing heuristic, the backend contract, or the 3D renderer version.

## Selection policy

For each iteration, evaluate every standard sample container against the current remaining cartons using the existing packing logic.

1. Sort the sample catalog by internal volume, from the smallest container to the largest.
2. Choose the first (smallest) sample that can pack at least one remaining carton; it does not need to pack every carton.
3. Pack that selected container to the capacity produced by the existing packing heuristic, append it to the result, then continue with the cartons left unpacked.
4. Repeat until all cartons are packed or no sample can pack another carton.
5. Stop immediately on non-progress and retain cartons that cannot fit any sample as leftovers.

The automatic policy therefore prioritizes the smallest usable container and adds another container when that one is full. It intentionally does not select a larger sample merely because that larger sample can hold all remaining cartons.

## UI and result flow

- Add a strategy choice: **Tự chọn container mẫu** (default) or **Dùng container tự nhập**.
- The Container inspector presents the standard catalog as a compact, read-only reference when automatic selection is active, instead of requiring the operator to add every candidate manually.
- The result status summarizes repeated samples, such as `3 × 1.25T (VN)`, instead of repeating a long list of identical names. Leftovers keep their existing reason labels.
- The existing 3D viewer renders each container selected by the optimiser and retains its per-container tabs.

## Failure handling

- If the catalog cannot pack a carton, retain it in `leftover` with its packing reason and show the warning state.
- Guard the selection loop against non-progress: stop immediately when the best candidate packs zero cartons.
- Do not silently substitute a manually entered container while automatic sample selection is active.
- A carton with `stackable: false` is floor-only: it must have `y = 0` and no carton may be placed on top of it. The packing validation and automatic packing path must enforce the same rule.

## Testing

- Adapter test: a carton set that fits a single preset returns that preset with a stable ID.
- Adapter test: a carton set that does fit a large preset still starts with the smallest usable preset and adds a second sample when needed.
- Workspace test: switching to automatic sample mode invokes the sample-selection path and renders the recommended container name.
- Packing test: a non-stackable carton following a stackable carton remains unpacked when the only available position is above that carton.
- Preserve legacy tests for `selectBestPresetContainers` as algorithm regression coverage.
