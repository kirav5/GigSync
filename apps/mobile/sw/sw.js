// The web app's service worker: the app shell for offline starts, and notifications (Web Push, see below). The plugin
// in vite.config.ts copies this file into the build and fills in the two placeholders below: the cache's name (a hash of the built file
// names) and the list to precache. Release web builds only (adapters/install.ts registers it); the native apps load
// from their bundle.
//
// What it never touches: requests that are not GET, and other origins, which is where the API lives. Signed records,
// messages and the board always come from the network, so offline shows as offline instead of as old data.

const CACHE_PREFIX = "gigsync-shell-";
const CACHE = `${CACHE_PREFIX}__CACHE__`;
/** Relative to this file: the app, the manifest and icons, and every built file of the app under assets/. */
const SHELL = __SHELL__;
/** A slow network should not hold a start hostage: after this, open the copy of the app kept here. */
const NAV_TIMEOUT_MS = 3000;
const GET = "GET";
const NAVIGATE = "navigate";

const scoped = (path) => new URL(path, self.registration.scope);
/** The app's own address. The site's root is the website now, and index.html redirects there. */
const APP = scoped("app").href;
/**
 * The website's pages are never answered with the app shell. The home page's other address, the root, is: an app
 * installed before the website moved in still starts there, and offline that start has to open the app.
 */
const WEBSITE = new Set([scoped("home").pathname, scoped("story").pathname]);
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
    if (!WEBSITE.has(url.pathname)) event.respondWith(navigate(request));
    return;
  }
  if (url.pathname.startsWith(ASSETS)) event.respondWith(cacheFirst(request));
});

