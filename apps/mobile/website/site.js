// The website's chrome: one page shown at a time, the pager at the bottom, light/dark and animation toggles. Each
// page's own interaction lives in demos.js. Plain browser JS on purpose: the website is static and loads no app code.
import { startDemos } from "./demos.js";

const THEME_KEY = "gigsync-site-theme";
const DARK = "dark";
const LIGHT = "light";
const ANIM_CLASS = "anim";
const ON = "on";
const BACK = "back";
const ARROW_LEFT = "ArrowLeft";
const ARROW_RIGHT = "ArrowRight";

const pages = [...document.querySelectorAll(".page")];
const dots = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageNo = document.getElementById("pageNo");
const pageName = document.getElementById("pageName");
document.getElementById("pageTotal").textContent = String(pages.length);

let current = 0;
const demos = startDemos();

/** Shows page `index` (0-based); `index` outside the range is clamped. Also updates the hash so a page can be linked. */
function show(index) {
  const next = Math.max(0, Math.min(pages.length - 1, index));
  const goingBack = next < current;
  pages.forEach((page, i) => {
    page.classList.toggle(ON, i === next);
    page.classList.toggle(BACK, i === next ? false : goingBack ? i > next : i < next);
    if (i === next) page.scrollTop = 0;
  });
  for (const [i, dot] of [...dots.children].entries()) {
    dot.classList.toggle(ON, i === next);
    dot.setAttribute("aria-selected", String(i === next));
    if (i === next) dot.scrollIntoView({ block: "nearest", inline: "center" });
  }
  prevBtn.disabled = next === 0;
  nextBtn.disabled = next === pages.length - 1;
  pageNo.textContent = String(next + 1).padStart(2, "0");
  pageName.textContent = pages[next].dataset.name ?? "";
  current = next;
  try {
    history.replaceState(null, "", `#${next + 1}`);
  } catch {}
  demos.onPageShown(pages[next]);
}

pages.forEach((page, i) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.setAttribute("role", "tab");
  dot.innerHTML = `${String(i + 1).padStart(2, "0")}<span>${page.dataset.name ?? ""}</span>`;
  dot.addEventListener("click", () => show(i));
  dots.appendChild(dot);
});
prevBtn.addEventListener("click", () => show(current - 1));
nextBtn.addEventListener("click", () => show(current + 1));
for (const button of document.querySelectorAll("[data-go]")) {
  button.addEventListener("click", () => show(Number(button.dataset.go) - 1));
}
document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === ARROW_RIGHT) show(current + 1);
  if (event.key === ARROW_LEFT) show(current - 1);
});

// Light / dark for the website only (kept apart from the app's Settings › Look).
const root = document.documentElement;
document.getElementById("themeBtn").addEventListener("click", () => {
  const next = root.dataset.theme === LIGHT ? DARK : LIGHT;
  root.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
});

const animBtn = document.getElementById("animBtn");
document.body.classList.add(ANIM_CLASS);
animBtn.addEventListener("click", () => {
  const on = !document.body.classList.contains(ANIM_CLASS);
  document.body.classList.toggle(ANIM_CLASS, on);
  animBtn.setAttribute("aria-pressed", String(on));
});

/** `#3` opens page 3; anything else opens the first page. Typing a new hash in the address bar also switches. */
function showFromHash() {
  const fromHash = Number(location.hash.replace("#", ""));
  show(Number.isFinite(fromHash) && fromHash > 0 ? fromHash - 1 : 0);
}
window.addEventListener("hashchange", showFromHash);
showFromHash();
