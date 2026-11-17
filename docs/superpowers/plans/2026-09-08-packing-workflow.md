# Packing workflow implementation plan

User authorizes revising operation and workflow and asks to continue implementation.

**Goal:** A connected cargo → setup → optimization → review/export workflow, preserving work across reloads and keeping the interface responsive during computation.

**Architecture:** Keep the existing packing algorithm and 3D viewer. Isolate cancellable computation and versioned browser storage in small modules; the workspace coordinates their state. The displayed adjusted plan becomes the plan exported to Excel.

**Constraints:** Static Next.js export; no backend or new dependencies. Preserve previous local changes. No publish, push or unrelated edits. Validate behavior with unit and real-browser tests.

## Task 1 — execution and persistence

- [x] Add `lib/packing/packing-job.ts`, `packing.worker.ts` and `workspace-storage.ts` with focused tests.
- `startPackingJob(input: {containers: ContainerInput[]; cartons: CartonInput[]; containerMode: ContainerSelectionMode; options: PackingOptions}, callbacks: {onSuccess(result: PackingResult): void; onError(error: Error): void}): () => void` creates a module Worker using a literal relative URL. Cancellation terminates it, detaches handlers, and suppresses late callbacks. Both completion and errors terminate the worker. If Worker is unavailable, use the existing synchronous engine for compatibility.
- `WorkspaceSnapshot`: version:1, containers, cartons, containerMode, allowRotation, strategy, result, placementOverrides. Export `WORKSPACE_STORAGE_KEY`, `readWorkspaceSnapshot(storage)` and `writeWorkspaceSnapshot(snapshot, storage)`. Reads validate the shape of arrays, enums, finite values, result and overrides; malformed data returns null; access and quota errors remain catchable by the caller. Incomplete but finite editable draft numbers may be saved. Never claim persistence succeeded when storage failed.
- Tests: worker success/error/cancel/late callbacks, snapshot roundtrip/corrupt/unsupported version/storage failure.

## Task 2 — consistent file import and export

- [x] Preserve imported carton labels and Vietnamese non-stacking aliases. Reject explicitly invalid quantity/weight while retaining defaults for omitted optional values. Apply quantity consistency to container import.
- [x] Extend `readRowsFromFile(file, target?: 'cartons' | 'containers')` to select matching generated workbook sheets (`Hang hoa` / `Container`) for the requested target, falling back to first sheet for ordinary files.
- [x] Export container sheet from actual packing results when a result exists; caller passes the currently displayed result. Export final leftovers in a separate sheet, with human-readable reasons. Keep original inputs export when result is null.
- Tests: labelled/non-stackable import; invalid quantities; workbook roundtrip and actual container/leftover sheets. Own only file import/export modules and their tests, not workspace.

## Task 3 — connected workspace

- [x] Parent-controlled Inspector tab and clickable workflow steps; navigation points to real sections. Show input, computing, ready and adjusted states truthfully.
- [x] Run via job client, show working/cancel state, suppress results after input change/reset/unmount, and retain prior valid result on cancel/failure.
- [x] Debounce snapshot saves, flush latest snapshot on pagehide, restore on mount without overwriting stored data first. Show storage failures. Reset invalidates pending imports/jobs.
- [x] Import chooses target, append/replace mode; preserve labels; successful container import activates manual container mode and its tab. Do not unexpectedly mix default example cargo into imported plans: default import mode replaces.
- [x] Export displayed coordinates, show manual-change notice and action to restore automatic layout; block export while processing invalid/stale inputs. Keep warnings visible for manual overrides.
- [x] Test state transitions, persistence, cancel/reset races, import behavior and adjusted export; adapt old tests for deliberately changed product behavior.

## Task 4 — verification

- [x] Review implementation, run all relevant unit/legacy tests, production build and browser suite.
- [x] Add browser flow: import → optimize through real Worker → adjust → export → reload → restore; verify cancellation and responsive layout.
- [x] Update README and review notes with final behavior and measured limitations.
