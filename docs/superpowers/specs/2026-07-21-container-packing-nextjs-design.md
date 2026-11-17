# Container packing Next.js design

## Goal

Rebuild the existing container-packing screen as a Next.js frontend. Keep the
packing algorithm entirely in the browser so a user can import data, calculate
a packing plan, and inspect the result without a Node.js API or database.

The trip-tracking page is explicitly out of scope.

## Chosen approach

Use Next.js with TypeScript and the App Router. Move the existing deterministic
packing and validation logic into framework-independent modules, and render the
3D scene with React Three Fiber plus Drei. This keeps the current feature set
while making the interface easier to extend and test.

Alternatives considered:

1. Keep the current static HTML and imperative Three.js. Lowest migration cost,
   but the large page script remains difficult to maintain.
2. Use Next.js with plain Three.js. Valid, but React state and scene lifecycle
   need more manual code.
3. Use Next.js with React Three Fiber. Chosen: it maps React state cleanly to
   3D objects and supports better controls, lights, selection, and animation.

## Scope

### Included

- Create and edit container definitions and carton types.
- Import carton/container data from CSV, JSON, and XLSX.
- Validate dimensions, quantities, weight, stacking, and container capacity.
- Run the existing multi-container packing algorithm locally.
- Show packed, unplaced, and invalid items with clear reasons.
- Provide a polished 3D viewer with orbit controls, shadows, selectable cartons,
  camera presets, and step-by-step packing playback.
- Provide a 2D plan view and exports for cartons, containers, and packing results.
- Unit-test algorithm and data-normalization modules.

### Excluded

- Login, multi-user access, database persistence, server API, GPS tracking, and
  real-time updates.

## Architecture

```
Next.js page (client component)
  ├─ packing state and form panels
  ├─ packing domain modules (pure TypeScript)
  ├─ import/export adapters (browser only)
  └─ 3D viewer (React Three Fiber)
       └─ packed boxes, container shell, lights, controls and selection
```

`packing/` remains pure: it takes containers, cartons, and options, then returns
placements and leftovers. It must not access DOM, React, or network APIs.

The page owns all temporary data in memory. Reloading clears it; users can export
their inputs/results before leaving. A later API can reuse the same domain types
without changing the viewer or algorithm.

## UX and 3D behaviour

- A left panel contains container and carton inputs; a right workspace shows
  the 3D result and summary.
- The selected carton is outlined and its dimensions, weight, coordinates, and
  loading order are displayed.
- Camera presets provide perspective, front, side, top, and reset views.
- The viewer has soft lighting, floor/grid, physically readable carton materials,
  shadows, and responsive canvas sizing.
- Playback adds cartons in loading order; pause, next/previous, and a slider
  remain available.
- Reduced-motion users see the final state without automatic animation.

## Error handling

- Reject malformed imports row by row and report skipped rows.
- Do not run packing when required values are invalid.
- Label each leftover as oversize, overweight, or no suitable space.
- Handle unsupported WebGL with a readable 2D/table fallback.

## Verification

- Preserve and expand tests for packing, import parsing, rotations, weight,
  stacking, and multi-container leftovers.
- Add component tests for validation and key result states.
- Add an end-to-end browser flow: import sample data, pack, select a carton,
  switch view, and export results.
