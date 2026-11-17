import { type RefObject, useEffect, useRef } from "react";

/**
 * Keeps the foot of a chat in view: scrolled to on each new turn, and again when what is already there grows while
 * the foot was in view, as the distance map does once it has loaded under "How far will you go for work?" (it pushed
 * the slider and its answers under the composer). Someone reading further up is left where they are. Put the returned
 * ref on an empty element after the last turn.
 */
export function useEndInView(turns: readonly unknown[]): RefObject<HTMLDivElement | null> {
  const end = useRef<HTMLDivElement>(null);
  // An empty chat (the greeting) is read from its top, so only a chat with turns follows its foot.
  const said = useRef(false);
  said.current = turns.length > 0;

  useEffect(() => {
    if (turns.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  useEffect(() => {
    const foot = end.current;
    const chat = foot?.parentElement;
    if (!foot || !chat) return;
    // Resize observations run before intersection ones in a frame, so `seen` is still the state before the growth.
    let seen = false;
    const sight = new IntersectionObserver(([entry]) => {
      seen = entry?.isIntersecting ?? false;
    });
    const growth = new ResizeObserver(() => {
      if (seen && said.current) foot.scrollIntoView({ block: "end" });
    });
    sight.observe(foot);
    growth.observe(chat);
    return () => {
      sight.disconnect();
      growth.disconnect();
    };
  }, []);

  return end;
}
