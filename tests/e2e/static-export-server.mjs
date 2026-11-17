import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_PATH = '/lllogicstic.github.io';
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function resolveStaticCandidates(requestPath, basePath = DEFAULT_BASE_PATH) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestPath.split(/[?#]/, 1)[0]);
  } catch {
    return [];
  }

  if (pathname.includes('\\') || pathname.split('/').includes('..')) return [];
  if (pathname === basePath) pathname = '/';
  else if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);

  const relativePath = pathname.replace(/^\/+/, '');
  if (!relativePath) return ['index.html'];
  if (relativePath.endsWith('/')) return [`${relativePath}index.html`, 'index.html'];
  if (path.posix.extname(relativePath)) return [relativePath];
  return [relativePath, `${relativePath}/index.html`, 'index.html'];
}

async function findStaticFile(rootDirectory, candidates) {
  const root = path.resolve(rootDirectory);
  for (const candidate of candidates) {
    const filePath = path.resolve(root, candidate);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) continue;
    try {
      if ((await stat(filePath)).isFile()) return filePath;
    } catch {
      // Try the next static-export candidate.
    }
  }
  return null;
}

export function createStaticExportServer({ rootDirectory = path.resolve(process.cwd(), 'out'), basePath = DEFAULT_BASE_PATH } = {}) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method Not Allowed');
      return;
    }

    const candidates = resolveStaticCandidates(request.url ?? '/', basePath);
    if (!candidates.length) {
      response.writeHead(400);
      response.end('Bad Request');
      return;
    }

    const filePath = await findStaticFile(rootDirectory, candidates);
    if (!filePath) {
      response.writeHead(404);
      response.end('Not Found');
      return;
    }

    const fileStats = await stat(filePath);
    response.writeHead(200, {
      'Content-Length': fileStats.size,
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryUrl) {
  const port = Number(process.env.PORT ?? 4173);
  const host = process.env.HOST ?? '127.0.0.1';
  createStaticExportServer().listen(port, host, () => {
    process.stdout.write(`Static export server listening at http://${host}:${port}\n`);
  });
}
