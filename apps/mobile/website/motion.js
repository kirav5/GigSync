// Motion on the website beyond the picture flight: cards that fade up as they arrive, the "she says it"
// accordion that opens on hover to show the agent's steps in between, and the three cards that stack on scroll.
const IN = "in";
const ON = "on";
const OPEN = "open";
const MOUSE = "mouse";
const MENU_OPEN = "menu-open";
const MENU_BUTTON = ".menu-toggle";
const EXPANDED = "aria-expanded";
const ESCAPE = "Escape";
/** How much a stacked card shrinks and dims once the next card has fully covered it. */
const STACK_SHRINK = 0.05;
const STACK_DIM = 0.08;

/** Elements matching `selector` fade up when they scroll into view; anything already in view shows at once. */
export function revealOnArrival(selector) {
  const nodes = [...document.querySelectorAll(selector)];
  if (!("IntersectionObserver" in window)) {
    for (const node of nodes) node.classList.add(IN);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(IN);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );
  for (const node of nodes) {
    if (node.getBoundingClientRect().top < window.innerHeight) node.classList.add(IN);
    else io.observe(node);
  }
}

/** The accordion opens while a mouse is over it or a box inside has focus; on touch, a tap toggles it. */
export function hoverAccordion(root) {
  let pointer = MOUSE;
  const open = () => root.classList.add(OPEN);
  const close = () => root.classList.remove(OPEN);
  root.addEventListener("pointerdown", (event) => {
    pointer = event.pointerType;
  });
  root.addEventListener("pointerenter", (event) => {
    if (event.pointerType === MOUSE) open();
  });
  root.addEventListener("pointerleave", (event) => {
    if (event.pointerType === MOUSE) close();
  });
  root.addEventListener("focusin", open);
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) close();
  });
  root.addEventListener("click", () => {
    if (pointer !== MOUSE) root.classList.toggle(OPEN);
  });
}

/** Sticky cards: as the next card slides over a card, the covered card shrinks a little and dims. */
export function stackCards(stack) {
  const cards = [...stack.children];
  let frame = 0;
  const render = () => {
    frame = 0;
    for (let i = 0; i < cards.length - 1; i++) {
      const card = cards[i].getBoundingClientRect();
      const next = cards[i + 1].getBoundingClientRect();
      const covered = Math.min(1, Math.max(0, 1 - (next.top - card.top) / card.height));
      cards[i].style.transform = `scale(${1 - covered * STACK_SHRINK})`;
      cards[i].style.filter = `brightness(${1 - covered * STACK_DIM})`;
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  render();
}

/** The story whose copy is in the middle of the viewport decides which card shows in the sticky panel. */
export function storyPanel(rows, demos) {
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = Number(entry.target.dataset.story);
        for (const row of rows) row.classList.toggle(ON, row === entry.target);
        for (const demo of demos) demo.classList.toggle(ON, Number(demo.dataset.demo) === index);
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  for (const row of rows) io.observe(row);
}

/** On a phone the header's links fold into a panel: the button opens it, a link or Escape closes it. */
export function phoneMenu(header) {
  const button = header.querySelector(MENU_BUTTON);
  if (button === null) return;
  const set = (open) => {
    header.classList.toggle(MENU_OPEN, open);
    button.setAttribute(EXPANDED, String(open));
  };
  button.addEventListener("click", () => set(!header.classList.contains(MENU_OPEN)));
  header.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a") !== null) set(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === ESCAPE) set(false);
  });
}
