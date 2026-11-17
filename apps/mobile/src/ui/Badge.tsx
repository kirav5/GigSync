import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.js";

/**
 * A badge's colours: the terracotta tint for what is checked or signed (green is kept for money paid alone), muted for
 * what is not (yet), rust to draw the eye, gold on earth for a mark of standing.
 */
export const BadgeTone = { checked: "checked", muted: "muted", rust: "rust", gold: "gold" } as const;
export type BadgeTone = (typeof BadgeTone)[keyof typeof BadgeTone];

/** A small rounded tag with an optional 12px icon before its words ("Phone" with a tick). Its words are its text. */
export function Badge({ icon, tone, children }: { icon?: IconName | undefined; tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
