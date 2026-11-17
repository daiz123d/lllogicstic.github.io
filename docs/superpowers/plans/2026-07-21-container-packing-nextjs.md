# Container Packing Next.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static container-packing page with a testable Next.js application that runs packing locally and presents an improved interactive 3D workspace.

**Architecture:** Next.js App Router provides the page shell and client-side state. Pure TypeScript modules hold the packing algorithm and import normalization; a client-only React Three Fiber canvas renders placements from that state. No route handler, database, login, GPS, or server persistence is introduced.

**Tech Stack:** Next.js, React, TypeScript, React Three Fiber, Drei, Three.js, XLSX, Vitest, Playwright.

## Global Constraints

- The packing calculation must execute in the browser and must not call a network API.
- Preserve current input formats: CSV, JSON, XLSX, and XLS.
- Keep weight, rotation, stackable flag, container capacity, multi-container selection, and leftover reasons.
- Do not migrate or extend the trip-tracking screen.
- Domain modules must not import React, browser DOM APIs, or Three.js.
- Provide a readable table/2D result if WebGL is unavailable.

---

### Task 1: Establish the Next.js workspace and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `tests/setup.ts`
- Modify: `Dockerfile`
- Modify: `.dockerignore`

**Interfaces:**
- Consumes: the repository root and existing static assets.
- Produces: `npm run dev`, `npm run build`, `npm run test`, and a root page rendered by Next.js.

- [ ] **Step 1: Write the failing smoke test**

Create `tests/app.smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import Home from '../app/page';

test('renders the container packing workspace', () => {
  render(<Home />);
  expect(screen.getByRole('heading', { name: /xếp thùng/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/app.smoke.test.tsx`

Expected: failure because `package.json` and `app/page.tsx` do not exist.

- [ ] **Step 3: Create the Next.js configuration and minimal page**

Create `package.json` with these scripts and dependencies:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@react-three/drei": "latest",
    "@react-three/fiber": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "three": "latest",
    "xlsx": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@types/three": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Create `app/layout.tsx` and `app/page.tsx`:

```tsx
// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Xếp thùng', description: 'Tối ưu xếp hàng vào container' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}

// app/page.tsx
'use client';

export default function Home() {
  return <main><h1>Xếp thùng</h1><p>Chuẩn bị không gian làm việc.</p></main>;
}
```

Create `tsconfig.json` with `"strict": true`, `"jsx": "preserve"`, `"moduleResolution": "bundler"`, and `"@/*": ["./*"]`; create `next.config.ts` as `export default {};`.

Create `vitest.config.ts` with `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']`, and a `@` alias to the repository root. Create `tests/setup.ts` with `import '@testing-library/jest-dom/vitest';`.

Replace the Nginx `Dockerfile` with a multi-stage Node build that runs `npm ci`, `npm run build`, then starts `npm run start` on port `3000`; add `.next`, `node_modules`, and `playwright-report` to `.dockerignore`.

- [ ] **Step 4: Run the test and production build**

Run: `npm install`

Run: `npm run test -- tests/app.smoke.test.tsx`

Expected: one passing test.

Run: `npm run build`

Expected: successful Next.js production build.

- [ ] **Step 5: Commit the workspace**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts app tests Dockerfile .dockerignore
git commit -m "feat: establish Next.js packing workspace"
```

### Task 2: Extract typed packing and import domain modules

**Files:**
- Create: `lib/packing/types.ts`
- Create: `lib/packing/engine.ts`
- Create: `lib/packing/import.ts`
- Create: `lib/packing/export.ts`
- Create: `tests/packing/engine.test.ts`
- Create: `tests/packing/import.test.ts`
- Modify: `src/binPacking.js`
- Modify: `src/boxImport.js`

**Interfaces:**
- Consumes: dimensions in metres, positive quantities, optional `maxWeight`, carton `weight`, `stackable`, and `allowRotation`.
- Produces: `packMultipleContainers(containers, cartons, options): PackingResult` and `parseCartonRows(rows): ImportResult`.

- [ ] **Step 1: Write failing domain tests**

Create `tests/packing/engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { packMultipleContainers } from '@/lib/packing/engine';

