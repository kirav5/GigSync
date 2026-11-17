import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./launch.css";

/**
 * The opening's timeline, in ms from its first frame. launch.css reads each value as a custom property, so the code
 * that decides when to leave and the animations it waits for share one clock. The sun's own motion (horizon, rise,
 * rays) is over by 850 ms, inside the 1 s Android's splash-screen guidance gives an animated icon.
 */
const Timeline = {
  /** A short horizon draws out under where the sun will stand. */
  horizonMs: 250,
  /** The disc rises from behind it. */
  riseAt: 100,
  riseMs: 500,
  /** The eight rays draw out one after another, clockwise from the top. */
  raysAt: 520,
  rayMs: 120,
  rayStaggerMs: 30,
  /** The name comes in letter by letter. */
  wordAt: 700,
  letterMs: 300,
  letterStaggerMs: 40,
  /** The line under it fades in. */
  taglineAt: 950,
  taglineMs: 300,
  /** The finished lockup stands still this long. */
  holdMs: 700,
  /** The mark glides to the screen's logo while the paper fades; then it hands over to that logo. */
  leaveMs: 420,
  landMs: 100,
} as const;

/** The name, as the brand writes it (ui/Brand.tsx). */
const NAME = "gigsync";
/** The welcome screen's line (`start.welcome_sub`), in English: the opening plays before a language is known. */
const TAGLINE = "Fair work, close to home.";
/** The screen's own logo, where the opening's mark comes to rest. */
const LOGO_SELECTOR = ".brand .logo .ic";
/** index.html's first frame: the paper, painted before any script runs. */
const STATIC_FRAME_ID = "launch-static";
/** The sun as ui/Icon.tsx draws it: a circle of radius 4 at the centre, then each ray drawn outward from the disc. */
const DISC = { c: 12, r: 4 } as const;
const RAYS = ["M12 5V2", "M17 7l2-2", "M19 12h3", "M17 17l2 2", "M12 19v3", "M7 17l-2 2", "M5 12H2", "M7 7L5 5"];

const LETTERS = [...NAME];
const lastStart = (at: number, count: number, stagger: number) => at + (count - 1) * stagger;
/** When everything has arrived: the later of the last letter, the last ray and the tagline. */
const SETTLED_AT = Math.max(
  lastStart(Timeline.wordAt, LETTERS.length, Timeline.letterStaggerMs) + Timeline.letterMs,
  lastStart(Timeline.raysAt, RAYS.length, Timeline.rayStaggerMs) + Timeline.rayMs,
  Timeline.taglineAt + Timeline.taglineMs,
);
const LEAVE_AT = SETTLED_AT + Timeline.holdMs;

const ms = (n: number) => `${n}ms`;
const TIMELINE_VARS = {
  "--launch-horizon-ms": ms(Timeline.horizonMs),
  "--launch-rise-at": ms(Timeline.riseAt),
  "--launch-rise-ms": ms(Timeline.riseMs),
  "--launch-rays-at": ms(Timeline.raysAt),
  "--launch-ray-ms": ms(Timeline.rayMs),
  "--launch-ray-stagger": ms(Timeline.rayStaggerMs),
  "--launch-word-at": ms(Timeline.wordAt),
  "--launch-letter-ms": ms(Timeline.letterMs),
  "--launch-letter-stagger": ms(Timeline.letterStaggerMs),
  "--launch-tagline-at": ms(Timeline.taglineAt),
  "--launch-tagline-ms": ms(Timeline.taglineMs),
  "--launch-leave-ms": ms(Timeline.leaveMs),
  "--launch-land-ms": ms(Timeline.landMs),
} as CSSProperties;
const order = (i: number) => ({ "--i": i }) as CSSProperties;

const Phase = { rise: "rise", leave: "leave", land: "land", gone: "gone" } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

/**
 * Reduce Motion skips it, and so does browser automation (`navigator.webdriver`): the UI tests drive the screen
 * underneath and should not wait on a drawing. Every other full load plays it: an installed app never reloads inside
 * itself, so a load is a launch.
 */
