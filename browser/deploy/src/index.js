/**
 * Husk update server and site.
 *
 * Three jobs, in this order of importance:
 *   1. /v1/manifest.json tells an installed app where its lists live.
 *   2. /v1/patches.json and /v1/filters/base.txt are the lists themselves,
 *      synced from the app's assets at deploy time so there is one source of
 *      truth instead of a copy that drifts.
 *   3. Everything else is the landing page and the browser demo.
 *
 * A Worker can host an Android APK. It cannot host an iOS build: Apple only
 * installs apps Apple signed, so the iOS button points at TestFlight or the
 * App Store and the deploy will fail loudly if that is not configured.
 */

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
};

const HTML_CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

function cors(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'content-type, if-none-match',
    ...extra,
  };
}

function json(body, maxAge = 0, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store',
      ...cors(),
      ...SECURITY_HEADERS,
      ...extra,
    },
  });
}

function text(body, maxAge = 0) {
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store',
      ...cors(),
      ...SECURITY_HEADERS,
    },
  });
}

function manifest(env, url) {
  return {
    name: 'husk-updates',
    version: 1,
    generatedAt: new Date().toISOString(),
    minAppVersion: env.MIN_APP_VERSION || '0.1.0',
    updates: {
      patches: `${url.origin}/v1/patches.json`,
      filters: `${url.origin}/v1/filters/base.txt`,
    },
    builds: {
      android: env.ANDROID_BUILD_URL || '',
      ios: env.IOS_BUILD_URL || '',
    },
    note:
      'Lists are served from this Worker so an installed app can be repaired without a store release. ' +
      'Bump the patches version when you change App view selectors.',
  };
}

async function withSecurity(response, { html = false } = {}) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  if (html) {
    headers.set('content-security-policy', HTML_CSP);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * A download link with no build behind it. Plain text here read like a crash,
 * when it is really a deliberate state: there is nothing to install yet. The
 * status stays 503 so a script can tell the difference, but a person gets a
 * page that says what is missing and how to fix it.
 */
function notBuilt({ heading, why, fix }) {
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
    background: Canvas; color: CanvasText; padding: 24px; }
  main { max-width: 34rem; }
  h1 { font-size: 1.5rem; margin: 0 0 12px; }
  p { margin: 0 0 12px; }
  code { font-size: 0.9em; word-break: break-all; }
  a { color: inherit; }
  .back { display: inline-block; margin-top: 16px; padding: 10px 18px;
    border: 1px solid currentColor; border-radius: 999px; text-decoration: none; }
</style>
</head>
<body>
<main>
  <h1>${heading}</h1>
  <p>${why}</p>
  <p>${fix}</p>
  <a class="back" href="/">Back to the site</a>
</main>
</body>
</html>
`;
  return new Response(body, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// Extensionless paths, kept working because the assets layer used to redirect
// /demo.html to /demo before html_handling was pinned to none.
const PATH_ALIASES = {
  // With html_handling none the assets layer stops mapping the root to
  // index.html, so the root is an alias like any other.
  '/': '/index.html',
  '/demo': '/demo.html',
  '/limits': '/limits.html',
  '/index': '/index.html',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method not allowed' }, 0, {});
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/health') {
      return json({ ok: true, service: 'husk-updates', time: new Date().toISOString() });
    }

    if (path === '/v1/manifest.json') {
      return json(manifest(env, url), 60);
    }

    if (path === '/v1/patches.json' || path === '/v1/filters/base.txt') {
      const assetUrl = new URL(path, url.origin);
      const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }));
      if (asset.status === 404) {
        return text(
          'Not synced yet. Run npm run sync from browser/deploy before deploying.\n',
          0,
        );
      }
      const body = await asset.text();
      const headers = {
        ...cors(),
        ...SECURITY_HEADERS,
        'cache-control': 'public, max-age=300',
      };
      return new Response(body, {
        headers: {
          ...headers,
          'content-type': path.endsWith('.json')
            ? 'application/json; charset=utf-8'
            : 'text/plain; charset=utf-8',
        },
      });
    }

    if (path.startsWith('/v1/')) {
      return json({ error: 'unknown endpoint', path }, 0);
    }

    if (path === '/download/android') {
      const target = env.ANDROID_BUILD_URL;
      if (!target) {
        return withSecurity(notBuilt({
          heading: 'No Android build yet',
          why: 'The Worker is ready to hand out an APK, but none has been uploaded, so there is nothing to download right now.',
          fix: 'Set ANDROID_BUILD_URL in wrangler.toml to the hosted APK, then deploy again.',
        }), { html: true });
      }
      return Response.redirect(target, 302);
    }

    if (path === '/download/ios') {
      const target = env.IOS_BUILD_URL;
      if (!target) {
        return withSecurity(notBuilt({
          heading: 'No iPhone build yet',
          why: 'Apple installs only builds that Apple signed. A Worker can host a file, but it cannot sign an app, so this link has nothing to point at until a TestFlight or App Store build exists.',
          fix: 'Set IOS_BUILD_URL in wrangler.toml to the TestFlight or App Store link, then deploy again.',
        }), { html: true });
      }
      return Response.redirect(target, 302);
    }

    // The assets layer serves .html at its real path, so these two forms both
    // have to work: one is what the landing page links to, the other is what
    // the old extension-drop redirect used.
    const canonical = PATH_ALIASES[path];
    if (canonical) {
      const aliased = await env.ASSETS.fetch(new Request(new URL(canonical, url.origin).toString()));
      return withSecurity(aliased, { html: true });
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 404) {
      // Show the landing page to a person, but keep the 404 so a crawler or a
      // monitor is not told that a typo is a real address.
      const fallback = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin).toString()));
      const body = await fallback.text();
      return withSecurity(
        new Response(body, {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
        { html: true },
      );
    }
    const type = asset.headers.get('content-type') || '';
    return withSecurity(asset, { html: type.includes('text/html') });
  },
};
