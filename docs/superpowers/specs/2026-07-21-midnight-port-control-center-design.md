# Midnight Port Control Center Design

## Decision

Redesign the packing workspace as a desktop-first logistics control center while
preserving the existing Next.js, React Three Fiber, Three.js 0.183, packing
algorithm, input types, and static-export deployment model. The supplied design
brief is approved by the product owner.

## Alternatives considered

1. Reskin the existing single-column workspace. Lowest effort, but it cannot
   give 3D simulation the required priority.
2. Replace the renderer with imperative Three.js r134. Rejected: it conflicts
   with the current React 19/R3F runtime and adds migration risk without a UX
   benefit.
3. Create a control-center shell around the existing state and renderer.
   Chosen: it preserves behaviour while making visual hierarchy, data density,
   responsiveness, and keyboard use substantially better.

## Information architecture

The application is an app shell with a collapsible left navigation rail, a
project command bar, a compact telemetry strip, and a fixed-height work area.
The primary work area uses an 8/4 grid on wide desktop screens:

- The 8-column pane is a dark simulation stage. It contains the 3D/2D canvas,
  floating camera and display controls, utilization telemetry, selected-carton
  details, and packing playback.
- The 4-column inspector has tabs for Cargo, Container, Strategy, and Import.
  Forms have persistent labels, units, inline validation, and actionable lists
  for the cartons and containers already entered.
- A synchronized result table appears below the work area on desktop and uses a
  compact card list on narrow displays. Selecting a row highlights the matching
  carton in the scene; scene selection selects the matching row.

## Visual system

Use CSS variables for the Midnight Port Command Center palette: page `#07131F`,
panels `#0D1B2A` and `#122235`, cyan command accents `#22D3EE`, teal success
`#2DD4BF`, safety warning `#FBBF24`, and leftover/error coral `#FB7185`.

Typography uses Be Vietnam Pro with system fallbacks. Thin coordinate grids,
corner ticks, route lines, status telemetry, and compact icons create the port
operations character. Panels use low-contrast borders and restrained shadows;
there are no AI-style violet gradients, heavy glass blur, emoji, or decorative
background images.

## Interaction and state

- Running optimisation shows a non-blocking success/warning toast, updates KPI
  counts, starts the result playback at the completed state, and exposes
  leftovers with their exact reason.
- Canvas buttons control perspective, top, side, front, reset, labels,
  wireframe, and fullscreen. These controls change the current scene rather
  than recreate it.
- Inputs invalidate a previous result. The optimize action disables while a
  request is being calculated and gives direct field-level error feedback.
- Import and export retain CSV, JSON, XLSX, and XLS compatibility. Import
  reports accepted and skipped rows without replacing valid data unexpectedly.
- Every interactive control is keyboard reachable, has an accessible name, and
  presents a visible focus ring. Motion respects `prefers-reduced-motion`.

## Responsive behaviour

At 1440px and above, show the 8/4 workspace and expanded 240px sidebar. From
1024px through 1439px, collapse the sidebar to its icon rail and narrow the
inspector. On tablet, move the inspector into a controlled drawer below the
full-width canvas. On mobile, show result controls first and use compact cards
or bottom-sheet forms; no control is smaller than 44px.

## Verification

Tests will cover workspace optimization, inspector tab visibility, sidebar
collapse, row/scene selection synchronization, 2D fallback, import handling,
and reduced-motion-safe playback. Production verification includes a static
export build and a browser-sized responsive pass at desktop, laptop, tablet,
and mobile widths.