describe('packMultipleContainers', () => {
  it('places a fitting carton and reports an oversized carton', () => {
    const result = packMultipleContainers(
      [{ id: 'c1', name: '20ft', length: 4, width: 2, height: 2, quantity: 1, maxWeight: 100 }],
      [
        { id: 'box-1', length: 1, width: 1, height: 1, quantity: 1, weight: 2, stackable: true, color: '#22c55e' },
        { id: 'box-2', length: 5, width: 1, height: 1, quantity: 1, weight: 2, stackable: true, color: '#f43f5e' }
      ],
      { allowRotation: true }
    );
    expect(result.containers[0].placements).toHaveLength(1);
    expect(result.leftovers).toEqual(expect.arrayContaining([expect.objectContaining({ cartonId: 'box-2', reason: 'oversize' })]));
  });
});
```

Create `tests/packing/import.test.ts`:

```ts
import { expect, it } from 'vitest';
import { parseCartonRows } from '@/lib/packing/import';

it('accepts Vietnamese carton headers and rejects invalid rows', () => {
  const parsed = parseCartonRows([
    { 'Dài': 2, 'Rộng': 1, 'Cao': 1, 'Số lượng': 2, 'Khối lượng': 3, 'Có thể chồng': 'có' },
    { 'Dài': 0, 'Rộng': 1, 'Cao': 1 }
  ]);
  expect(parsed.cartons).toHaveLength(1);
  expect(parsed.skipped).toBe(1);
  expect(parsed.cartons[0]).toMatchObject({ length: 2, width: 1, height: 1, quantity: 2, weight: 3, stackable: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/packing/engine.test.ts tests/packing/import.test.ts`

Expected: failure because `lib/packing/engine.ts` and `lib/packing/import.ts` do not exist.

- [ ] **Step 3: Implement typed pure modules**

Create `lib/packing/types.ts` with these exported types:

```ts
export type LeftoverReason = 'oversize' | 'overweight' | 'no-space';
export type PackingOptions = { allowRotation: boolean };
export type ContainerInput = { id: string; name: string; length: number; width: number; height: number; quantity: number; maxWeight: number };
export type CartonInput = { id: string; length: number; width: number; height: number; quantity: number; weight: number; stackable: boolean; color: string };
export type Placement = CartonInput & { x: number; y: number; z: number; order: number; containerId: string };
export type Leftover = CartonInput & { cartonId: string; reason: LeftoverReason };
export type PackedContainer = { container: ContainerInput; placements: Placement[]; usedWeight: number };
export type PackingResult = { containers: PackedContainer[]; leftovers: Leftover[] };
export type ImportResult = { cartons: CartonInput[]; skipped: number };
```

Port the existing algorithms from `src/binPacking.js` and parsing aliases from `src/boxImport.js` into `engine.ts` and `import.ts`, replacing mutable DOM assumptions with typed arguments/returns. Assign a stable `id` from `crypto.randomUUID()` when importing. Preserve the existing collision, rotation, stackability, capacity, and leftover logic exactly. Keep `src/*.js` untouched until the new UI is verified.

Create `lib/packing/export.ts` with `exportCartons`, `exportContainers`, and `exportResult` functions that use `XLSX.utils.json_to_sheet`, `XLSX.utils.book_new`, and `XLSX.writeFile` only after a browser event.

- [ ] **Step 4: Run all domain tests**

Run: `npm run test -- tests/packing`

Expected: all packing and import tests pass.

- [ ] **Step 5: Commit domain extraction**

```bash
git add lib/packing tests/packing
git commit -m "feat: add typed browser packing domain"
```

### Task 3: Build the packing workspace and responsive inputs

**Files:**
- Create: `components/packing/packing-workspace.tsx`
- Create: `components/packing/container-panel.tsx`
- Create: `components/packing/carton-panel.tsx`
- Create: `components/packing/result-summary.tsx`
- Create: `hooks/use-packing-workspace.ts`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `tests/packing/workspace.test.tsx`

**Interfaces:**
- Consumes: `ContainerInput`, `CartonInput`, `packMultipleContainers`, and `PackingResult` from `lib/packing`.
- Produces: a `PackingWorkspace` that calls `runPacking()` and exposes `result`, `selectedPlacement`, and `step` to the viewer.

- [ ] **Step 1: Write the failing workspace test**

Create `tests/packing/workspace.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { PackingWorkspace } from '@/components/packing/packing-workspace';

it('packs the sample carton when the user presses Xếp thùng', () => {
  render(<PackingWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: /^xếp thùng$/i }));
  expect(screen.getByText(/đã xếp 4/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the workspace test to verify it fails**

Run: `npm run test -- tests/packing/workspace.test.tsx`

Expected: failure because `PackingWorkspace` does not exist.

- [ ] **Step 3: Implement workspace state and panels**

Create `hooks/use-packing-workspace.ts` with a `usePackingWorkspace()` hook that initializes one `ContainerInput` (`4 × 5 × 3`, quantity `1`) and four one-metre cartons, calls `packMultipleContainers` in `runPacking`, and exposes CRUD handlers, `result`, `selectedPlacementId`, `setSelectedPlacementId`, `step`, and `setStep`.

Create `components/packing/packing-workspace.tsx` as a client component. It must render:

```tsx
<section aria-label="Không gian xếp thùng">
  <ContainerPanel containers={state.containers} onChange={state.setContainers} />
  <CartonPanel cartons={state.cartons} onChange={state.setCartons} />
  <button type="button" onClick={state.runPacking}>Xếp thùng</button>
  <ResultSummary result={state.result} />
</section>
```

`ContainerPanel` and `CartonPanel` must render labelled numeric inputs, add/remove controls, and import controls for CSV/JSON/XLSX. Invalid input receives `aria-invalid="true"` and a Vietnamese inline message. `ResultSummary` must display packed count, leftover count, container fill percentage, and each leftover reason.

Replace `app/page.tsx` with:

```tsx
import { PackingWorkspace } from '@/components/packing/packing-workspace';

export default function Home() {
  return <main className="app-shell"><PackingWorkspace /></main>;
}
```

Add responsive CSS grid rules: one column below `960px`; input panel and workspace columns at or above `960px`; use visible keyboard focus and a dark neutral workspace background.

- [ ] **Step 4: Run component and build checks**

Run: `npm run test -- tests/packing/workspace.test.tsx`

Expected: one passing test with the text `Đã xếp 4`.

Run: `npm run build`

Expected: successful build.

- [ ] **Step 5: Commit the workspace**

```bash
git add app components hooks tests/packing/workspace.test.tsx
git commit -m "feat: add container packing workspace"
```

### Task 4: Add the React-based 3D/2D result viewer

**Files:**
- Create: `components/packing/packing-viewer.tsx`
- Create: `components/packing/scene/container-scene.tsx`
- Create: `components/packing/scene/carton-mesh.tsx`
- Create: `components/packing/plan-view.tsx`
- Modify: `components/packing/packing-workspace.tsx`
- Modify: `app/globals.css`
- Create: `tests/packing/viewer.test.tsx`

**Interfaces:**
- Consumes: `PackedContainer`, `Placement`, selected placement id, and packing playback step.
- Produces: `PackingViewer` with `3d` and `2d` modes and `onSelectPlacement(id: string)`.

- [ ] **Step 1: Write the failing view-toggle test**

Create `tests/packing/viewer.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { PackingViewer } from '@/components/packing/packing-viewer';

it('switches to a readable 2D plan', () => {
  render(<PackingViewer packedContainers={[]} selectedPlacementId={null} onSelectPlacement={() => {}} step={0} />);
  fireEvent.click(screen.getByRole('button', { name: /mặt bằng 2d/i }));
  expect(screen.getByLabelText(/sơ đồ xếp 2d/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/packing/viewer.test.tsx`

Expected: failure because `PackingViewer` does not exist.

- [ ] **Step 3: Implement the 3D scene and fallback view**

Create `PackingViewer` as a client component with `viewMode: '3d' | '2d'` state, two buttons named `Phối cảnh 3D` and `Mặt bằng 2D`, and a 2D fallback `<section aria-label="Sơ đồ xếp 2D">` that shows scaled carton rectangles and selected state.

Use `next/dynamic` with `{ ssr: false }` to import `ContainerScene`. `ContainerScene` must render a React Three Fiber `Canvas` with `OrbitControls`, `Environment`, `ContactShadows`, a grid, translucent container walls, and one `CartonMesh` per placement up to `step`. `CartonMesh` must use a `boxGeometry`, set its color from `placement.color`, and call `onSelectPlacement(placement.id)` on click. The selected carton uses an emissive highlight and an outline effect.

Wire the viewer into `PackingWorkspace` beside `ResultSummary`; add top/front/side/reset camera buttons plus previous/next/play controls. Respect `prefers-reduced-motion` by leaving playback stopped initially.

- [ ] **Step 4: Run the viewer test and build**

Run: `npm run test -- tests/packing/viewer.test.tsx`

Expected: one passing test.

Run: `npm run build`

Expected: successful static analysis and production build.

- [ ] **Step 5: Commit the viewer**

```bash
git add components/packing app/globals.css tests/packing/viewer.test.tsx
git commit -m "feat: add interactive container packing viewer"
```

### Task 5: Verify browser flows and deployment configuration

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/packing.spec.ts`
- Modify: `README.md`
- Modify: `.gitlab-ci.yml`
- Modify: `k8s/deployment.yaml`
- Modify: `k8s/service.yaml`

**Interfaces:**
- Consumes: a production-ready Next.js app at port `3000`.
- Produces: repeatable browser verification and deployment manifests exposing port `3000`.

- [ ] **Step 1: Write the failing end-to-end flow**

Create `tests/e2e/packing.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('packs cartons and opens the 2D fallback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^xếp thùng$/i }).click();
  await expect(page.getByText(/đã xếp 4/i)).toBeVisible();
  await page.getByRole('button', { name: /mặt bằng 2d/i }).click();
  await expect(page.getByLabel(/sơ đồ xếp 2d/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the end-to-end test to verify the initial failure or missing setup**

Run: `npx playwright test tests/e2e/packing.spec.ts`

Expected: failure until `playwright.config.ts` and the browser dependency are configured.

- [ ] **Step 3: Configure Playwright and align deployment**

Create `playwright.config.ts` with `baseURL: 'http://127.0.0.1:3000'` and a `webServer` command of `npm run dev` on port `3000`.

Update `.gitlab-ci.yml` to run `npm ci`, `npm run test`, and `npm run build` before the existing image build. Update the Docker image tag deployment to expose `containerPort: 3000`, and update the Kubernetes service `targetPort: 3000`. Update `README.md` with `npm install`, `npm run dev`, `npm run test`, `npm run build`, and the no-backend data limitation.

- [ ] **Step 4: Run complete verification**

Run: `npm run test`

Expected: all unit and component tests pass.

Run: `npm run build`

Expected: successful production build.

Run: `npx playwright install --with-deps chromium`

Run: `npm run e2e`

Expected: browser flow passes.

- [ ] **Step 5: Commit verification and deployment updates**

```bash
git add playwright.config.ts tests/e2e README.md .gitlab-ci.yml k8s Dockerfile
git commit -m "test: verify Next.js packing flow"
```

## Self-review

- Spec coverage: Task 1 establishes the frontend runtime; Task 2 preserves the packing algorithm and import formats; Task 3 covers inputs, validation, results, and exports; Task 4 covers polished 3D, 2D fallback, selection, camera, and playback; Task 5 covers automated browser testing and deployment.
- Placeholder scan: no TBD/TODO or unspecified implementation steps remain.
- Type consistency: `ContainerInput`, `CartonInput`, `PackedContainer`, `Placement`, and `PackingResult` originate in `lib/packing/types.ts` and are the only domain contracts used by components and tests.
