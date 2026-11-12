import { Icon } from "./Icon.js";

/** GigSync's mark: the sun icon (a circle and eight rays) in the brand rust, a little bolder (`.logo` in styles.css). */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <span className="logo">
      <Icon name="sun" size={size} />
    </span>
  );
}
