// Shared by the four direction sites: sections below the fold slide in as they arrive; nothing else moves.
const PRE = "pre";

export function revealOnScroll() {
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
