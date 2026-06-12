import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/binPacking.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {
  findBestContainer,
  packBoxes,
  packMultipleContainers,
  selectBestPresetContainers,
  validateManualPlacement,
} = await import(moduleUrl);
const boxImportSource = fs.readFileSync(new URL('../src/boxImport.js', import.meta.url), 'utf8');
const boxImportModuleUrl = `data:text/javascript;base64,${Buffer.from(boxImportSource).toString('base64')}`;
const { isBoxFieldKey, normalizeBoxRecord, parseBoxRows } = await import(boxImportModuleUrl);
const sceneHelpersSource = fs.readFileSync(new URL('../src/sceneHelpers.js', import.meta.url), 'utf8');
const sceneHelpersModuleUrl = `data:text/javascript;base64,${Buffer.from(sceneHelpersSource).toString('base64')}`;
const { buildBoxLabel, getCameraPlacement, getContainerRibCount } = await import(sceneHelpersModuleUrl);
const trackingLogicSource = fs.readFileSync(new URL('../src/trackingLogic.js', import.meta.url), 'utf8');
const trackingLogicModuleUrl = `data:text/javascript;base64,${Buffer.from(trackingLogicSource).toString('base64')}`;
const { buildTripAlerts, estimateEtaMinutes, getGpsHealth, getSlaStatus, haversineDistanceKm } = await import(trackingLogicModuleUrl);

const EPSILON = 1e-9;

function boxesOverlap(a, b) {
  return a.x < b.x + b.width - EPSILON &&
    a.x + a.width > b.x + EPSILON &&
    a.y < b.y + b.height - EPSILON &&
    a.y + a.height > b.y + EPSILON &&
    a.z < b.z + b.length - EPSILON &&
    a.z + a.length > b.z + EPSILON;
}

