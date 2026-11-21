// The demo: two phones play one job, from a household's request to the worker's receipt, scrubbed by the reader's
// scroll. The stage is pinned while the section scrolls past; the share of the section scrolled picks a beat, and every
// beat up to it is on the phones. Scrolling back takes beats off again, so nothing runs on a clock.
//
// Each beat is plain data (beats.js). A typing beat shows its dots only while it is the newest; a sealed note crosses
// between the phones over its own beat, its position following the scroll inside that beat; a view beat turns a phone
// from its chat to one of its own screens, such as her card or her record.

import { BEATS, HOME, TO_WORKER, View, WORKER } from "./beats.js";

const IN = "in";
const ON = "on";
const TAPPED = "tapped";
const STEP_CURRENT = "step";
const PLAYING = "playing";
const DONE = "done";
/** The shown progress closes most of the gap to the scroll in this many milliseconds, so a wheel notch glides. */
const CHASE_MS = 120;
const MAX_FRAME_MS = 50;
const SETTLED = 0.0004;
/** How far up the screen the section must come before the phones enter. */
const ENTER_MARGIN = "0px 0px -33% 0px";
/** Where the scene starts and ends inside the section's scroll: a little room to arrive and to leave. */
const LEAD = 0.04;
const TAIL = 0.94;
/** Where the sealed note starts and lands, as shares of the phones' box (left, top). */
const SEAL_WORKER = { x: 0.24, y: 0.46 };
const SEAL_HOME = { x: 0.7, y: 0.36 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const KANNADA = /[ಀ-೿]/;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function card({ k, b, li }, cls) {
  const node = el("div", `dm-card${cls ? ` ${cls}` : ""}`);
  node.append(el("span", "k", k), el("b", "", b));
  const list = el("ul");
  for (const line of li) list.append(el("li", "", line));
  node.append(list);
  return node;
}

/** The nodes a beat puts on each phone, made once: [phone, node] pairs. */
function nodesFor(beat) {
  const make = () => (beat.note ? el("div", "dm-note", beat.note) : card(beat.card, beat.cls));
  if (beat.both) return [WORKER, HOME].map((on) => [on, make()]);
  if (beat.seal || beat.view) return [];
  if (beat.note) return [[beat.on, make()]];
  if (beat.typing) return [[beat.on, Object.assign(el("div", "dm-typing"), { innerHTML: "<i></i><i></i><i></i>" })]];
  if (beat.me) return [[beat.on, el("div", "dm-msg me", beat.me)]];
  if (beat.bot) {
    const m = el("div", "dm-msg bot");
    m.append(el("span", "who", "Assistant"), document.createTextNode(beat.bot));
    return [[beat.on, m]];
  }
  if (beat.card) return [[beat.on, card(beat.card, beat.cls)]];
  const row = el("div", "dm-btns");
  beat.buttons.forEach((t, i) => {
    const span = el("span", i === 0 ? "go" : "", t);
    if (KANNADA.test(t)) span.classList.add("kn");
    row.append(span);
  });
  return [[beat.on, row]];
}

/** Puts exactly `want` in `chat`, in order, leaving nodes already there in place so they do not animate again. */
function sync(chat, want) {
  for (const node of [...chat.children]) if (!want.includes(node)) node.remove();
  let before = null;
  for (let i = want.length - 1; i >= 0; i--) {
    const node = want[i];
    if (node.parentNode !== chat || node.nextSibling !== before) chat.insertBefore(node, before);
    before = node;
  }
}

/** @param {HTMLElement} section */
export function startDemo(section) {
  const phones = section.querySelector("#demoPhones");
  const seal = section.querySelector("#demoSeal");
  const track = section.querySelector("#demoTrack");
  const steps = [...section.querySelectorAll("#demoSteps li")];
  const chats = {
    [WORKER]: phones.querySelector('[data-chat="worker"]'),
    [HOME]: phones.querySelector('[data-chat="home"]'),
  };
  const views = {
    [WORKER]: [...phones.querySelectorAll(".dm-worker [data-view]")],
    [HOME]: [...phones.querySelectorAll(".dm-home [data-view]")],
  };
  const made = BEATS.map(nodesFor);
  const total = BEATS.length;
  let shown = 0;
  let target = 0;
  let beatNow = -2;
  let last = 0;
  let frame = 0;

  const progress = () => {
    const r = section.getBoundingClientRect();
    const run = r.height - window.innerHeight;
    return run > 0 ? clamp01(-r.top / run) : 1;
  };

  const showBeat = (b) => {
    for (const on of [WORKER, HOME]) {
      const want = [];
      made.forEach((pairs, i) => {
        if (i > b) return;
        for (const [who, node] of pairs) {
          if (who !== on) continue;
          if (BEATS[i].typing && i !== b) continue;
          want.push(node);
        }
      });
      sync(chats[on], want);
      let view = View.chat;
      for (let i = 0; i <= b; i++) if (BEATS[i].view && BEATS[i].on === on) view = BEATS[i].view;
      for (const screen of views[on]) screen.classList.toggle(ON, screen.dataset.view === view);
    }
    made.forEach((pairs, i) => {
      if (!BEATS[i].buttons) return;
      pairs[0][1].firstElementChild.classList.toggle(TAPPED, b > i);
    });
    const ch = b < 0 ? 0 : BEATS[b].ch;
    steps.forEach((li, i) => {
      li.classList.toggle(ON, i === ch);
      if (i === ch) li.setAttribute("aria-current", STEP_CURRENT);
      else li.removeAttribute("aria-current");
    });
  };

  const showSeal = (b, f) => {
    const beat = BEATS[b];
    if (!beat?.seal) {
      seal.style.opacity = "0";
      return;
    }
    const [from, to] = beat.seal === TO_WORKER ? [SEAL_HOME, SEAL_WORKER] : [SEAL_WORKER, SEAL_HOME];
    const e = f * f * (3 - 2 * f);
    const x = from.x + (to.x - from.x) * e;
    const y = from.y + (to.y - from.y) * e - Math.sin(Math.PI * e) * 0.1;
    seal.style.left = `${(x * 100).toFixed(2)}%`;
    seal.style.top = `${(y * 100).toFixed(2)}%`;
    seal.style.transform = `translate(-50%, -50%) rotate(${((e - 0.5) * 16).toFixed(1)}deg)`;
    seal.style.opacity = String(Math.min(1, Math.sin(Math.PI * f) * 2.2).toFixed(3));
  };

  const apply = (p) => {
    const q = clamp01((p - LEAD) / (TAIL - LEAD));
    const at = q * total;
    const b = p < LEAD ? -1 : Math.min(total - 1, Math.floor(at));
    if (b !== beatNow) {
      beatNow = b;
      showBeat(b);
    }
    showSeal(b, b < 0 ? 0 : clamp01(at - b));
    track.style.transform = `scaleX(${q.toFixed(4)})`;
    section.classList.toggle(PLAYING, b >= 0);
    section.classList.toggle(DONE, q >= 1);
  };

  const tick = (now) => {
    frame = 0;
    const dt = Math.min(MAX_FRAME_MS, now - (last || now));
    last = now;
    const gap = target - shown;
    shown = Math.abs(gap) < SETTLED ? target : shown + gap * (1 - Math.exp(-dt / CHASE_MS));
    apply(shown);
    if (shown !== target) frame = requestAnimationFrame(tick);
    else last = 0;
  };

  const onScroll = () => {
    target = progress();
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // the section is many screens tall, so a share of it on screen is never reached: the phones come in once its top is
  // a third of the way up the screen, and go when it has left
  new IntersectionObserver(([entry]) => section.classList.toggle(IN, entry.isIntersecting), {
    rootMargin: ENTER_MARGIN,
  }).observe(section);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  shown = target = progress();
  apply(shown);

  return {
    /** Scrolls to the middle of a chapter's first beat. */
    goTo(chapter) {
      const first = BEATS.findIndex((beat) => beat.ch === chapter);
      const run = section.offsetHeight - window.innerHeight;
      const q = (first + 0.6) / total;
      const p = LEAD + q * (TAIL - LEAD);
      const top = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + p * run, behavior: "smooth" });
    },
  };
}
