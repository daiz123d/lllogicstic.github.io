# Preset Container Autoselection Design

## Goal

When the operator presses **Tối ưu xếp hàng**, select the most suitable truck/container from the standard sample-container catalog for the remaining cartons. Continue selecting additional sample containers until every carton is packed or no catalog item can pack another carton.

## Scope

- The sample catalog is the existing `containerPresets` exported by `src/binPacking.js`.
- Automatic selection is the default optimisation mode; the existing manually entered containers remain an explicit alternative.
- Do not change carton import/export, the packing heuristic, the backend contract, or the 3D renderer version.

## Selection policy

For each iteration, evaluate every standard sample container against the current remaining cartons using the existing packing logic.

1. Prefer a container that packs all remaining cartons, choosing the smallest internal volume.
2. When no single sample fits all cartons, prefer the candidate with the fewest leftovers.
3. Break ties by packing more cartons, then by smaller volume.
4. Append the selected container and its placements to the result.
5. Repeat with only the cartons left unpacked.
6. Stop when no candidate packs at least one remaining carton, or every carton is packed.

This is the behaviour already represented by `selectBestPresetContainers`; the Next.js adapter will expose it with stable container IDs and the app's `PackingResult` shape.

## UI and result flow

- Add a strategy choice: **Tự chọn container mẫu** (default) or **Dùng container tự nhập**.
- The Container inspector presents the standard catalog as a compact, read-only reference when automatic selection is active, instead of requiring the operator to add every candidate manually.
- The result panel lists the chosen samples in sequence, such as `1 × 5T (VN)` then `1 × 3.5T (VN)`, and keeps leftovers with their existing reason labels.
- The existing 3D viewer renders each container selected by the optimiser and retains its per-container tabs.

## Failure handling

- If the catalog cannot pack a carton, retain it in `leftover` with its packing reason and show the warning state.
- Guard the selection loop against non-progress: stop immediately when the best candidate packs zero cartons.
- Do not silently substitute a manually entered container while automatic sample selection is active.

## Testing

- Adapter test: a carton set that fits a single preset returns that preset with a stable ID.
- Adapter test: a carton set requiring two presets selects a second sample and leaves no cartons.
- Workspace test: switching to automatic sample mode invokes the sample-selection path and renders the recommended container name.
- Preserve legacy tests for `selectBestPresetContainers` as algorithm regression coverage.