function assertValidPacking(result, container) {
  result.packed.forEach((box, index) => {
    assert.ok(box.x >= -EPSILON, `box ${index} has negative x`);
    assert.ok(box.y >= -EPSILON, `box ${index} has negative y`);
    assert.ok(box.z >= -EPSILON, `box ${index} has negative z`);
    assert.ok(box.x + box.width <= container.width + EPSILON, `box ${index} exceeds container width`);
    assert.ok(box.y + box.height <= container.height + EPSILON, `box ${index} exceeds container height`);
    assert.ok(box.z + box.length <= container.length + EPSILON, `box ${index} exceeds container length`);
  });

  for (let i = 0; i < result.packed.length; i += 1) {
    for (let j = i + 1; j < result.packed.length; j += 1) {
      assert.equal(boxesOverlap(result.packed[i], result.packed[j]), false, `boxes ${i} and ${j} overlap`);
    }
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('packs a simple 2x2x2 cube grid without leftovers', () => {
  const result = packBoxes(2, 2, 2, [
    { width: 1, height: 1, length: 1, quantity: 8, weight: 1, stackable: true },
  ]);

  assert.equal(result.packed.length, 8);
  assert.equal(result.unpacked.length, 0);
  assertValidPacking(result, { width: 2, height: 2, length: 2 });
});

test('does not place boxes on top of a non-stackable support box', () => {
  const result = packBoxes(1, 2, 1, [
    { width: 1, height: 1, length: 1, quantity: 2, weight: 1, stackable: false },
  ]);

  assert.equal(result.packed.length, 1);
  assert.equal(result.unpacked.length, 1);
  assertValidPacking(result, { width: 1, height: 2, length: 1 });
});

test('respects container max weight', () => {
  const result = packBoxes(3, 3, 3, [
    { width: 1, height: 1, length: 1, quantity: 3, weight: 4, stackable: true },
  ], 8);

  assert.equal(result.packed.length, 2);
  assert.equal(result.unpacked.length, 1);
  assert.equal(result.packed.reduce((sum, box) => sum + box.weight, 0), 8);
  assertValidPacking(result, { width: 3, height: 3, length: 3 });
});

test('regression: avoids overlapping boxes caused by intersecting empty spaces', () => {
  const result = packBoxes(4, 3, 4, [
    { width: 0.5, height: 1, length: 2, quantity: 1, weight: 1, stackable: true },
    { width: 2, height: 1, length: 2.5, quantity: 1, weight: 1, stackable: true },
    { width: 0.5, height: 1.5, length: 2.5, quantity: 1, weight: 1, stackable: true },
    { width: 3, height: 2, length: 1.5, quantity: 1, weight: 1, stackable: true },
    { width: 3, height: 1, length: 2, quantity: 1, weight: 1, stackable: true },
    { width: 2.5, height: 2, length: 3, quantity: 1, weight: 1, stackable: true },
    { width: 0.5, height: 1.5, length: 2.5, quantity: 1, weight: 1, stackable: true },
    { width: 2, height: 1.5, length: 1, quantity: 1, weight: 1, stackable: true },
    { width: 1.5, height: 1, length: 0.5, quantity: 1, weight: 1, stackable: true },
    { width: 2, height: 0.5, length: 1.5, quantity: 1, weight: 1, stackable: true },
  ]);

  assertValidPacking(result, { width: 4, height: 3, length: 4 });
});

test('packs remaining boxes into following containers', () => {
  const result = packMultipleContainers([
    { id: 'A', name: 'A', width: 1, height: 1, length: 1 },
    { id: 'B', name: 'B', width: 1, height: 1, length: 1 },
  ], [
    { width: 1, height: 1, length: 1, quantity: 2, weight: 1, stackable: true },
  ]);

  assert.equal(result.results.length, 2);
  assert.equal(result.results.reduce((sum, item) => sum + item.packed.length, 0), 2);
  assert.equal(result.leftover.length, 0);
  result.results.forEach((item) => assertValidPacking(item, item.container));
});

test('can disable box rotation', () => {
  const rotating = packBoxes(2, 1, 3, [
    { width: 3, height: 1, length: 2, quantity: 1, weight: 1, stackable: true },
  ], 0, { allowRotation: true });
  const fixed = packBoxes(2, 1, 3, [
    { width: 3, height: 1, length: 2, quantity: 1, weight: 1, stackable: true },
  ], 0, { allowRotation: false });

  assert.equal(rotating.packed.length, 1);
  assert.equal(fixed.packed.length, 0);
  assert.equal(fixed.unpacked.length, 1);
});

test('input-order strategy keeps earlier boxes first', () => {
  const result = packBoxes(5, 1, 5, [
    { width: 1, height: 1, length: 1, quantity: 1, weight: 1, stackable: true, label: 'small-first' },
    { width: 2, height: 1, length: 2, quantity: 1, weight: 1, stackable: true, label: 'large-second' },
  ], 0, { strategy: 'inputOrder' });

  assert.equal(result.packed[0].label, 'small-first');
  assert.equal(result.packed[1].label, 'large-second');
  assertValidPacking(result, { width: 5, height: 1, length: 5 });
});

test('heavy-bottom strategy packs heavier boxes first', () => {
  const result = packBoxes(5, 1, 5, [
    { width: 2, height: 1, length: 2, quantity: 1, weight: 1, stackable: true, label: 'light' },
    { width: 1, height: 1, length: 1, quantity: 1, weight: 10, stackable: true, label: 'heavy' },
  ], 0, { strategy: 'heavyBottom' });

  assert.equal(result.packed[0].label, 'heavy');
  assert.equal(result.packed[1].label, 'light');
  assertValidPacking(result, { width: 5, height: 1, length: 5 });
});

test('findBestContainer treats missing quantity as one box', () => {
  const result = findBestContainer([
    { width: 1, height: 1, length: 1, weight: 1, stackable: true },
  ], { allowRotation: false });

  assert.ok(result);
  assert.equal(result.fitsAll, true);
  assert.equal(result.packed.length, 1);
  assert.equal(result.leftover, 0);
});

test('findBestContainer marks fallback preset when no preset fits every box', () => {
  const result = findBestContainer([
    { width: 20, height: 4, length: 20, quantity: 1, weight: 1, stackable: true },
  ], { allowRotation: false });

  assert.ok(result);
  assert.equal(result.fitsAll, false);
  assert.equal(result.leftover, 1);
  assert.equal(result.unpacked.length, 1);
});

test('selectBestPresetContainers keeps choosing standard containers for leftovers', () => {
  const result = selectBestPresetContainers([
    { width: 3, height: 3, length: 18, quantity: 2, weight: 100, stackable: false },
  ], { allowRotation: false });

  assert.equal(result.results.length, 2);
  assert.equal(result.results.reduce((sum, item) => sum + item.packed.length, 0), 2);
  assert.equal(result.leftover.length, 0);
  assert.equal(result.fitsAll, true);
  result.results.forEach(item => {
    assert.ok(item.container.length >= 18);
    assert.ok(item.container.width >= 3);
    assert.ok(item.container.height >= 3);
    assertValidPacking(item, item.container);
  });
});

test('box import parser accepts Vietnamese Excel headers and stackable values', () => {
  const { boxes: imported, skipped } = parseBoxRows([
    { 'Chiều Dài': 2.5, 'Rộng': 1.2, 'Cao': 1, 'Số lượng': 3, 'Khối lượng': 10, 'Xếp chồng': 'có', 'Màu': '#123456' },
    { dai: 1, rong: 0.5, cao: 0.4, sl: 2, kg: 4, xep_chong: 'không' },
    { length: '', width: '', height: '' },
    { length: -1, width: 1, height: 1 },
  ]);

  assert.equal(imported.length, 2);
  assert.equal(skipped, 1);
  assert.deepEqual(imported[0], {
    width: 1.2,
    height: 1,
    length: 2.5,
    quantity: 3,
    color: '#123456',
    weight: 10,
    stackable: true,
  });
  assert.equal(imported[1].quantity, 2);
  assert.equal(imported[1].weight, 4);
  assert.equal(imported[1].stackable, false);
});

test('box import parser defaults optional Excel columns', () => {
  const result = normalizeBoxRecord({ length: 2, width: 1, height: 1 });

  assert.deepEqual(result, {
    width: 1,
    height: 1,
    length: 2,
    quantity: 1,
    color: '#6dd3ff',
    weight: 0,
    stackable: true,
  });
});

test('box import parser recognizes common header aliases', () => {
  assert.equal(isBoxFieldKey('Chiều Dài'), true);
  assert.equal(isBoxFieldKey('so_luong'), true);
  assert.equal(isBoxFieldKey('Xếp chồng'), true);
  assert.equal(isBoxFieldKey('ghi chú'), false);
});

test('scene helpers build readable box labels and container ribs', () => {
  assert.equal(buildBoxLabel({ label: 'BX-01', order: 4 }), 'BX-01');
  assert.equal(buildBoxLabel({ order: 4 }), '#4');
  assert.equal(getContainerRibCount({ length: 12 }), 12);
  assert.equal(getContainerRibCount({ length: 1 }), 4);
});

test('scene helpers compute camera placements for 3D and orthogonal views', () => {
  const containersForView = [{ width: 5, height: 3, length: 12 }];
  const offsets = [{ x: 0, z: 0 }];

  const iso = getCameraPlacement(containersForView, offsets, 'iso', 100);
  assert.ok(iso.position.x > iso.target.x);
  assert.ok(iso.position.y > iso.target.y);
  assert.ok(iso.position.z > iso.target.z);

  const top = getCameraPlacement(containersForView, offsets, 'top', 100);
  assert.equal(top.position.x, top.target.x);
  assert.ok(top.position.y > 1000);
  assert.equal(top.position.z, top.target.z);
});

test('scene helpers keep iso camera far enough for long containers', () => {
  const placement = getCameraPlacement([{ width: 2.35, height: 2.4, length: 15 }], [{ x: 0, z: 0 }], 'iso', 100);
  const dx = placement.position.x - placement.target.x;
  const dz = placement.position.z - placement.target.z;
  const horizontalDistance = Math.hypot(dx, dz);

  assert.ok(horizontalDistance >= 15 * 100 * 2.8);
});

test('tracking logic computes distance and ETA from GPS speed', () => {
  const km = haversineDistanceKm([21.0285, 105.8542], [20.8449, 106.6881]);
  assert.ok(km > 75 && km < 95);
  assert.equal(estimateEtaMinutes(90, 45), 120);
  assert.equal(estimateEtaMinutes(90, 0), null);
});

test('tracking logic reports GPS health and SLA risk', () => {
  const now = new Date('2026-06-05T10:00:00+07:00');
  assert.deepEqual(getGpsHealth('2026-06-05T09:58:00+07:00', now), { state: 'online', ageMinutes: 2 });
  assert.deepEqual(getGpsHealth('2026-06-05T09:44:00+07:00', now), { state: 'stale', ageMinutes: 16 });
  assert.deepEqual(getGpsHealth('2026-06-05T09:20:00+07:00', now), { state: 'lost', ageMinutes: 40 });
  assert.equal(getSlaStatus('2026-06-05T10:20:00+07:00', '2026-06-05T11:00:00+07:00'), 'on-time');
  assert.equal(getSlaStatus('2026-06-05T10:45:00+07:00', '2026-06-05T11:00:00+07:00'), 'at-risk');
  assert.equal(getSlaStatus('2026-06-05T11:10:00+07:00', '2026-06-05T11:00:00+07:00'), 'late');
});

test('tracking logic builds practical road transport alerts', () => {
  const now = new Date('2026-06-05T10:00:00+07:00');
  const alerts = buildTripAlerts({
    gpsLastAt: '2026-06-05T09:25:00+07:00',
    etaAt: '2026-06-05T11:20:00+07:00',
    slaAt: '2026-06-05T11:00:00+07:00',
    speedKmh: 0,
    stoppedMinutes: 35,
    deviationKm: 4.2,
    podStatus: 'pending'
  }, now);

  assert.ok(alerts.some(alert => alert.code === 'gps-lost'));
  assert.ok(alerts.some(alert => alert.code === 'sla-late'));
  assert.ok(alerts.some(alert => alert.code === 'long-stop'));
  assert.ok(alerts.some(alert => alert.code === 'route-deviation'));
  assert.ok(alerts.some(alert => alert.code === 'pod-pending'));
});

test('manual validation rejects boxes outside container bounds', () => {
  const result = validateManualPlacement(
    { width: 2, height: 2, length: 2, maxWeight: 0 },
    [],
    { boxKey: 'A', x: 1.5, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 1, stackable: true }
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('out-of-bounds'));
});

test('manual validation rejects overlapping boxes', () => {
  const result = validateManualPlacement(
    { width: 3, height: 2, length: 3, maxWeight: 0 },
    [
      { boxKey: 'A', x: 0, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 1, stackable: true },
    ],
    { boxKey: 'B', x: 0.5, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 1, stackable: true }
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('collision'));
});

test('manual validation rejects unsupported stacked boxes', () => {
  const result = validateManualPlacement(
    { width: 3, height: 3, length: 3, maxWeight: 0 },
    [
      { boxKey: 'A', x: 0, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 1, stackable: false },
    ],
    { boxKey: 'B', x: 0, y: 1, z: 0, width: 1, height: 1, length: 1, weight: 1, stackable: true }
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('unsupported'));
});

test('manual validation rejects overweight layouts', () => {
  const result = validateManualPlacement(
    { width: 3, height: 3, length: 3, maxWeight: 5 },
    [
      { boxKey: 'A', x: 0, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 4, stackable: true },
    ],
    { boxKey: 'B', x: 1, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 3, stackable: true }
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('overweight'));
});

test('manual validation ignores the candidate box itself', () => {
  const result = validateManualPlacement(
    { width: 3, height: 3, length: 3, maxWeight: 0 },
    [
      { sourceIndex: 0, itemIndex: 0, order: 1, x: 0, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 1, stackable: true },
    ],
    { boxKey: 'C:0:0:1', sourceIndex: 0, itemIndex: 0, order: 1, x: 0, y: 0, z: 0, width: 1, height: 1, length: 1, weight: 1, stackable: true }
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});
