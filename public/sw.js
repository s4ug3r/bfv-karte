/*
 * Service Worker: Die App startet auch ohne Netz (z. B. am Sportplatz mit schlechtem Empfang).
 *
 * - Seite (index.html): erst Netz, bei Fehler die zuletzt gespeicherte Fassung.
 * - Programmdateien (/assets/…, mit Hash im Namen): einmal laden, dann aus dem Speicher.
 * - Icons, Manifest, Ortsverzeichnis, Schriften: aus dem Speicher, im Hintergrund aktualisiert.
 * - BFV-Daten (/bfv-api, /bfv-web) und Google laufen NICHT über diesen Speicher. Die zuletzt
 *   geladenen Spiele hält die App selbst im Browser (React-Query-Cache).
 */
const VERSION = 'v1';
const SHELL = `bfv-shell-${VERSION}`;
const ASSETS = `bfv-assets-${VERSION}`;
const STATIC = `bfv-static-${VERSION}`;
const KEEP = [SHELL, ASSETS, STATIC];

const STATIC_FILES = ['/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

/** Programmdateien aus der Seite lesen ("/assets/index-abc123.js"). */
const assetUrls = (html) => [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];

async function cacheShell() {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await (await caches.open(SHELL)).put('/', res);
  const assets = await caches.open(ASSETS);
  await Promise.all(assetUrls(html).map((u) => assets.add(u).catch(() => {})));
  const statics = await caches.open(STATIC);
  await Promise.all(STATIC_FILES.map((u) => statics.add(u).catch(() => {})));
}

/** Programmdateien alter Versionen entfernen, die die aktuelle Seite nicht mehr nutzt. */
async function pruneAssets(html) {
  const keep = new Set(assetUrls(html));
  if (keep.size === 0) return;
  const cache = await caches.open(ASSETS);
  for (const req of await cache.keys()) {
    if (!keep.has(new URL(req.url).pathname)) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function networkFirstPage(event) {
  try {
    const res = await fetch(event.request);
    if (res.ok) {
      const copy = res.clone();
      event.waitUntil(
        (async () => {
          await (await caches.open(SHELL)).put('/', copy.clone());
          await pruneAssets(await copy.text());
        })(),
      );
    }
    return res;
  } catch {
    return (await caches.match('/', { cacheName: SHELL })) ?? Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) await (await caches.open(cacheName)).put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const update = fetch(event.request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') return cache.put(event.request, res.clone()).then(() => res);
      return res;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(update.catch(() => {}));
    return cached;
  }
  return (await update) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Google-Schriften: aus dem Speicher, damit die App offline gleich aussieht
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, STATIC));
    return;
  }
  if (url.origin !== self.location.origin) return; // Google Maps usw. nicht anfassen
  if (url.pathname.startsWith('/bfv-api/') || url.pathname.startsWith('/bfv-web/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/data/orte-') ||
    STATIC_FILES.includes(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(event, STATIC));
  }
});
