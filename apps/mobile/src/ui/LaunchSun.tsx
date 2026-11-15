import { useEffect, useRef, useState } from "react";
import "./launch.css";

/** The app's opening, once per launch: a session's later reloads open straight in. */
const SEEN_KEY = "gigsync-launch-seen";
/** The sun rises and its rays draw out, then the name writes in beside it. */
const SETTLE_MS = 820;
/** Then the mark glides to where the screen's own logo sits while the screen shows through. */
const LEAVE_MS = 380;
/** The name, as the brand writes it (ui/Brand.tsx). */
const NAME = "gigsync";
/** The screen's own logo, where the opening's mark comes to rest. */
const BRAND_SELECTOR = ".brand .logo";
const RAYS = [
  "M12 2v3",
  "M12 19v3",
  "M2 12h3",
  "M19 12h3",
  "M4.9 4.9l2.1 2.1",
  "M17 17l2.1 2.1",
  "M4.9 19.1L7 17",
  "M17 7l2.1-2.1",
];

const Phase = { rise: "rise", leave: "leave", gone: "gone" } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

function seenThisLaunch(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return true;
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private windows may refuse storage: the opening then plays, which is harmless.
  }
  return false;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The opening over the first screen (design: "sun rise"): cream paper, the sun rising with its rays drawing out and
 * "gigsync" writing in, about 1.2 s in all, then the mark glides to the logo of whatever screen the app opened on while
 * the paper fades. Skipped with Reduce Motion and on reloads in the same launch. It is drawn, not read, so screen
 * readers skip it, and it takes no taps once it starts to leave.
 */
export function LaunchSun() {
  const [plays] = useState(() => !seenThisLaunch() && !reducedMotion());
  const [phase, setPhase] = useState<Phase>(plays ? Phase.rise : Phase.gone);
  const mark = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!plays) return;
    const leave = window.setTimeout(() => {
      // The mark flies to the screen's own logo when there is one; otherwise it only shrinks away in place.
      const from = mark.current?.getBoundingClientRect();
      const to = document.querySelector(BRAND_SELECTOR)?.getBoundingClientRect();
      if (from && to && mark.current) {
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        mark.current.style.setProperty("--fly", `translate(${dx}px, ${dy}px) scale(${to.width / from.width})`);
      }
      setPhase(Phase.leave);
    }, SETTLE_MS);
    const done = window.setTimeout(() => setPhase(Phase.gone), SETTLE_MS + LEAVE_MS);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [plays]);

  if (phase === Phase.gone) return null;
  return (
    <div className="launch" data-phase={phase} aria-hidden="true">
      <div className="launch-lockup">
        <span ref={mark} className="launch-sun">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle className="launch-disc" cx="12" cy="12" r="4" />
            {RAYS.map((d, i) => (
              <path key={d} className="launch-ray" d={d} style={{ animationDelay: `${260 + i * 40}ms` }} />
            ))}
          </svg>
        </span>
        <span className="launch-word">{NAME}</span>
      </div>
    </div>
  );
}
