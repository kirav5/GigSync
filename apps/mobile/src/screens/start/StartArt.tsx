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

const ART_DIR = "/art/";
const ART_TYPE = ".svg";

export const artSrc = (art: Art) => `${ART_DIR}${art}${ART_TYPE}`;

/**
 * One of the drawings, decorative only (the words beside it say everything): on a tinted tile, or `bare`, straight on
 * the page, for the round mandala that a square tile would box in. `small` ones sit above a field and give way to the
 * keyboard: styles hide them while it is open, so the field stays in view.
 */
export function StartArt({ art, small, bare }: { art: Art; small?: boolean; bare?: boolean }) {
  return (
    <div className="start-art" data-small={small || undefined} data-bare={bare || undefined}>
      <img src={artSrc(art)} alt="" decoding="async" />
    </div>
  );
}
