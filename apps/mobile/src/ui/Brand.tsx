import { Logo } from "./Logo.js";

/** The name as the brand writes it: lower case, in Source Serif. A name, so it is never translated. */
const NAME = "gigsync";

/** The mark beside the name, as the top of a screen or the wide rail shows it. The name is the visible text. */
export function Brand() {
  return (
    <span className="brand">
      <Logo size={20} />
      <span className="brand-word">{NAME}</span>
    </span>
  );
}
