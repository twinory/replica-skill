/**
 * A local preview of the Worker without wrangler.
 *
 * `wrangler dev` is the real thing and should be your first choice. This exists
 * because wrangler needs npm install and a login in some environments, while this
 * file needs only node. It runs the actual src/index.js, so routing, headers and
 * the /v1/* endpoints behave as they do in production. The only thing it stands
 * in for is the ASSETS binding: Cloudflare quietly serves ./public, and here a
 * small static handler does the same.
 *
 *   node tools/preview.mjs            # http://0.0.0.0:8080
 *   node tools/preview.mjs 3000       # another port
 *
 * Deliberate difference from production: this drops x-frame-options and widens
 * frame-ancestors so the page can be embedded in a preview pane. The deployed
 * Worker keeps SAMEORIGIN, which is correct for a real site.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = normalize(join(here, '..'));
const publicDir = join(root, 'public');

const { default: worker } = await import(join(root, 'src', 'index.js'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
};

async function serveAsset(request) {
  const url = new URL(request.url);
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const target = join(publicDir, relative || 'index.html');
  if (!target.startsWith(publicDir + sep) && target !== publicDir) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      return new Response('Not found', { status: 404 });
    }
    const body = await readFile(target);
    return new Response(body, {
      headers: {
        'content-type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
        'content-length': String(info.size),
        'last-modified': info.mtime.toUTCString(),
        etag: `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`,
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

const env = {
  ASSETS: { fetch: serveAsset },
  MIN_APP_VERSION: '0.1.0',
  ANDROID_BUILD_URL: '',
  IOS_BUILD_URL: '',
};

function previewable(response) {
  const headers = new Headers(response.headers);
  headers.delete('x-frame-options');
  const csp = headers.get('content-security-policy');
  if (csp) {
    headers.set('content-security-policy', csp.replace("frame-ancestors 'self'", 'frame-ancestors *'));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const port = Number(process.argv[2] || process.env.PORT || 8080);

createServer(async (req, res) => {
  const scheme = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${port}`;
  const url = new URL(req.url, `${scheme}://${host}`);

  try {
    const response = await worker.fetch(new Request(url, {
      method: req.method,
      headers: req.headers,
    }), env);
    const final = previewable(response);
    res.writeHead(final.status, Object.fromEntries(final.headers));
    res.end(Buffer.from(await final.arrayBuffer()));
    console.log(`${req.method} ${url.pathname} ${final.status}`);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Preview server error: ' + error.message);
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Husk preview on http://0.0.0.0:${port} (worker: src/index.js, assets: public/)`);
});