const plays = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && navigator.webdriver !== true;

/**
 * The opening over the first screen (design: "sun rise"), about 2.4 s: on cream paper a horizon draws, the sun rises
 * from behind it and its rays draw out, "gigsync" comes in letter by letter with its line beneath, and the finished
 * lockup holds. Then the mark, on its own layer and at full strength, glides to the logo of whatever screen the app
 * opened on while the paper fades, and hands over to it once it is there; a screen without a logo sees the lockup
 * shrink a little and fade. A tap leaves at once. It is drawn, not read, so screen readers skip it.
 */
export function LaunchSun() {
  const [playing] = useState(plays);
  const [phase, setPhase] = useState<Phase>(playing ? Phase.rise : Phase.gone);
  const [flies, setFlies] = useState(true);
  const mark = useRef<HTMLSpanElement>(null);
  const leaveNow = useRef<() => void>(() => {});

  // The React frame is drawn by now, identical to index.html's, so the static one goes, whether or not this plays.
  useLayoutEffect(() => {
    document.getElementById(STATIC_FRAME_ID)?.remove();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timers: number[] = [];
    const after = (delay: number, run: () => void) => timers.push(window.setTimeout(run, delay));
    let logo: SVGElement | null = null;
    let left = false;

    // The screen's logo is hidden while the mark is on its way, so it shows once, where the mark lands.
    const showLogo = () => logo?.style.removeProperty("visibility");
    const leave = () => {
      if (left) return;
      left = true;
      logo = document.querySelector<SVGElement>(LOGO_SELECTOR);
      const from = mark.current?.getBoundingClientRect();
      const to = logo?.getBoundingClientRect();
      if (logo && from && to && mark.current) {
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        mark.current.style.setProperty("--fly", `translate(${dx}px, ${dy}px) scale(${to.width / from.width})`);
        logo.style.visibility = "hidden";
      } else {
        setFlies(false);
      }
      setPhase(Phase.leave);
      after(Timeline.leaveMs, () => {
        showLogo();
        setPhase(Phase.land);
      });
      after(Timeline.leaveMs + Timeline.landMs, () => setPhase(Phase.gone));
    };
    leaveNow.current = leave;
    after(LEAVE_AT, leave);
    return () => {
      for (const id of timers) window.clearTimeout(id);
      showLogo();
    };
  }, [playing]);

  if (phase === Phase.gone) return null;
  return (
    // A tap anywhere skips to the leaving. The opening is hidden from screen readers: the screen beneath has the controls.
    <div
      className="launch"
      data-phase={phase}
      data-flies={flies}
      aria-hidden="true"
      style={TIMELINE_VARS}
      onPointerDown={() => leaveNow.current()}
    >
      <div className="launch-paper" />
      <div className="launch-stage">
        <div className="launch-lockup">
          <span className="launch-sunbox">
            <span ref={mark} className="launch-mark">
              <span className="launch-sky">
                <svg className="launch-disc" viewBox="0 0 24 24" aria-hidden>
                  <circle cx={DISC.c} cy={DISC.c} r={DISC.r} />
                </svg>
              </span>
              <svg className="launch-rays" viewBox="0 0 24 24" aria-hidden>
                {RAYS.map((d, i) => (
                  <path key={d} d={d} pathLength={1} style={order(i)} />
                ))}
              </svg>
            </span>
            <span className="launch-horizon" />
          </span>
          <span className="launch-word">
            {LETTERS.map((letter, i) => (
              // A name's letters repeat ("g"), so each is keyed by its place.
              // biome-ignore lint/suspicious/noArrayIndexKey: the name is fixed; a letter's place is its identity.
              <span key={i} style={order(i)}>
                {letter}
              </span>
            ))}
          </span>
        </div>
        <p className="launch-tagline">
          <span>{TAGLINE}</span>
        </p>
      </div>
    </div>
  );
}