/** Network first, so a new release shows on the next start; this build's app when offline or slow. */
async function navigate(request) {
  const late = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  try {
    const response = await Promise.race([fetch(request), late]);
    if (response) return response;
  } catch {
    // Offline: fall through to the shell.
  }
  const shell = await (await caches.open(CACHE)).match(APP);
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

// ── Notifications ─────────────────────────────────────────────────────────────────────────────────────────────────
// When job news lands in this owner's mailbox the API sends a push saying what kind of message came and from whom,
// encrypted to this phone (workers/api/src/push/webpush.ts, ADR 0044); the browser decrypts it before it gets here.
// The sender's name comes from the names the app gives this worker (adapters/push.ts), never from the server, and the
// words follow the owner's language. A push from before ADR 0044 is empty: then only "something new".
const PREFS = "gigsync-prefs";
const LANG_KEY = scoped("__lang").href;
const NAMES_KEY = scoped("__names").href;
const SW_LANG = "gigsync-lang";
const SW_NAMES = "gigsync-names";
/** Told to every open page when a push lands, so it checks its mailbox now; the same value as in adapters/push.ts. */
const SW_PUSHED = "gigsync-pushed";
const ALERT_TAG = "gigsync-job";
const ICON = scoped("icons/icon-192.png").href;
const DEFAULT_LANG = "en";
const TITLE = "GigSync";
const VISIBLE = "visible";
const WINDOW = "window";
/** What a notification says for each kind of message, by language; `other` when the kind is not known here. */
const SAYS = {
  en: {
    request: "New work request",
    clarify: "Has a question for you",
    agree: "Signed the deal",
    contact_release: "Shared contact details",
    update: "Sent an update on the job",
    delivery: "Marked the work done",
    review: "Rated the work",
    cancel: "Cancelled the job",
    payment_request: "Asked for payment",
    payment_record: "Recorded a payment",
    problem: "Reported a problem",
    work_offer: "Offered you work",
    referral: "Offered you work",
    note: "Sent you a note",
    other: "Something new on your job. Open GigSync to see it.",
  },
  hi: {
    request: "काम का नया अनुरोध",
    clarify: "आपसे एक सवाल पूछा है",
    agree: "सौदे पर साइन किया",
    contact_release: "संपर्क जानकारी भेजी",
    update: "काम की नई जानकारी भेजी",
    delivery: "काम पूरा होने की बात कही",
    review: "काम को रेटिंग दी",
    cancel: "काम रद्द किया",
    payment_request: "भुगतान माँगा",
    payment_record: "भुगतान दर्ज किया",
    problem: "एक समस्या बताई",
    work_offer: "आपको काम ऑफ़र किया",
    referral: "आपको काम ऑफ़र किया",
    note: "आपको संदेश भेजा",
    other: "आपके काम में कुछ नया है। देखने के लिए GigSync खोलें।",
  },
  kn: {
    request: "ಹೊಸ ಕೆಲಸದ ವಿನಂತಿ",
    clarify: "ನಿಮಗೊಂದು ಪ್ರಶ್ನೆ ಕೇಳಿದ್ದಾರೆ",
    agree: "ಒಪ್ಪಂದಕ್ಕೆ ಸಹಿ ಮಾಡಿದ್ದಾರೆ",
    contact_release: "ಸಂಪರ್ಕ ವಿವರ ಕಳುಹಿಸಿದ್ದಾರೆ",
    update: "ಕೆಲಸದ ಹೊಸ ಮಾಹಿತಿ ಕಳುಹಿಸಿದ್ದಾರೆ",
    delivery: "ಕೆಲಸ ಮುಗಿದಿದೆ ಎಂದಿದ್ದಾರೆ",
    review: "ಕೆಲಸಕ್ಕೆ ರೇಟಿಂಗ್ ನೀಡಿದ್ದಾರೆ",
    cancel: "ಕೆಲಸ ರದ್ದುಮಾಡಿದ್ದಾರೆ",
    payment_request: "ಹಣ ಕೇಳಿದ್ದಾರೆ",
    payment_record: "ಪಾವತಿ ದಾಖಲಿಸಿದ್ದಾರೆ",
    problem: "ಒಂದು ಸಮಸ್ಯೆ ತಿಳಿಸಿದ್ದಾರೆ",
    work_offer: "ನಿಮಗೆ ಕೆಲಸ ನೀಡಿದ್ದಾರೆ",
    referral: "ನಿಮಗೆ ಕೆಲಸ ನೀಡಿದ್ದಾರೆ",
    note: "ನಿಮಗೆ ಸಂದೇಶ ಕಳುಹಿಸಿದ್ದಾರೆ",
    other: "ನಿಮ್ಮ ಕೆಲಸದಲ್ಲಿ ಹೊಸ ಸುದ್ದಿ ಇದೆ. ನೋಡಲು GigSync ತೆರೆಯಿರಿ.",
  },
};
/** Mentor and colleague messages read alike: a note. */
const NOTE_KINDS = new Set(["landing_request", "mentor_offer", "colleague_note"]);

const keep = (key, value) => caches.open(PREFS).then((cache) => cache.put(key, new Response(JSON.stringify(value))));
async function kept(key, fallback) {
  try {
    const found = await (await caches.open(PREFS)).match(key);
    return found ? await found.json() : fallback;
  } catch {
    return fallback;
  }
}

self.addEventListener("message", (event) => {
  const { type, lang, names } = event.data ?? {};
  if (type === SW_LANG && lang in SAYS) event.waitUntil(keep(LANG_KEY, lang));
  if (type === SW_NAMES && names && typeof names === "object") event.waitUntil(keep(NAMES_KEY, names));
});

self.addEventListener("push", (event) => event.waitUntil(alertOwner(newsOf(event))));

/** The news a push carries, or nothing (an empty push, or one this worker cannot read). */
function newsOf(event) {
  try {
    const news = event.data?.json();
    return news && typeof news.kind === "string" && typeof news.from === "string" ? news : undefined;
  } catch {
    return undefined;
  }
}

/** Who sent it and what came, in the owner's language; unless the app is on screen, which shows it itself. */
async function alertOwner(news) {
  const windows = await self.clients.matchAll({ type: WINDOW, includeUncontrolled: true });
  // An open app checks its mailbox seldom while nothing moves (useGig.ts): this tells it something has. Only that
  // a push came, never what it carried.
  for (const w of windows) w.postMessage({ type: SW_PUSHED });
  if (windows.some((w) => w.visibilityState === VISIBLE)) return;
  const lang = await kept(LANG_KEY, DEFAULT_LANG);
  const says = SAYS[lang] ?? SAYS[DEFAULT_LANG];
  const names = news ? await kept(NAMES_KEY, {}) : {};
  const name = news ? names[news.from] : undefined;
  const kind = news && NOTE_KINDS.has(news.kind) ? "note" : news?.kind;
  const body = (kind && says[kind]) || says.other;
  await self.registration.showNotification(typeof name === "string" && name ? name : TITLE, {
    body,
    // One notification per person, replaced by their next news; the rest share one.
    tag: news ? `${ALERT_TAG}-${news.from}` : ALERT_TAG,
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
      return open ? open.focus() : self.clients.openWindow(APP);
    }),
  );
});
