// The interactive pieces on the website's pages: the cut slider, the phone-to-phone relay, the language switch, the
// step scrubber, who-sees-what, the counters, voice notes and the budget bars. Everything is example content.
import { EMPTY_LABEL, NOT_STORED, RECORD, RELAY, SAID, SIGNED_STEP, STEPS, VIEW_CLASS } from "./content.js";

const ON = "on";
const OPEN = "open";
const ANIM_CLASS = "anim";
const PLATFORM_CUT = 0.28;
const RELAY_STEP_MS = 2000;
const COUNT_MS = 900;
const WAVE_BARS = 34;
const PLAY = "▶ Play";
const STOP = "■ Stop";

const $ = (id) => document.getElementById(id);
const rupees = (n) => `₹${n.toLocaleString("en-IN")}`;
const animating = () => document.body.classList.contains(ANIM_CLASS);
const toggleEach = (nodes, isOn) => {
  for (const node of nodes) node.classList.toggle(ON, isOn(node));
};
const replay = (el, cls) => {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};

function cutSlider() {
  const job = $("job");
  const render = () => {
    const value = Number(job.value);
    const cut = Math.round(value * PLATFORM_CUT);
    $("jobV").textContent = rupees(value);
    $("pKeep").style.width = `${((value - cut) / value) * 100}%`;
    $("pCut").style.width = `${PLATFORM_CUT * 100}%`;
    $("pAmt").textContent = rupees(value - cut);
    $("gAmt").textContent = rupees(value);
  };
  job.addEventListener("input", render);
  render();
}

function relay() {
  const buttons = document.querySelectorAll("#scrub2 button[data-i]");
  const play = $("play2");
  let step = 0;
  let timer = null;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    play.textContent = PLAY;
  };
  const set = (i) => {
    step = i;
    toggleEach(buttons, (b) => Number(b.dataset.i) === i);
    toggleEach(document.querySelectorAll(".relay .bub"), (b) => Number(b.dataset.s) <= i);
    $("ct2").textContent = RELAY[i].ct;
    $("privH").textContent = RELAY[i].h;
    $("privL").textContent = RELAY[i].l;
    $("privH").classList.toggle("rel", i === SIGNED_STEP);
    $("privL").classList.toggle("rel", i >= SIGNED_STEP);
    const env = $("env2");
    env.classList.remove("go", "back");
    if (i > 0) {
      replay(env, "go");
      if (RELAY[i].back) env.classList.add("back");
    }
  };
  for (const b of buttons) {
    b.addEventListener("click", () => {
      stop();
      set(Number(b.dataset.i));
    });
  }
  play.addEventListener("click", () => {
    if (timer) return stop();
    set(0);
    play.textContent = STOP;
    timer = setInterval(() => (step >= RELAY.length - 1 ? stop() : set(step + 1)), RELAY_STEP_MS);
  });
  set(0);
  return stop;
}

function languages() {
  const buttons = document.querySelectorAll("#lang3 button");
  for (const b of buttons) {
    b.addEventListener("click", () => {
      toggleEach(buttons, (x) => x === b);
      const said = SAID[b.dataset.l];
      $("u3").className = `u ${said.cls}`;
      $("u3").textContent = said.text;
      replay($("a3"), "fade");
    });
  }
}

const kv = (pairs) => `<div class="kv">${pairs.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("")}</div>`;

function steps() {
  const buttons = document.querySelectorAll("#steps21 button");
  const set = (i) => {
    for (const b of buttons) {
      const j = Number(b.dataset.i);
      b.classList.toggle(ON, j === i);
      b.classList.toggle("done", j < i);
    }
    $("prog21").style.width = `${((i + 1) / STEPS.length) * 100}%`;
    const s = STEPS[i];
    $("her21").innerHTML =
      `<div class="vt fade"><i></i>What she sees</div><div class="fade"><h3>${s.h}</h3><p>${s.hp}</p>${kv(s.hk)}</div>`;
    $("srv21").innerHTML =
      `<div class="vt fade"><i></i>What the server sees</div><div class="fade"><h3>${s.s}</h3>${kv(s.sk)}<div class="ct${s.clear ? " clear" : ""}">${s.ct}</div></div>`;
  };
  for (const b of buttons) b.addEventListener("click", () => set(Number(b.dataset.i)));
  set(0);
}

function whoSees() {
  const buttons = document.querySelectorAll("#sw32 button");
  const set = (view) => {
    toggleEach(buttons, (b) => b.dataset.v === view);
    $("card32").innerHTML = RECORD[view]
      .map(([k, v]) => {
        const empty = v === NOT_STORED;
        return `<div class="ln fade"><span>${k}</span><span class="v ${empty ? "none" : VIEW_CLASS[view]}">${empty ? EMPTY_LABEL[view] : v}</span></div>`;
      })
      .join("");
  };
  for (const b of buttons) b.addEventListener("click", () => set(b.dataset.v));
  set("her");
}

/** Counts a tile from 0 to its data-count when its page is shown; without animation it just shows the number. */
function countUp(el) {
  const to = Number(el.dataset.count);
  const prefix = el.dataset.prefix ?? "";
  const suffix = el.dataset.suffix ?? "";
  if (!animating()) {
    el.textContent = `${prefix}${to}${suffix}`;
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / COUNT_MS);
    el.textContent = `${prefix}${Math.round(to * (1 - (1 - p) ** 3))}${suffix}`;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function voiceNotes() {
  const notes = document.querySelectorAll(".note");
  for (const note of notes) {
    const wave = note.querySelector(".wave");
    for (let i = 0; i < WAVE_BARS; i++) {
      const bar = document.createElement("i");
      bar.style.setProperty("--h", `${25 + Math.round(Math.abs(Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 35)}%`);
      bar.style.animationDelay = `${(i * 37) % 600}ms`;
      wave.appendChild(bar);
    }
    const toggle = () => {
      const on = !note.classList.contains("playing");
      for (const n of notes) {
        n.classList.remove("playing");
        n.querySelector(".pl").textContent = PLAY;
      }
      if (on) {
        note.classList.add("playing");
        note.querySelector(".pl").textContent = STOP;
      }
    };
    note.querySelector(".pl").addEventListener("click", toggle);
    wave.addEventListener("click", toggle);
  }
}

function expanders() {
  for (const tile of document.querySelectorAll("[data-tile]")) {
    tile.querySelector(".more").addEventListener("click", () => tile.classList.toggle(OPEN));
  }
  for (const quote of document.querySelectorAll("[data-q]")) {
    quote.querySelector(".x").addEventListener("click", () => quote.classList.toggle(OPEN));
  }
  for (const item of document.querySelectorAll("[data-item]")) {
    item.addEventListener("click", () => item.classList.toggle(OPEN));
  }
  const alloc = $("alloc7");
  for (const line of alloc.querySelectorAll(".al")) {
    line.addEventListener("click", () => {
      const wasOn = line.classList.contains(ON);
      toggleEach(alloc.querySelectorAll(".al"), () => false);
      if (!wasOn) line.classList.add(ON);
    });
  }
}

/** Wires every demo once and returns the hook the pager calls when a page comes into view. */
export function startDemos() {
  cutSlider();
  const stopRelay = relay();
  languages();
  steps();
  whoSees();
  voiceNotes();
  expanders();
  return {
    onPageShown(page) {
      stopRelay();
      for (const el of page.querySelectorAll("[data-count]")) countUp(el);
      const alloc = page.querySelector("#alloc7");
      if (alloc) {
        alloc.classList.remove("in");
        requestAnimationFrame(() => alloc.classList.add("in"));
      }
    },
  };
}
