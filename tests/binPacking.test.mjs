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
