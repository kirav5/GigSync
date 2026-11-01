// The web app's service worker: the app shell for offline starts, and job alerts (empty Web Pushes, see below). The plugin in vite.config.ts
// copies this file into the build and fills in the two placeholders below: the cache's name (a hash of the built file
// names) and the list to precache. Release web builds only (adapters/install.ts registers it); the native apps load
// from their bundle.
//
// What it never touches: requests that are not GET, and other origins, which is where the API lives. Signed records,
// messages and the board always come from the network, so offline shows as offline instead of as old data.

const CACHE_PREFIX = "gigsync-shell-";
const CACHE = `${CACHE_PREFIX}__CACHE__`;
/** Relative to this file: ./, index.html, the manifest and icons, and every built file under assets/. */
const SHELL = __SHELL__;
/** A slow network should not hold a start hostage: after this, open the copy of the app kept here. */
const NAV_TIMEOUT_MS = 3000;
const GET = "GET";
const NAVIGATE = "navigate";

const scoped = (path) => new URL(path, self.registration.scope);
const INDEX = scoped("index.html").href;
/** The website is its own page, not the app: it is never answered with the app shell. */
const WEBSITE = scoped("home.html").pathname;
const ASSETS = scoped("assets/").pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

// Old shells are deleted, except the one before this: a page still running the previous build can load its own files.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const older = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE);
        return Promise.all(older.slice(0, -1).map((key) => caches.delete(key)));
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== GET) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === NAVIGATE) {
    if (url.pathname !== WEBSITE) event.respondWith(navigate(request));
    return;
  }
  if (url.pathname.startsWith(ASSETS)) event.respondWith(cacheFirst(request));
});

/** Network first, so a new release shows on the next start; this build's index.html when offline or slow. */
async function navigate(request) {
  const late = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  try {
    const response = await Promise.race([fetch(request), late]);
    if (response) return response;
  } catch {
    // Offline: fall through to the shell.
  }
  const shell = await (await caches.open(CACHE)).match(INDEX);
  return shell ?? Response.error();
}

/** Built files have a hash in their name, so a copy here is never stale. */
async function cacheFirst(request) {
  const kept = await caches.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

// ── Job alerts ────────────────────────────────────────────────────────────────────────────────────────────────────
// The API sends an empty push when job news lands in this owner's mailbox (workers/api/src/push/webpush.ts): the push
// says nothing about the job, so the alert can only say there is news. The app, once open, reads its own sealed
// messages. The words follow the owner's language, which the app tells this worker on each open (adapters/push.ts).

const PREFS = "gigsync-prefs";
const LANG_KEY = scoped("__lang").href;
const SW_LANG = "gigsync-lang";
const ALERT_TAG = "gigsync-job";
const ICON = scoped("icons/icon-192.png").href;
const DEFAULT_LANG = "en";
const ALERT = {
  en: "Your job has an update. Open GigSync to see it.",
  hi: "आपके काम में कुछ नया है। देखने के लिए GigSync खोलें।",
  kn: "ನಿಮ್ಮ ಕೆಲಸದಲ್ಲಿ ಹೊಸ ಸುದ್ದಿ ಇದೆ. ನೋಡಲು GigSync ತೆರೆಯಿರಿ.",
};
const TITLE = "GigSync";
const VISIBLE = "visible";
const WINDOW = "window";

self.addEventListener("message", (event) => {
  const { type, lang } = event.data ?? {};
  if (type !== SW_LANG || !(lang in ALERT)) return;
  event.waitUntil(caches.open(PREFS).then((cache) => cache.put(LANG_KEY, new Response(lang))));
});

self.addEventListener("push", (event) => event.waitUntil(alertOwner()));

/** A plain alert, unless the app is on screen: then it shows the news itself within seconds. */
async function alertOwner() {
  const windows = await self.clients.matchAll({ type: WINDOW, includeUncontrolled: true });
  if (windows.some((w) => w.visibilityState === VISIBLE)) return;
  const kept = await (await caches.open(PREFS)).match(LANG_KEY);
  const lang = kept ? await kept.text() : DEFAULT_LANG;
  await self.registration.showNotification(TITLE, {
    body: ALERT[lang] ?? ALERT[DEFAULT_LANG],
    tag: ALERT_TAG,
    renotify: true,
    icon: ICON,
  });
}

// Tapping the alert brings the app forward, or opens it.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: WINDOW, includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      return open ? open.focus() : self.clients.openWindow(scoped("./").href);
    }),
  );
});
