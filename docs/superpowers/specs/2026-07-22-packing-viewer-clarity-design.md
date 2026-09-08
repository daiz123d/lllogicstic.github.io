# Packing Viewer Clarity Design

## Goal

Make the 3D packing view explain the chosen packing plan at a glance: cargo should be visible at a useful scale, the container should read as an open physical shell, and floor-only cartons should be unmistakable.

## Scope

- Keep the existing 3D/2D switch, camera buttons, playback, selection, packing algorithm, and container selection unchanged.
- Improve only `PackingViewer` presentation and the supporting CSS/tests.

## Chosen approach

Use a cargo-focused camera while preserving an open container shell. The initial camera target is the centre of the visible cargo, with its distance based on both cargo bounds and a minimum fraction of the container size. This avoids the current distant view without making the container disappear entirely.

Render the container as a translucent floor, two side walls, a rear wall, and bright structural edges; leave the loading end open. Replace the oversized exterior grid with a tighter floor grid.

Show compact viewer metrics for packed count, fill percentage by volume, and the number of floor-only cartons. Each carton with `stackable: false` gets a `SÀN` marker in 3D and a distinct outlined treatment in the 2D plan. The marker describes packing policy; it does not alter packing geometry.

## Accessibility and behavior

- Viewer metrics are DOM text, so they remain available when WebGL is unavailable.
- Floor-only cartons include `không chồng — nằm sàn` in their accessible 2D label.
- Clicking a carton, playback step limiting, and current camera controls retain their present behavior.

## Testing

- Render one packed container with a non-stackable carton and assert the fill metric, packed count, and floor-only indicator.
- Assert the 2D plan exposes the non-stackable carton with its explanatory accessible label.
- Preserve the existing empty-plan test.
