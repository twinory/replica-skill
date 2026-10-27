/**
 * Veil update server and site.
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
    name: 'veil-updates',
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
      return json({ ok: true, service: 'veil-updates', time: new Date().toISOString() });
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
        return new Response('No Android build configured yet.', { status: 503 });
      }
      return Response.redirect(target, 302);
    }

    if (path === '/download/ios') {
      const target = env.IOS_BUILD_URL;
      if (!target) {
        return new Response(
          'No iOS build configured. Apple installs only signed builds: set IOS_BUILD_URL to a TestFlight or App Store link.',
          { status: 503 },
        );
      }
      return Response.redirect(target, 302);
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 404) {
      const fallback = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin)));
      return withSecurity(fallback, { html: true });
    }
    const type = asset.headers.get('content-type') || '';
    return withSecurity(asset, { html: type.includes('text/html') });
  },
};
