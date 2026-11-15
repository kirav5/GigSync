/** The Warli-style drawings in public/art, whole figures drawn as vectors (docs/onboarding/warli_art.py), one per first
 * screen. */
export const Art = {
  welcome: "welcome",
  work: "work",
  help: "help",
  /** Find work and find help, on the two choice cards. */
  roleWork: "work",
  roleHelp: "help",
  phone: "phone",
  code: "code",
  greet: "greet",
  cook: "cook",
  move: "move",
} as const;
export type Art = (typeof Art)[keyof typeof Art];

/** The tile's ground: warm for most, green for help and for the code's check. */
export const Tone = { terra: "terra", leaf: "leaf" } as const;
export type Tone = (typeof Tone)[keyof typeof Tone];

const ART_DIR = "/art/";
const ART_TYPE = ".svg";

export const artSrc = (art: Art) => `${ART_DIR}${art}${ART_TYPE}`;

/**
 * A tile with one of the drawings, decorative only (the words beside it say everything). `small` tiles sit above a
 * field and give way to the keyboard: styles hide them while it is open, so the field stays in view.
 */
export function StartArt({ art, tone = Tone.terra, small }: { art: Art; tone?: Tone; small?: boolean }) {
  return (
    <div className="start-art" data-tone={tone} data-small={small || undefined}>
      <img src={artSrc(art)} alt="" decoding="async" />
    </div>
  );
}
