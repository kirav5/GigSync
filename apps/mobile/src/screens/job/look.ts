/**
 * The opened job's own class names (jobs.css), named once: the lint bans a bare string used three times in a file, and
 * several cards share them. The design kit's (styles.css) are here too where a job card combines them.
 */
export const J = {
  /** The screen's one primary action: rust, 56px, full width. */
  hero: "btn accent btn-big wide",
  /** A quiet way out under the primary action: rust words alone, full width. */
  ghost: "btn ghost wide",
  /** A secondary action, full width. */
  second: "btn secondary wide",
  sage: "card card-sage",
  earth: "card card-earth",
  fine: "fine",
  label: "section-label",
  heroLine: "hero-line",
  who: "who",
  name: "job-name",
} as const;

/** A signature's hash as people can compare it across two phones: its first and last four characters. */
const HASH_EDGE = 4;
const ELLIPSIS = "…";
export const shortHash = (hash: string): string => `${hash.slice(0, HASH_EDGE)}${ELLIPSIS}${hash.slice(-HASH_EDGE)}`;
