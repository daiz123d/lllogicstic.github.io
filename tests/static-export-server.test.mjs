import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveStaticCandidates } from './e2e/static-export-server.mjs';

test('maps root and GitHub Pages requests to the same static export files', () => {
  assert.deepEqual(resolveStaticCandidates('/'), ['index.html']);
  assert.deepEqual(resolveStaticCandidates('/lllogicstic.github.io/'), ['index.html']);
  assert.deepEqual(resolveStaticCandidates('/_next/static/app.js'), ['_next/static/app.js']);
  assert.deepEqual(resolveStaticCandidates('/lllogicstic.github.io/_next/static/app.js'), ['_next/static/app.js']);
});

test('falls back to exported route indexes and rejects traversal', () => {
  assert.deepEqual(resolveStaticCandidates('/tracking'), ['tracking', 'tracking/index.html', 'index.html']);
  assert.deepEqual(resolveStaticCandidates('/tracking/'), ['tracking/index.html', 'index.html']);
  assert.deepEqual(resolveStaticCandidates('/lllogicstic.github.io/../secret'), []);
});
