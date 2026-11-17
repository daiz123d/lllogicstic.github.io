import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createStaticExportServer, resolveStaticCandidates } from './e2e/static-export-server.mjs';

async function createFixtureServer(testContext) {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), 'hybrid-static-server-'));
  await mkdir(path.join(rootDirectory, '_next', 'static'), { recursive: true });
  await writeFile(path.join(rootDirectory, 'index.html'), '<!doctype html><script src="/lllogicstic.github.io/_next/static/app.js"></script>');
  await writeFile(path.join(rootDirectory, '_next', 'static', 'app.js'), 'globalThis.fixtureHydrated = true;');
  const server = createStaticExportServer({ rootDirectory });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  testContext.after(async () => {
    server.close();
    await once(server, 'close');
    await rm(rootDirectory, { recursive: true, force: true });
  });
  return server;
}

function requestServer(server, requestPath, method = 'GET') {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: '127.0.0.1', port: address.port, path: requestPath, method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

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

test('serves prefixed fixtures over HTTP with GET and HEAD semantics', async (testContext) => {
  const server = await createFixtureServer(testContext);
  const root = await requestServer(server, '/');
  const prefixed = await requestServer(server, '/lllogicstic.github.io/');
  const asset = await requestServer(server, '/lllogicstic.github.io/_next/static/app.js');
  const head = await requestServer(server, '/lllogicstic.github.io/', 'HEAD');

  assert.equal(root.status, 200);
  assert.match(root.body, /\/lllogicstic\.github\.io\/_next\//);
  assert.equal(prefixed.status, 200);
  assert.equal(asset.status, 200);
  assert.match(asset.body, /fixtureHydrated/);
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], String(Buffer.byteLength(prefixed.body)));
});

test('returns explicit HTTP errors without normalizing traversal into the index fallback', async (testContext) => {
  const server = await createFixtureServer(testContext);
  const method = await requestServer(server, '/', 'POST');
  const missing = await requestServer(server, '/missing.js');
  const traversal = await requestServer(server, '/lllogicstic.github.io/%2e%2e/secret');

  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, 'GET, HEAD');
  assert.equal(missing.status, 404);
  assert.equal(traversal.status, 400);
});
