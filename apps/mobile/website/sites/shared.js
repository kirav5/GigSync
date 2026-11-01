// What the three full layouts share: the light/dark toggle and the reveal-on-scroll of sections below the fold.
// Everything is visible at rest; only sections that start below the viewport slide in as they arrive.
const THEME_KEY = "gigsync-site-theme";
const DARK = "dark";
const LIGHT = "light";
const ANIM = "anim";
const PRE = "pre";

export function startShared() {
  const root = document.documentElement;
  const body = document.body;
  body.classList.add(ANIM);
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = root.dataset.theme === LIGHT ? DARK : LIGHT;
      root.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
    });
  }
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove(PRE);
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const el of document.querySelectorAll(".rv")) {
    if (el.getBoundingClientRect().top > window.innerHeight) el.classList.add(PRE);
    io.observe(el);
  }
}

/** The `<head>` script every site runs before paint: the site's own light/dark choice, never the app's. */
export function themeFromStorage() {
  let look = null;
  try {
    look = localStorage.getItem(THEME_KEY);
  } catch {}
  document.documentElement.dataset.theme =
    look === LIGHT || look === DARK ? look : matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
}
